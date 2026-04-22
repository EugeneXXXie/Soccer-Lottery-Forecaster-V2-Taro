import {
  createMinimumAllocations,
  principalToTotalShares,
  runGreedyAllocation,
  SHARE_COST_YUAN
} from './allocationConstraints'
import { resolveProbabilityVector } from './probabilityModel'
import type { ProbabilitySource } from './probabilityModel'
import {
  evaluatePortfolio,
  getCoverageMetrics,
  scoreBalancedCandidate,
  scoreCoverageCandidate,
  scoreExpectedCandidate,
  scorePayoutCandidate
} from './strategyObjectives'
import type { CanonicalStrategyKey, PortfolioMetrics } from './strategyObjectives'

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

export type LegacyStrategyKey = 'balanced' | 'aggressive' | 'all-in'
export type StrategyKey = Exclude<CanonicalStrategyKey, 'expected'>

export type CalculatorConfig = {
  minStakeUnit: number
  maxConcentrationRatio: number
}

export type PlanSummary = {
  coverageLevel: 'strong' | 'moderate' | 'limited'
  concentrationLevel: 'low' | 'medium' | 'high'
  maximumNetSingleHitReturn: number
  riskClassification: 'low' | 'medium' | 'high'
  expectedReturnQuality: 'inactive' | 'positive' | 'neutral' | 'negative'
  metrics: PortfolioMetrics
  probabilityMode: 'implied' | 'custom'
  customValid: boolean
  canonicalStrategy: CanonicalStrategyKey
}

export type CalculatePlanOptions = {
  probabilitySource?: ProbabilitySource
  config?: Partial<CalculatorConfig>
  strategyInputMode?: 'canonical' | 'legacy'
}

// 总进球玩法固定 8 档，对应 0 球到 7+ 球
export const GOAL_KEYS = ['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7'] as const
export const GOAL_LABELS = ['0球', '1球', '2球', '3球', '4球', '5球', '6球', '7+球']
export const MIN_VALID_ODDS = 1.3
export const DEFAULT_PLACEHOLDER_ODDS = 1.3

// 当接口获取失败时，页面会先回退到一组默认赔率占位值
export const DEFAULT_ODDS: MatchOdds = {
  s0: DEFAULT_PLACEHOLDER_ODDS,
  s1: DEFAULT_PLACEHOLDER_ODDS,
  s2: DEFAULT_PLACEHOLDER_ODDS,
  s3: DEFAULT_PLACEHOLDER_ODDS,
  s4: DEFAULT_PLACEHOLDER_ODDS,
  s5: DEFAULT_PLACEHOLDER_ODDS,
  s6: DEFAULT_PLACEHOLDER_ODDS,
  s7: DEFAULT_PLACEHOLDER_ODDS
}

export const CANONICAL_STRATEGY_CONFIGS: Record<CanonicalStrategyKey, CalculatorConfig> = {
  coverage: {
    minStakeUnit: 1,
    maxConcentrationRatio: 0.36
  },
  balanced: {
    minStakeUnit: 1,
    maxConcentrationRatio: 0.44
  },
  payout: {
    minStakeUnit: 1,
    maxConcentrationRatio: 0.58
  },
  expected: {
    minStakeUnit: 1,
    maxConcentrationRatio: 0.5
  }
}

// 页面现在已经直接使用 canonical key；
// 保留 legacy 映射只是为了兼容旧入口和后续回归对比。
export const DEFAULT_STRATEGY: StrategyKey = 'balanced'
export const LEGACY_TO_CANONICAL_STRATEGY: Record<LegacyStrategyKey, StrategyKey> = {
  balanced: 'coverage',
  aggressive: 'balanced',
  'all-in': 'payout'
}

// 解析页面里的赔率输入，并同步生成字段错误状态。
export function parseOddsList(oddsForm: Record<(typeof GOAL_KEYS)[number], string>) {
  const values: number[] = []
  const fieldErrors: Record<string, boolean> = {}
  let hasError = false

  GOAL_KEYS.forEach((key) => {
    const value = Number(oddsForm[key])
    const valid = Number.isFinite(value) && value >= MIN_VALID_ODDS
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

function resolveCanonicalStrategy(
  strategy: StrategyKey | CanonicalStrategyKey | LegacyStrategyKey,
  inputMode: 'canonical' | 'legacy' = 'canonical'
) {
  // legacy 模式下允许把旧三档语义显式映射到新策略；
  // canonical 模式下则优先信任调用方，不再做“同名再映射”。
  if (inputMode === 'legacy') {
    return LEGACY_TO_CANONICAL_STRATEGY[strategy as LegacyStrategyKey]
  }

  if (strategy === 'aggressive' || strategy === 'all-in') {
    return LEGACY_TO_CANONICAL_STRATEGY[strategy]
  }

  return strategy as CanonicalStrategyKey
}

function resolveCalculatePlanOptions(
  options?: Partial<CalculatorConfig> | CalculatePlanOptions
): CalculatePlanOptions {
  if (!options) {
    return {}
  }

  const maybeLegacyConfig = options as Partial<CalculatorConfig>
  if (
    'minStakeUnit' in maybeLegacyConfig ||
    'maxConcentrationRatio' in maybeLegacyConfig
  ) {
    return { config: maybeLegacyConfig }
  }

  return options as CalculatePlanOptions
}

function scoreCandidateByStrategy(
  strategy: CanonicalStrategyKey,
  metrics: PortfolioMetrics,
  customValid: boolean
) {
  if (strategy === 'coverage') {
    return scoreCoverageCandidate(metrics)
  }

  if (strategy === 'balanced') {
    return scoreBalancedCandidate(metrics)
  }

  if (strategy === 'payout') {
    return scorePayoutCandidate(metrics)
  }

  if (strategy === 'expected' && customValid) {
    return scoreExpectedCandidate(metrics)
  }

  return scoreBalancedCandidate(metrics)
}

// summary 是给页面结论层用的“压缩视图”，
// 不直接决定分配，只负责把底层指标翻译成更稳定的展示语义。
function getCoverageLevel(metrics: PortfolioMetrics): PlanSummary['coverageLevel'] {
  const coverage = getCoverageMetrics(metrics)

  if (coverage.fullCoverageCount >= 5 || coverage.nearCoverageCount >= 6) {
    return 'strong'
  }

  if (coverage.fullCoverageCount >= 3 || coverage.nearCoverageCount >= 4) {
    return 'moderate'
  }

  return 'limited'
}

function getConcentrationLevel(maxConcentrationRatio: number): PlanSummary['concentrationLevel'] {
  if (maxConcentrationRatio >= 0.5) {
    return 'high'
  }

  if (maxConcentrationRatio >= 0.35) {
    return 'medium'
  }

  return 'low'
}

function getRiskClassification(
  canonicalStrategy: CanonicalStrategyKey,
  concentrationLevel: PlanSummary['concentrationLevel']
): PlanSummary['riskClassification'] {
  if (canonicalStrategy === 'payout') {
    return 'high'
  }

  if (canonicalStrategy === 'coverage' && concentrationLevel === 'low') {
    return 'low'
  }

  return concentrationLevel === 'high' ? 'high' : 'medium'
}

function getExpectedReturnQuality(
  expectedNetReturn: number,
  probabilityMode: 'implied' | 'custom',
  customValid: boolean
): PlanSummary['expectedReturnQuality'] {
  if (probabilityMode !== 'custom' || !customValid) {
    return 'inactive'
  }

  if (expectedNetReturn > 0) {
    return 'positive'
  }

  if (expectedNetReturn === 0) {
    return 'neutral'
  }

  return 'negative'
}

export function calculatePlanDetails(
  oddsValues: number[],
  principal: number,
  strategy: StrategyKey | CanonicalStrategyKey | LegacyStrategyKey = DEFAULT_STRATEGY,
  options?: Partial<CalculatorConfig> | CalculatePlanOptions
) {
  const resolvedOptions = resolveCalculatePlanOptions(options)
  let canonicalStrategy = resolveCanonicalStrategy(strategy, resolvedOptions.strategyInputMode)
  const baseConfig = CANONICAL_STRATEGY_CONFIGS[canonicalStrategy]
  const config: CalculatorConfig = {
    ...baseConfig,
    ...resolvedOptions.config
  }

  const totalShares = principalToTotalShares(principal, SHARE_COST_YUAN)
  const allocations = createMinimumAllocations(oddsValues.length, config.minStakeUnit)
  const baseAllocatedShares = allocations.reduce((sum, item) => sum + item, 0)
  const sharesLeft = Math.max(0, totalShares - baseAllocatedShares)

  const probabilityResolution = resolveProbabilityVector(
    oddsValues,
    resolvedOptions.probabilitySource || { mode: 'implied' }
  )

  // expected 只有在 custom probability 真正有效时才有数学意义，
  // 否则回退到 balanced，避免名字正确但目标失真。
  if (canonicalStrategy === 'expected' && !probabilityResolution.customValid) {
    canonicalStrategy = 'balanced'
  }

  // 第一版仍然采用逐股贪心，但“如何打分”已经切到统一框架：
  // 约束层负责能不能加，策略层负责这一股该加给谁。
  const nextAllocations =
    sharesLeft > 0
      ? runGreedyAllocation({
          allocations,
          sharesLeft,
          totalShares,
          minStakeUnit: config.minStakeUnit,
          maxConcentrationRatio: config.maxConcentrationRatio,
          scoreCandidate: (_candidateIndex, candidateAllocations) => {
            const metrics = evaluatePortfolio(
              candidateAllocations,
              oddsValues,
              principal,
              probabilityResolution.values
            )

            return scoreCandidateByStrategy(canonicalStrategy, metrics, probabilityResolution.customValid)
          }
        })
      : allocations

  const metrics = evaluatePortfolio(nextAllocations, oddsValues, principal, probabilityResolution.values)
  const concentrationLevel = getConcentrationLevel(metrics.maxConcentrationRatio)

  return {
    allocations: nextAllocations,
    summary: {
      coverageLevel: getCoverageLevel(metrics),
      concentrationLevel,
      maximumNetSingleHitReturn: metrics.maxNetSingleHitReturn,
      riskClassification: getRiskClassification(canonicalStrategy, concentrationLevel),
      expectedReturnQuality: getExpectedReturnQuality(
        metrics.expectedNetReturn,
        probabilityResolution.mode,
        probabilityResolution.customValid
      ),
      metrics,
      probabilityMode: probabilityResolution.mode,
      customValid: probabilityResolution.customValid,
      canonicalStrategy
    } satisfies PlanSummary
  }
}

export function calculatePlan(
  oddsValues: number[],
  principal: number,
  strategy: StrategyKey | LegacyStrategyKey = DEFAULT_STRATEGY,
  options?: Partial<CalculatorConfig> | CalculatePlanOptions
) {
  return calculatePlanDetails(oddsValues, principal, strategy, options).allocations
}

// 把内部股数结果转换成页面表格可直接渲染的数据。
export function buildResultRows(allocations: number[], oddsValues: number[]): ResultRow[] {
  return GOAL_KEYS.map((_, index) => ({
    NumberOfGoals: index,
    NumberOfGoalsLabel: GOAL_LABELS[index],
    ExpectedInput: allocations[index],
    AmountInvested: allocations[index] * SHARE_COST_YUAN,
    ExpectedReturn: Math.round(allocations[index] * SHARE_COST_YUAN * oddsValues[index])
  }))
}

export function getRecommendation(summary: PlanSummary) {
  // 推荐文案现在只依赖 summary，
  // 这样页面层不需要知道 coverage / concentration / expected 的细节公式。
  if (summary.expectedReturnQuality === 'positive') {
    return '当前自定义概率下期望收益为正，可重点结合模型判断'
  }

  if (summary.coverageLevel === 'strong' && summary.concentrationLevel === 'low') {
    return '当前覆盖较完整，分配也较分散，适合稳健参考'
  }

  if (summary.coverageLevel !== 'limited' && summary.riskClassification !== 'high') {
    return '当前覆盖与集中度较均衡，可结合临场信息继续判断'
  }

  if (summary.maximumNetSingleHitReturn > 0 && summary.riskClassification === 'high') {
    return '当前更偏向单点冲高回报，命中收益更高但波动也更大'
  }

  return '当前赔率结构偏紧或分配空间有限，建议谨慎投入'
}
