import { getMaxConcentrationRatio, getTotalAllocatedShares, SHARE_COST_YUAN } from './allocationConstraints'

export type CanonicalStrategyKey = 'coverage' | 'balanced' | 'payout' | 'expected'

export const NEAR_COVERAGE_THRESHOLD_RATIO = 0.95
export const BALANCED_COVERAGE_REWARD_WEIGHT = 130
export const BALANCED_PROBABILITY_ALIGNMENT_WEIGHT = 42
export const BALANCED_CONCENTRATION_PENALTY_WEIGHT = 110
export const BALANCED_VOLATILITY_PENALTY_WEIGHT = 18
export const COVERAGE_FULL_REWARD_WEIGHT = 1000
export const COVERAGE_NEAR_REWARD_WEIGHT = 120
export const COVERAGE_CONCENTRATION_PENALTY_WEIGHT = 16
export const PAYOUT_PRIMARY_NET_RETURN_WEIGHT = 1000
export const PAYOUT_SECONDARY_NET_RETURN_WEIGHT = 1
export const PAYOUT_CONCENTRATION_PENALTY_WEIGHT = 12

export type OutcomeMetrics = {
  grossPayout: number
  expectedReturn: number
  netSingleHitReturn: number
}

export type PortfolioMetrics = {
  fullCoverageCount: number
  nearCoverageCount: number
  maxNetSingleHitReturn: number
  secondBestNetSingleHitReturn: number
  maxConcentrationRatio: number
  expectedNetReturn: number
  payoutVolatility: number
  probabilityAlignmentScore: number
  outcomeMetrics: OutcomeMetrics[]
}

export function getNetSingleHitReturn(shares: number, odds: number, principal: number) {
  return shares * odds * SHARE_COST_YUAN - principal
}

// 先把一个分配方案展开成统一指标，再由不同策略各自打分。
export function evaluatePortfolio(
  allocations: number[],
  oddsValues: number[],
  principal: number,
  probabilities: number[]
): PortfolioMetrics {
  const totalShares = getTotalAllocatedShares(allocations)
  const outcomeMetrics = allocations.map((shares, index) => {
    const grossPayout = shares * oddsValues[index] * SHARE_COST_YUAN
    return {
      grossPayout,
      expectedReturn: grossPayout,
      netSingleHitReturn: grossPayout - principal
    }
  })

  const fullCoverageCount = outcomeMetrics.filter((item) => item.expectedReturn >= principal).length
  const nearCoverageCount = outcomeMetrics.filter(
    (item) => item.expectedReturn >= principal * NEAR_COVERAGE_THRESHOLD_RATIO
  ).length
  const sortedNetReturns = outcomeMetrics
    .map((item) => item.netSingleHitReturn)
    .sort((left, right) => right - left)
  const expectedNetReturn = outcomeMetrics.reduce(
    (sum, item, index) => sum + item.netSingleHitReturn * probabilities[index],
    0
  )
  const payoutVariance = outcomeMetrics.reduce((sum, item, index) => {
    const diff = item.netSingleHitReturn - expectedNetReturn
    return sum + probabilities[index] * diff * diff
  }, 0)
  // 这里衡量的不是“是否继续向高概率结果集中”，
  // 而是当前分配比例与概率分布本身有多接近。
  const probabilityAlignmentScore =
    totalShares > 0
      ? 1 -
        Math.min(
          2,
          allocations.reduce((sum, shares, index) => {
            const allocationRatio = shares / totalShares
            return sum + Math.abs(allocationRatio - probabilities[index])
          }, 0)
        ) /
          2
      : 0

  return {
    fullCoverageCount,
    nearCoverageCount,
    maxNetSingleHitReturn: sortedNetReturns[0] ?? -principal,
    secondBestNetSingleHitReturn: sortedNetReturns[1] ?? -principal,
    maxConcentrationRatio: getMaxConcentrationRatio(allocations),
    expectedNetReturn,
    payoutVolatility: Math.sqrt(payoutVariance),
    probabilityAlignmentScore,
    outcomeMetrics
  }
}

export function getCoverageMetrics(metrics: PortfolioMetrics) {
  return {
    fullCoverageCount: metrics.fullCoverageCount,
    nearCoverageCount: metrics.nearCoverageCount
  }
}

export function scoreCoverageCandidate(metrics: PortfolioMetrics) {
  return (
    metrics.fullCoverageCount * COVERAGE_FULL_REWARD_WEIGHT +
    metrics.nearCoverageCount * COVERAGE_NEAR_REWARD_WEIGHT -
    metrics.maxConcentrationRatio * COVERAGE_CONCENTRATION_PENALTY_WEIGHT
  )
}

export function scoreBalancedCandidate(metrics: PortfolioMetrics) {
  // balanced 第一版明确拆成四项：
  // coverage 奖励、概率贴合奖励、集中度惩罚、波动惩罚。
  const coverageTerm =
    metrics.fullCoverageCount + metrics.nearCoverageCount * NEAR_COVERAGE_THRESHOLD_RATIO
  const probabilityAlignmentTerm = metrics.probabilityAlignmentScore
  const concentrationPenaltyTerm = metrics.maxConcentrationRatio
  const volatilityPenaltyTerm = metrics.payoutVolatility

  return (
    coverageTerm * BALANCED_COVERAGE_REWARD_WEIGHT +
    probabilityAlignmentTerm * BALANCED_PROBABILITY_ALIGNMENT_WEIGHT -
    concentrationPenaltyTerm * BALANCED_CONCENTRATION_PENALTY_WEIGHT -
    volatilityPenaltyTerm * BALANCED_VOLATILITY_PENALTY_WEIGHT
  )
}

export function scorePayoutCandidate(metrics: PortfolioMetrics) {
  // payout 优先看的不是 gross payout，而是命中后的净收益上限。
  return (
    metrics.maxNetSingleHitReturn * PAYOUT_PRIMARY_NET_RETURN_WEIGHT +
    metrics.secondBestNetSingleHitReturn * PAYOUT_SECONDARY_NET_RETURN_WEIGHT -
    metrics.maxConcentrationRatio * PAYOUT_CONCENTRATION_PENALTY_WEIGHT
  )
}

export function scoreExpectedCandidate(metrics: PortfolioMetrics) {
  return metrics.expectedNetReturn
}
