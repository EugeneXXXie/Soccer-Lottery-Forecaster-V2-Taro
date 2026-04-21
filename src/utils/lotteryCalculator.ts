// 投注算法核心工具文件
// 这个文件只负责“数据计算”，不处理任何页面 UI。

export type MatchOdds = {
  s0: number
  s1: number
  s2: number
  s3: number
  s4: number
  s5: number
  s6: number
  s7: number
}

export type ResultRow = {
  NumberOfGoals: number
  NumberOfGoalsLabel: string
  ExpectedInput: number
  AmountInvested: number
  ExpectedReturn: number
}

export type StrategyKey = 'balanced' | 'aggressive' | 'all-in'

// 算法配置项。
// 当前思路不再是简单按权重均分，而是：
// 1. 先给每个进球数一个基础仓位
// 2. 尽量让更多结果达到“回本/盈利线”
// 3. 同时优先保护低赔率，也就是相对更可能发生的结果
export type CalculatorConfig = {
  // 最小投注单位，当前按“股”计算，1 股 = 2 元
  minStakeUnit: number
  // 需要优先保护的低赔率结果数量
  protectedCount: number
  // 概率权重幂次，越大越偏向低赔率结果
  probabilityPower: number
  // 盈利覆盖数量优先级，越大越想多覆盖几个结果
  countPriority: number
  // 概率优先级，越大越看重低赔率结果的保护
  probabilityPriority: number
  // 覆盖效率优先级，越大越倾向优先补“更容易补到盈利线”的结果
  efficiencyPriority: number
  // 长赔率额外倾向，越大越激进
  longshotPriority: number
  // 单一结果最多允许拿到多少比例的总股数，用于剩余仓位分配阶段
  maxConcentrationRatio: number
  // 剩余仓位的偏好方向
  residualPreference: 'protected' | 'balanced' | 'return'
}

// 总进球玩法固定 8 档，对应 0 球到 7+ 球
export const GOAL_KEYS = ['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7'] as const
export const GOAL_LABELS = ['0球', '1球', '2球', '3球', '4球', '5球', '6球', '7+球']

// 当接口获取失败时，页面会先回退到一组默认赔率占位值
export const DEFAULT_ODDS: MatchOdds = {
  s0: 1.3,
  s1: 1.3,
  s2: 1.3,
  s3: 1.3,
  s4: 1.3,
  s5: 1.3,
  s6: 1.3,
  s7: 1.3
}

// 三档策略：
// balanced：更保守，优先守低赔率结果
// aggressive：默认档，尽量平衡“多覆盖”和“保低赔”
// all-in：更激进，愿意把剩余预算继续往高回报方向推
export const STRATEGY_CONFIGS: Record<StrategyKey, CalculatorConfig> = {
  balanced: {
    minStakeUnit: 1,
    protectedCount: 3,
    probabilityPower: 1.22,
    countPriority: 120,
    probabilityPriority: 54,
    efficiencyPriority: 26,
    longshotPriority: 6,
    maxConcentrationRatio: 0.36,
    residualPreference: 'protected'
  },
  aggressive: {
    minStakeUnit: 1,
    protectedCount: 2,
    probabilityPower: 1.08,
    countPriority: 120,
    probabilityPriority: 40,
    efficiencyPriority: 28,
    longshotPriority: 10,
    maxConcentrationRatio: 0.46,
    residualPreference: 'balanced'
  },
  'all-in': {
    minStakeUnit: 1,
    protectedCount: 1,
    probabilityPower: 0.94,
    countPriority: 120,
    probabilityPriority: 30,
    efficiencyPriority: 20,
    longshotPriority: 18,
    maxConcentrationRatio: 0.58,
    residualPreference: 'return'
  }
}

export const DEFAULT_STRATEGY: StrategyKey = 'aggressive'

// 解析页面里的赔率输入，并同步生成字段错误状态。
export function parseOddsList(oddsForm: Record<(typeof GOAL_KEYS)[number], string>) {
  const values: number[] = []
  const fieldErrors: Record<string, boolean> = {}
  let hasError = false

  GOAL_KEYS.forEach((key) => {
    const value = Number(oddsForm[key])
    const valid = Number.isFinite(value) && value >= 1.3
    fieldErrors[key] = !valid
    if (!valid) {
      hasError = true
    }
    values.push(value)
  })

  return { hasError, values, fieldErrors }
}

// 预算归一化。
// 当前项目按 2 元 1 股计算，所以这里会自动向下修正为偶数金额。
export function normalizePrincipal(input: string | number) {
  const parsedPrincipal = Number(input)
  const isValid = Number.isFinite(parsedPrincipal) && parsedPrincipal >= 16

  if (!isValid) {
    return {
      isValid: false,
      normalized: 0
    }
  }

  let normalized = Math.trunc(parsedPrincipal)
  if (normalized % 2 !== 0) {
    normalized -= 1
  }

  return {
    isValid: true,
    normalized
  }
}

function roundUpToUnit(value: number, minStakeUnit: number) {
  const rounded = Math.ceil(value / minStakeUnit) * minStakeUnit
  return Math.max(minStakeUnit, rounded)
}

// 用赔率倒数估算一个相对概率权重。
function buildProbabilityWeights(oddsValues: number[], power: number) {
  const weights = oddsValues.map((odds) => 1 / Math.pow(odds, power))
  const total = weights.reduce((sum, item) => sum + item, 0)
  return weights.map((item) => item / total)
}

// 计算某个结果达到“回本/盈利线”至少需要多少股。
function getBreakEvenShares(principal: number, odds: number, minStakeUnit: number) {
  return roundUpToUnit(principal / (odds * 2), minStakeUnit)
}

function getRankedIndexes(oddsValues: number[]) {
  return [...oddsValues]
    .map((odds, index) => ({ odds, index }))
    .sort((a, b) => a.odds - b.odds)
    .map((item) => item.index)
}

function getRankMap(rankedIndexes: number[]) {
  const rankMap = new Array(rankedIndexes.length).fill(0)
  rankedIndexes.forEach((index, rank) => {
    rankMap[index] = rank
  })
  return rankMap
}

// 在剩余预算内，找出“额外补到盈利线”最划算的一组结果。
// 这里的目标不是平均分，而是优先做到：
// - 多几个结果能盈利
// - 同时保住相对更可能发生的低赔率结果
function pickCoverageIndexes(
  candidateIndexes: number[],
  extraNeed: number[],
  sharesLeft: number,
  probabilityWeights: number[],
  oddsValues: number[],
  averageOdds: number,
  config: CalculatorConfig
) {
  let bestIndexes: number[] = []
  let bestScore = -Infinity
  let bestCost = 0

  const totalCandidates = candidateIndexes.length
  const totalMasks = 1 << totalCandidates

  for (let mask = 0; mask < totalMasks; mask++) {
    let cost = 0
    let count = 0
    let probabilityScore = 0
    let efficiencyScore = 0
    let longshotScore = 0
    const selected: number[] = []

    for (let bit = 0; bit < totalCandidates; bit++) {
      if ((mask & (1 << bit)) === 0) {
        continue
      }

      const index = candidateIndexes[bit]
      const need = extraNeed[index]
      cost += need
      if (cost > sharesLeft) {
        break
      }

      count += 1
      probabilityScore += probabilityWeights[index]
      efficiencyScore += probabilityWeights[index] / Math.max(need, 1)
      longshotScore += Math.max(0, oddsValues[index] / averageOdds - 1)
      selected.push(index)
    }

    if (cost > sharesLeft) {
      continue
    }

    const score =
      count * config.countPriority +
      probabilityScore * config.probabilityPriority +
      efficiencyScore * config.efficiencyPriority +
      longshotScore * config.longshotPriority

    if (
      score > bestScore ||
      (score === bestScore && count > bestIndexes.length) ||
      (score === bestScore && count === bestIndexes.length && cost < bestCost)
    ) {
      bestScore = score
      bestIndexes = selected
      bestCost = cost
    }
  }

  return bestIndexes
}

// 处理剩余股数。
// 这一步不再追求“硬覆盖几个盈利项”，而是根据不同策略做最后微调：
// - 稳健：继续保护低赔率
// - 激进：兼顾低赔率和接近盈利线的结果
// - 冲刺：更愿意把剩余仓位推向高回报结果
function distributeResidualShares(
  allocations: number[],
  sharesLeft: number,
  breakEvenShares: number[],
  probabilityWeights: number[],
  oddsValues: number[],
  config: CalculatorConfig
) {
  const normalized = [...allocations]
  const averageOdds = oddsValues.reduce((sum, odds) => sum + odds, 0) / oddsValues.length
  const rankedIndexes = getRankedIndexes(oddsValues)
  const rankMap = getRankMap(rankedIndexes)
  const expectedShares = normalized.reduce((sum, item) => sum + item, 0) + sharesLeft
  const baseLimit = Math.max(config.minStakeUnit, Math.floor(expectedShares * config.maxConcentrationRatio))

  while (sharesLeft > 0) {
    let bestIndex = -1
    let bestScore = -Infinity

    normalized.forEach((value, index) => {
      const dynamicLimit = Math.max(baseLimit, value)
      if (value + config.minStakeUnit > dynamicLimit) {
        return
      }

      const gapToBreakEven = Math.max(0, breakEvenShares[index] - value)
      const isProtectedZone = rankMap[index] < Math.max(2, config.protectedCount + 1)
      let score = probabilityWeights[index] * config.probabilityPriority

      if (gapToBreakEven > 0) {
        score += (config.countPriority * 0.28) / gapToBreakEven
      } else {
        score += config.countPriority * 0.04
      }

      if (config.residualPreference === 'protected' && isProtectedZone) {
        score += 12
      }

      if (config.residualPreference === 'balanced' && gapToBreakEven > 0) {
        score += 8
      }

      if (config.residualPreference === 'return') {
        score += (oddsValues[index] / averageOdds) * config.longshotPriority
      } else {
        score += Math.max(0, oddsValues[index] / averageOdds - 1) * config.longshotPriority
      }

      if (score > bestScore) {
        bestScore = score
        bestIndex = index
      }
    })

    if (bestIndex === -1) {
      break
    }

    normalized[bestIndex] += config.minStakeUnit
    sharesLeft -= config.minStakeUnit
  }

  return normalized
}

// 主算法。
// 当前版本不再是“简单按赔率比例均分”，而是：
// 1. 先给全部进球数一个基础持仓，避免完全空档
// 2. 先保护一部分低赔率结果
// 3. 再在预算内尽量把更多结果推到盈利线以上
// 4. 最后把剩余仓位按策略做微调
export function calculatePlan(
  oddsValues: number[],
  principal: number,
  strategy: StrategyKey = DEFAULT_STRATEGY,
  customConfig?: Partial<CalculatorConfig>
) {
  const config: CalculatorConfig = {
    ...STRATEGY_CONFIGS[strategy],
    ...customConfig
  }

  const expectedShares = principal / 2
  const allocations = new Array(oddsValues.length).fill(config.minStakeUnit)
  let sharesLeft = expectedShares - allocations.reduce((sum, item) => sum + item, 0)

  if (sharesLeft <= 0) {
    return allocations
  }

  const rankedIndexes = getRankedIndexes(oddsValues)
  const averageOdds = oddsValues.reduce((sum, odds) => sum + odds, 0) / oddsValues.length
  const probabilityWeights = buildProbabilityWeights(oddsValues, config.probabilityPower)
  const breakEvenShares = oddsValues.map((odds) => getBreakEvenShares(principal, odds, config.minStakeUnit))
  const extraNeed = breakEvenShares.map((shares) => Math.max(0, shares - config.minStakeUnit))

  // 先保护前几个低赔率结果，如果预算不够，就按顺序保护到预算上限为止。
  const protectedIndexes = rankedIndexes.filter((index) => extraNeed[index] > 0).slice(0, config.protectedCount)
  protectedIndexes.forEach((index) => {
    const need = extraNeed[index]
    if (need <= sharesLeft) {
      allocations[index] = breakEvenShares[index]
      sharesLeft -= need
    }
  })

  // 剩余预算继续尽量扩大“盈利结果”的覆盖数量。
  const candidateIndexes = rankedIndexes.filter(
    (index) => extraNeed[index] > 0 && allocations[index] < breakEvenShares[index]
  )

  const coverageIndexes = pickCoverageIndexes(
    candidateIndexes,
    extraNeed,
    sharesLeft,
    probabilityWeights,
    oddsValues,
    averageOdds,
    config
  )

  coverageIndexes.forEach((index) => {
    const need = breakEvenShares[index] - allocations[index]
    if (need <= sharesLeft) {
      allocations[index] = breakEvenShares[index]
      sharesLeft -= need
    }
  })

  return distributeResidualShares(allocations, sharesLeft, breakEvenShares, probabilityWeights, oddsValues, config)
}

// 把内部股数结果转换成页面表格可直接渲染的数据。
export function buildResultRows(allocations: number[], oddsValues: number[]): ResultRow[] {
  return GOAL_KEYS.map((_, index) => ({
    NumberOfGoals: index,
    NumberOfGoalsLabel: GOAL_LABELS[index],
    ExpectedInput: allocations[index],
    AmountInvested: allocations[index] * 2,
    ExpectedReturn: Math.round(allocations[index] * 2 * oddsValues[index])
  }))
}

// 根据结果表做一个简短的可读结论。
export function getRecommendation(rows: ResultRow[], principal: number) {
  const profitableCount = rows.filter((row) => row.ExpectedReturn >= principal).length

  if (profitableCount >= 5) {
    return '本场盈利覆盖较多，可重点关注'
  }

  if (profitableCount >= 3) {
    return '本场具备一定覆盖面，可结合临场判断'
  }

  if (profitableCount >= 1) {
    return '当前更偏向挑点收益，适合谨慎分配'
  }

  return '当前赔率结构较难形成盈利覆盖，建议谨慎投入'
}
