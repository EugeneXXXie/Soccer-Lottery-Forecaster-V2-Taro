import { GOAL_KEYS, MIN_VALID_ODDS } from './lotteryCalculator'
import type { MatchOdds } from './lotteryCalculator'

export function parseRemoteMatchOdds(
  input: Partial<Record<keyof MatchOdds, unknown>> | null | undefined
): MatchOdds | null {
  if (!input) {
    return null
  }

  const normalized = {} as MatchOdds

  for (const key of GOAL_KEYS) {
    const value = Number(input[key])
    if (!Number.isFinite(value) || value < MIN_VALID_ODDS) {
      return null
    }
    normalized[key] = value
  }

  return normalized
}
