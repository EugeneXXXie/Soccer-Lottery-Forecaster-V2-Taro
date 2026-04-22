# Algorithm Strategy Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current heuristic strategy model with a unified probability-source / return-model / constraint-layer architecture, while keeping default strategy semantics coherent under implied probability and reserving true expected-value optimization for valid custom probability inputs.

**Architecture:** The implementation should introduce a strategy engine that separates probability sourcing, per-outcome return metrics, and allocation constraints. Default user-facing behavior should move toward `coverage / balanced / payout`, while a compatibility layer preserves the existing internal and UI transition path from `balanced / aggressive / all-in`.

**Tech Stack:** TypeScript, Taro, Vue 3, existing `src/utils/lotteryCalculator.ts` algorithm module

---

## File Map

- Modify: `src/utils/lotteryCalculator.ts`
  Purpose: migrate core algorithm types, strategy keys, scoring rules, and recommendation logic into the new framework.
- Create: `src/utils/probabilityModel.ts`
  Purpose: centralize implied/custom probability input normalization and validation.
- Create: `src/utils/strategyObjectives.ts`
  Purpose: define executable scoring objectives for `coverage / balanced / payout / expected`.
- Create: `src/utils/allocationConstraints.ts`
  Purpose: isolate budget, share unit, concentration cap, and integerization rules from strategy semantics.
- Modify: `src/pages/index/index.vue`
  Purpose: consume migrated strategy keys through a compatibility layer first, then later opt into new naming when UI migration is approved.
- Optional later modify: `src/pages/index/index.scss`
  Purpose: only if UI naming changes are explicitly included in implementation, not required in the first migration task.

## Planning Decisions Locked In

### 1. Default Strategy Set

Default strategy semantics for the redesigned engine must be:

- `coverage`
- `balanced`
- `payout`

`expected` is not a default strategy and must not be enabled under implied probability.

### 2. Probability Modes

Supported probability source modes must be:

- `implied`
- `custom`

The engine must treat `implied` as bookmaker-derived relative probability approximation, not as a prediction model.

### 3. Compatibility Requirement

The existing codebase currently uses:

- `balanced`
- `aggressive`
- `all-in`

Implementation must include a migration layer so the core engine can adopt the new semantics before UI naming is fully switched over.

## A. Executable Goal Definitions For Default Strategies

### Coverage Objective

**Definition**

`coverage` optimizes the number of outcomes that reach a configurable protection threshold under the active constraints.

**Planning decision**

For implementation, the protected threshold should not be exact break-even only. It should use a two-tier scoring model:

- full coverage target: `expectedReturn >= principal`
- near coverage target: `expectedReturn >= principal * 0.95`

**Why**

If coverage uses only strict break-even, the strategy becomes too brittle around integer share rounding. A near-break-even band makes the objective implementable and more stable under the 2-yuan share granularity.

**Executable scoring rule**

Implementation should score outcomes in this order:

1. count of full-coverage outcomes
2. count of near-coverage outcomes
3. lower concentration after coverage targets are satisfied

**Required implementation note**

The near-break-even threshold must be encoded as a named constant, not hardcoded inside a loop.

### Balanced Objective

**Definition**

`balanced` optimizes a weighted trade-off between:

- coverage quality
- implied probability preference
- concentration control
- payout volatility restraint

**Planning decision**

Implementation should compute a combined score per allocation candidate using four explicit terms:

1. coverage term
2. probability-alignment term
3. concentration penalty term
4. volatility penalty term

**Executable scoring direction**

- reward outcomes that improve full or near coverage
- reward outcomes with higher normalized probability under the current probability mode
- penalize allocations that push a single outcome above a defined concentration threshold
- penalize allocations that materially increase payout dispersion without proportionate coverage benefit

**Required implementation note**

Balanced must not be implemented as “coverage plus a few magic tweaks.” The score components need named variables so the strategy remains explainable and tunable.

### Payout Objective

**Definition**

`payout` optimizes the upper bound of realized upside when one selected outcome hits.

**Planning decision**

The strategy should optimize **maximum net single-hit return**, not raw gross payout.

Use:

- gross payout: `shares * odds * 2`
- net single-hit return: `gross payout - principal`

**Why**

Gross payout alone can be visually large while still being misleading relative to total budget. Net upside is the clearer optimization target for this strategy.

**Executable scoring rule**

Implementation should maximize:

1. maximum net single-hit return
2. secondary tie-breaker: next-best upside among remaining outcomes
3. only then apply concentration constraints

**Required implementation note**

Payout remains high-volatility by design, but still must pass through the shared constraint layer.

## B. Custom Probability Input Contract

### Input Shape

Implementation should support:

```ts
type ProbabilityMode = 'implied' | 'custom'

type CustomProbabilityInput = number[]
```

Future-friendly wrapper:

```ts
type ProbabilitySource =
  | { mode: 'implied' }
  | { mode: 'custom'; values: number[] }
```

### Length Requirement

- length must be exactly `8`
- each index maps to the fixed outcome buckets `s0` through `s7`

### Invalid Values

The following must be treated as invalid in `custom` mode:

- `null`
- `undefined`
- `NaN`
- `Infinity`
- negative numbers

Zero should be allowed only if the full vector is otherwise valid and at least one positive value exists.

**Why**

Zero can represent an intentionally impossible or excluded outcome in a modeled probability distribution. Negative and non-finite values cannot.

### Normalization Rule

Implementation should automatically normalize valid positive-or-zero custom probabilities so the final vector sums to `1`.

### Sum Handling

If the raw custom array sum is:

- `<= 0`: invalid
- `> 0`: normalize to sum `1`

This means the caller is not required to pre-normalize probabilities manually.

### Fallback Rule

If `custom` probability input is invalid:

- the engine must fall back to `implied`
- `expected` must be disabled

**Planning decision**

Do not hard-fail the overall calculation flow for invalid custom probability in the first implementation pass. Fall back safely and clearly.

### User-Facing Behavior

First implementation pass does not need to expose editable custom probability UI. The engine contract should support it internally first.

## C. Old-To-New Strategy Migration Plan

### Internal Key Migration

Implementation should introduce new canonical strategy keys:

```ts
type CanonicalStrategyKey = 'coverage' | 'balanced' | 'payout' | 'expected'
```

Current legacy keys:

```ts
type LegacyStrategyKey = 'balanced' | 'aggressive' | 'all-in'
```

### Compatibility Layer

Implementation must include an explicit temporary mapping layer:

```ts
const LEGACY_TO_CANONICAL_STRATEGY: Record<LegacyStrategyKey, CanonicalStrategyKey> = {
  balanced: 'coverage',
  aggressive: 'balanced',
  'all-in': 'payout'
}
```

**Planning decision**

This is the migration baseline for implementation planning. It preserves current three-button UX while allowing the engine internals to move to the new semantics.

### UI Naming Scope

UI button labels do not need to change in the first implementation pass unless explicitly approved.

This means:

- engine internals may switch first
- UI labels may remain temporarily mapped to legacy names
- direct user-facing renaming can be a later follow-up step

### Recommendation Copy Sync Timing

Recommendation logic and strategy semantics should be synchronized in two phases:

1. first implementation pass:
   - update recommendation internals to use canonical strategy meaning
   - keep user-facing copy conservative if UI naming is still legacy

2. later UI migration pass:
   - rename strategy labels
   - rewrite recommendation copy to align exactly with final public semantics

**Planning decision**

Do not couple engine migration and full UI copy migration into one forced step.

## Task 1: Introduce Probability Source Model

**Files:**
- Create: `src/utils/probabilityModel.ts`
- Modify: `src/utils/lotteryCalculator.ts`
- Test: `tests` path to be chosen based on repo test setup once implementation starts

- [ ] **Step 1: Add probability source types**

Define:

```ts
export type ProbabilityMode = 'implied' | 'custom'

export type ProbabilitySource =
  | { mode: 'implied' }
  | { mode: 'custom'; values: number[] }
```

- [ ] **Step 2: Add custom probability validation and normalization helpers**

Implementation must support:

```ts
export function normalizeCustomProbabilities(values: number[]): number[] | null
export function buildImpliedProbabilities(oddsValues: number[], power?: number): number[]
export function resolveProbabilityVector(
  oddsValues: number[],
  source: ProbabilitySource
): { mode: 'implied' | 'custom'; values: number[]; customValid: boolean }
```

- [ ] **Step 3: Define fallback behavior**

When custom input is invalid:

- resolve to implied probabilities
- return `customValid: false`

- [ ] **Step 4: Verify implementation behavior**

Implementation-phase verification must include:

- invalid custom length fails normalization
- negative values fail normalization
- zero-sum vectors fail normalization
- non-normalized valid vectors normalize automatically
- invalid custom source falls back to implied

## Task 2: Introduce Canonical Strategy Objectives

**Files:**
- Create: `src/utils/strategyObjectives.ts`
- Modify: `src/utils/lotteryCalculator.ts`

- [ ] **Step 1: Add canonical strategy types**

Define:

```ts
export type CanonicalStrategyKey = 'coverage' | 'balanced' | 'payout' | 'expected'
```

- [ ] **Step 2: Encode executable objective helpers**

Implementation must expose helpers for:

```ts
export function getCoverageMetrics(...)
export function scoreBalancedCandidate(...)
export function getNetSingleHitReturn(...)
```

These helpers must use named constants for:

- near-break-even threshold
- concentration penalty weights
- volatility penalty weights

- [ ] **Step 3: Restrict expected strategy availability**

Implementation must explicitly reject or bypass `expected` when `customValid` is false.

- [ ] **Step 4: Verify strategy semantics**

Implementation-phase tests must prove:

- coverage favors more protected outcomes
- balanced penalizes concentration relative to coverage-only behavior
- payout favors larger maximum net upside
- expected is unavailable without valid custom probability

## Task 3: Split Constraint Layer From Strategy Logic

**Files:**
- Create: `src/utils/allocationConstraints.ts`
- Modify: `src/utils/lotteryCalculator.ts`

- [ ] **Step 1: Move shared operational constraints into one module**

Extract helpers for:

- budget-to-shares conversion
- minimum share enforcement
- concentration cap enforcement
- integerization / final share rounding

- [ ] **Step 2: Ensure constraints are strategy-agnostic**

Constraint helpers must not know whether the caller is coverage, balanced, payout, or expected.

- [ ] **Step 3: Verify no semantic leakage**

Implementation-phase review must confirm:

- strategy modules optimize scoring
- constraint module enforces allowed allocation shape

## Task 4: Add Legacy-To-Canonical Strategy Mapping

**Files:**
- Modify: `src/utils/lotteryCalculator.ts`
- Modify: `src/pages/index/index.vue`

- [ ] **Step 1: Add temporary mapping layer**

Define:

```ts
const LEGACY_TO_CANONICAL_STRATEGY = {
  balanced: 'coverage',
  aggressive: 'balanced',
  'all-in': 'payout'
} as const
```

- [ ] **Step 2: Route existing UI strategy selection through mapping**

Current UI may remain on existing labels, but calculation should resolve through canonical strategy semantics internally.

- [ ] **Step 3: Defer direct UI renaming**

Do not change button labels or user-facing naming in this task unless implementation scope is later expanded.

## Task 5: Redesign Recommendation Inputs

**Files:**
- Modify: `src/utils/lotteryCalculator.ts`

- [ ] **Step 1: Replace profitable-count-only recommendation basis**

Recommendation inputs should include:

- coverage level
- concentration level
- maximum net single-hit return
- risk classification
- expected return quality only when custom probability is active

- [ ] **Step 2: Keep user-facing copy migration decoupled**

If UI naming is still legacy, recommendation output should remain semantically accurate without forcing final public copy renaming in the same change.

## Task 6: Verification And Migration Safety

**Files:**
- Modify as needed within the files above only

- [ ] **Step 1: Preserve non-goals**

Implementation must not:

- rewrite page layout
- force immediate UI label renaming
- expand into unrelated refactors

- [ ] **Step 2: Explicitly review old-vs-new behavior**

Implementation-phase verification should compare:

- legacy key routing
- canonical strategy resolution
- implied vs custom probability behavior

- [ ] **Step 3: Final implementation acceptance**

When implementation begins, the implementation-phase acceptance checklist must confirm:

- default strategies are `coverage / balanced / payout`
- `expected` only activates with valid custom probability
- invalid custom probability falls back to implied
- recommendation inputs no longer depend only on profitable-count

## Plan Coverage Summary

This implementation plan resolves the three planning gaps explicitly requested:

1. **Executable default strategy targets**
   Coverage, balanced, and payout are now translated into concrete scoring and optimization directions.

2. **Custom probability contract**
   Input shape, length, allowed values, normalization rules, and fallback behavior are now explicit.

3. **Legacy-to-new migration path**
   Internal canonical keys, temporary mapping, UI naming scope, and recommendation-sync timing are now defined.

## Boundary Reminder

This document is an implementation plan only.

It does not authorize immediate code changes by itself. The next step is choosing an execution mode for implementing this plan.
