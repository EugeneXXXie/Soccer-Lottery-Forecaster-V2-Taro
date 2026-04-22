export type ProbabilityMode = 'implied' | 'custom'

export type ProbabilitySource =
  | { mode: 'implied' }
  | { mode: 'custom'; values: number[] }

export type ResolvedProbabilityVector = {
  mode: ProbabilityMode
  values: number[]
  customValid: boolean
}

const DEFAULT_IMPLIED_PROBABILITY_POWER = 1

// custom 概率先只约束“能不能安全参与计算”：
// - 固定 8 档
// - 不允许负数和非有限数
// - 允许 0，但整组必须至少有一个正值
export function normalizeCustomProbabilities(values: number[]): number[] | null {
  if (!Array.isArray(values) || values.length !== 8) {
    return null
  }

  let hasPositiveValue = false
  let sum = 0

  for (const value of values) {
    if (!Number.isFinite(value) || value < 0) {
      return null
    }

    if (value > 0) {
      hasPositiveValue = true
    }

    sum += value
  }

  if (!hasPositiveValue || sum <= 0) {
    return null
  }

  return values.map((value) => value / sum)
}

// implied 概率只是一种赔率倒数近似，不是比赛真实预测概率。
export function buildImpliedProbabilities(oddsValues: number[], power = DEFAULT_IMPLIED_PROBABILITY_POWER) {
  const weights = oddsValues.map((odds) => 1 / Math.pow(odds, power))
  const total = weights.reduce((sum, item) => sum + item, 0)

  if (total <= 0) {
    return weights.map(() => 0)
  }

  return weights.map((item) => item / total)
}

// 第一版对外策略是“能算优先”：
// custom 合法就用 custom，不合法就安全回退 implied。
export function resolveProbabilityVector(
  oddsValues: number[],
  source: ProbabilitySource,
  impliedPower = DEFAULT_IMPLIED_PROBABILITY_POWER
): ResolvedProbabilityVector {
  if (source.mode === 'custom') {
    const normalized = normalizeCustomProbabilities(source.values)
    if (normalized) {
      return {
        mode: 'custom',
        values: normalized,
        customValid: true
      }
    }
  }

  return {
    mode: 'implied',
    values: buildImpliedProbabilities(oddsValues, impliedPower),
    customValid: false
  }
}
