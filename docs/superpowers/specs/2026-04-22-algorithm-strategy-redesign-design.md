# Algorithm Strategy Redesign Design

## Background

The current allocation algorithm is built from several heuristic stages:

1. low-odds protection
2. profitable-result coverage expansion
3. residual share redistribution

This structure is workable, but its optimization goal is not unified. Different parts of the algorithm are implicitly optimizing different things, which makes the final behavior harder to explain, tune, and trust.

The deeper issue is that the current strategy labels are also heuristic in nature. They describe style, but they do not map cleanly to a single mathematical objective. This becomes especially important if the next version aims to optimize return quality more explicitly.

## Problem Statement

The current implementation has four structural problems:

1. **No single optimization objective**
   Coverage count, low-odds protection, and residual allocation preference all influence the outcome, but no single objective governs the full plan.

2. **Strategy semantics are not mathematically crisp**
   The current `balanced / aggressive / all-in` distinction is mostly implemented through parameter shifts. This makes strategy behavior harder to reason about and harder to communicate to users.

3. **Probability usage is implicit and overloaded**
   The algorithm already uses odds-derived relative weights, but the system does not explicitly distinguish between:
   - bookmaker-implied relative probability
   - externally supplied model probability

4. **Recommendation output is too tightly tied to profitable-result count**
   The current recommendation text mainly reacts to the number of profitable outcomes, which is too narrow for a future strategy system centered on return quality, concentration, and risk.

## Goal

Define a unified algorithm framework that:

1. separates probability source from allocation strategy
2. separates optimization goal from operational constraints
3. provides mathematically coherent default strategies
4. keeps room for a future true expected-value strategy when custom probabilities exist

This round is design-only. It does not implement the redesign.

## Unified Framework

The redesigned algorithm should be organized into three explicit layers:

### 1. Probability Source Layer

This layer decides where the probability vector comes from.

Supported modes:

- `implied`
- `custom`

Responsibilities:

- produce one normalized probability vector across all outcome buckets
- remain independent from budget allocation rules
- make the provenance of probabilities explicit

### 2. Unified Return Model

This layer computes a common set of metrics for each outcome bucket.

For each outcome, the algorithm should be able to derive:

- input odds
- selected probability
- payout per unit stake
- expected return per unit stake
- contribution to concentration / dispersion analysis

This creates one shared evaluation basis that every strategy can use.

### 3. Constraint Layer

This layer applies operational constraints after the strategy objective is defined.

Constraints to keep explicit and independent:

- total budget
- 2 yuan per share
- minimum 1 share per selected outcome
- maximum concentration cap
- integer share allocation

The core principle is: strategy decides **what to optimize**, constraints decide **what is legally or operationally allowed**.

## Probability Source Design

### `implied`

Default mode uses odds to derive relative implied probability.

Important clarification:

- implied probability is only a relative probability approximation inferred from odds
- it is not an independent prediction model
- it must not be interpreted as the true real-world match probability

This mode is appropriate as the default because it needs no extra data source and matches the current product input model.

### `custom`

Future mode allows externally supplied probabilities.

Examples:

- user-adjusted probability view
- model-estimated probability
- historical or statistical probability source

This mode enables true expected-value optimization because probability and bookmaker price are no longer derived from the same underlying source.

## Default Strategy Design

Under the default `implied` probability mode, the system should not expose a strategy called `expected`.

Reason:

If probability is directly inferred from odds, then unit expected value tends to collapse toward a near-constant relationship across outcomes. In that case, an `expected` strategy name would imply a mathematical distinction that the default inputs do not actually support.

Therefore, the default strategy set should be:

### `coverage`

Core objective:

- maximize the number of outcomes that reach meaningful positive or near-positive coverage

Interpretation:

- favors broader profitable-result coverage
- useful for users who prefer wider return protection across result buckets

### `balanced`

Core objective:

- balance coverage, implied probability preference, and volatility

Interpretation:

- seeks a compromise between broad coverage and excessive concentration
- should become the default general-purpose strategy

### `payout`

Core objective:

- maximize the upper bound of single-hit payout

Interpretation:

- accepts higher concentration and higher volatility
- favors stronger upside when the selected high-return outcomes hit

## Conditional Strategy Design

### `expected`

This strategy should only be enabled when `custom` probability is available and valid.

Core objective:

- maximize total expected return under the active constraints

Reason for conditional enablement:

- under `implied` probability, expected value optimization is not meaningfully separable from odds-derived approximation
- under `custom` probability, expected value becomes a real optimization target with clear mathematical meaning

This is the key boundary of the redesign:

- `expected` is **not** a default strategy
- `expected` becomes valid only when the probability source is no longer just bookmaker-implied approximation

## Recommendation Model Redesign Principles

The recommendation layer should no longer depend mainly on profitable-result count.

Instead, it should be structured around:

- coverage level
- concentration level
- maximum single-hit payout
- risk level
- expected return quality when `custom` probability exists

Recommendation text should be aligned to strategy semantics:

- `coverage` should emphasize breadth of return protection
- `balanced` should emphasize trade-off quality and moderate concentration
- `payout` should emphasize higher upside with higher risk
- `expected` should emphasize expected return only when mathematically justified by `custom` probability

## UI Naming Boundary

This design document defines algorithm semantics first.

It does **not** require immediate UI renaming in the same round.

Implementation-phase decision:

- UI strategy labels may remain unchanged temporarily while the algorithm design is finalized
- button copy, recommendation copy, and user-facing naming can be revised in the later implementation stage

This keeps design validation separate from UI migration work.

## Implementation Boundary

This round is limited to design definition.

Not included in this round:

- no code implementation
- no direct strategy renaming in UI
- no recommendation copy rewrite in production code
- no changes to existing page interactions
- no changes to `pickCoverageIndexes`
- no parameter-only patch pretending to be the redesign

The next step after approval should be an implementation plan that converts this structure into code safely and incrementally.

## Acceptance Criteria For This Design

1. The redesign explains why the current heuristic system is insufficient.
2. The new framework explicitly separates probability source, return model, and constraints.
3. The document clearly states why `expected` is not enabled by default.
4. The default strategy set is defined as `coverage / balanced / payout`.
5. The document clearly states that `expected` requires valid `custom` probability input.
6. The recommendation layer redesign principles are aligned to the new semantics.
7. The implementation boundary is explicit: design now, implementation later.
