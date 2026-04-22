export const SHARE_COST_YUAN = 2

export type GreedyAllocationOptions = {
  allocations: number[]
  sharesLeft: number
  totalShares: number
  minStakeUnit: number
  maxConcentrationRatio: number
  scoreCandidate: (candidateIndex: number, candidateAllocations: number[]) => number
}

// 页面预算按 2 元 / 股换算成算法内部股数。
export function principalToTotalShares(principal: number, shareCost = SHARE_COST_YUAN) {
  return Math.max(0, Math.floor(principal / shareCost))
}

export function createMinimumAllocations(outcomeCount: number, minStakeUnit: number) {
  return new Array(outcomeCount).fill(minStakeUnit)
}

export function getTotalAllocatedShares(allocations: number[]) {
  return allocations.reduce((sum, item) => sum + item, 0)
}

export function getMaxConcentrationRatio(allocations: number[]) {
  const totalShares = getTotalAllocatedShares(allocations)
  if (totalShares <= 0) {
    return 0
  }

  return Math.max(...allocations) / totalShares
}

export function getDynamicShareLimit(
  totalShares: number,
  maxConcentrationRatio: number,
  currentShares: number,
  minStakeUnit: number
) {
  // 动态上限允许当前已经超过理论比例上限的档位“原地保留”，
  // 但不再继续加码，避免整数分配时把已有结果硬削回去。
  const configuredLimit = Math.max(minStakeUnit, Math.floor(totalShares * maxConcentrationRatio))
  return Math.max(configuredLimit, currentShares)
}

// 统一约束层只负责“在允许范围内怎么加 1 股”，
// 不关心当前是 coverage / balanced / payout / expected。
export function runGreedyAllocation({
  allocations,
  sharesLeft,
  totalShares,
  minStakeUnit,
  maxConcentrationRatio,
  scoreCandidate
}: GreedyAllocationOptions) {
  const nextAllocations = [...allocations]
  let remainingShares = sharesLeft

  while (remainingShares >= minStakeUnit) {
    let bestIndex = -1
    let bestScore = -Infinity

    nextAllocations.forEach((currentShares, index) => {
      const dynamicLimit = getDynamicShareLimit(totalShares, maxConcentrationRatio, currentShares, minStakeUnit)
      if (currentShares + minStakeUnit > dynamicLimit) {
        return
      }

      const candidate = [...nextAllocations]
      candidate[index] += minStakeUnit
      const score = scoreCandidate(index, candidate)

      if (score > bestScore) {
        bestScore = score
        bestIndex = index
      }
    })

    if (bestIndex === -1) {
      break
    }

    nextAllocations[bestIndex] += minStakeUnit
    remainingShares -= minStakeUnit
  }

  return nextAllocations
}
