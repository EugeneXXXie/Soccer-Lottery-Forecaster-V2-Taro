# Taro Project Stability Design

## Background

The current project is functional, but the developer experience is held back by tooling instability and a lack of defensive handling around external match data. The goal of this round is to improve correctness and maintainability with minimal behavioral change.

This design intentionally does not include a large page-level refactor. The homepage structure can be revisited after the toolchain and runtime safety issues are under control.

## Goals

1. Make TypeScript and ESLint usable for checking project code.
2. Prevent invalid odds data from flowing from the API into the form state and UI.
3. Clean up obvious config and lint noise that reduces signal during development.
4. Keep UI behavior and algorithm behavior effectively unchanged for valid data.

## Non-Goals

1. No large-scale split of `src/pages/index/index.vue`.
2. No algorithm redesign or performance tuning of combination search.
3. No removal of multi-platform Taro support from dependencies or scripts.
4. No redesign of page styling or interaction flow.

## Scope

This round covers four focused changes.

### 1. Toolchain Stabilization

- Update `tsconfig.json` so TypeScript checks can focus on project code instead of failing on third-party declaration issues.
- Keep the configuration aligned with the current Taro + Vue + TypeScript setup.
- Add only the minimum options needed to restore a practical local `tsc --noEmit` workflow.

Expected outcome:
- Project code can be type-checked with a stable command.
- Third-party library declaration noise no longer blocks local verification.

### 2. API Data Defense

- Validate odds data from the remote API before writing it into selectable match options.
- Reject or sanitize records with invalid `ttg` fields instead of letting `NaN` flow into form state.
- Fall back safely when a record is unusable, without breaking the rest of the list.

Expected outcome:
- Invalid remote odds do not appear in the UI as `"NaN"`.
- Errors are handled closer to the request boundary.

### 3. Config and Lint Cleanup

- Remove unused imports and obviously unused parameters that currently produce noise.
- Tidy config files where dead code or unused declarations reduce readability.
- Make the lint result reflect actionable issues instead of template leftovers.

Expected outcome:
- ESLint output is cleaner and more trustworthy.
- Project configuration is easier to read and maintain.

### 4. Small Homepage Hygiene Only

- Keep `src/pages/index/index.vue` as the main page file for this round.
- Allow only small extractions if they directly support the three goals above.
- Avoid structural churn that would increase review cost without fixing current blockers.

Expected outcome:
- The page remains familiar.
- Risk stays low while the highest-value issues are addressed first.

## Design Details

### TypeScript Configuration Strategy

The key issue is not just file inclusion range. The practical problem is that current project checks are overwhelmed by third-party declaration problems from the Taro and NutUI dependency surface. This round will treat that as a toolchain boundary problem.

Planned direction:

- Enable `skipLibCheck`.
- Preserve current project targeting and module behavior unless a change is required for verification stability.
- Avoid turning on stricter compiler options that would create a large unrelated cleanup wave.

This keeps the change focused on restoring signal, not broadening enforcement.

### Odds Validation Strategy

Remote match data will be normalized at the request boundary before it becomes a `MatchOption`.

Planned rules:

- Every `s0` through `s7` value must parse to a finite number.
- Parsed odds must satisfy the same basic lower-bound expectations already enforced by form validation.
- Records with invalid odds will be skipped instead of surfaced as editable-but-invalid entries.

If the entire request fails, the existing manual-entry fallback remains in place.

If only some matches are malformed, valid matches should still be shown.

### Lint and Config Cleanup Strategy

This round will clean high-signal noise only:

- unused parameter in `src/app.ts`
- unused imports or variables in Taro config
- rule noise that can be addressed without weakening meaningful checks

For `vue/multi-word-component-names`, the preferred fix is to apply a targeted exception or naming approach appropriate for page-entry files, rather than treating page filenames as architectural problems.

## Error Handling

1. Remote request failure keeps the existing manual-entry fallback behavior.
2. Malformed match records are dropped instead of poisoning page state.
3. Validation failures continue to use the current toast-driven UX unless a small change is necessary for clarity.

## Verification Plan

The implementation will only be considered complete after fresh verification with:

1. `npm exec tsc --noEmit`
2. `npx eslint src config --ext .ts,.vue`

If a command still fails because of unrelated external package behavior, the final report must clearly separate remaining external issues from project-code issues.

## Risks

1. `skipLibCheck` reduces visibility into third-party declaration defects.
   This is acceptable here because the immediate goal is restoring project-level signal.

2. Filtering malformed match data may reduce the number of visible options.
   This is acceptable because showing fewer valid options is safer than showing corrupt odds.

3. Lint rule adjustment could accidentally hide useful feedback if done too broadly.
   This is why the design prefers targeted cleanup over global rule weakening.

## Implementation Order

1. Stabilize TypeScript checking.
2. Add request-layer odds validation and sanitization.
3. Clean config and lint noise.
4. Re-run verification commands and confirm remaining output.

## Acceptance Criteria

1. Project verification commands can run with output focused on project code.
2. Remote invalid odds no longer render into inputs as `"NaN"`.
3. Obvious unused code/config noise is removed or intentionally handled.
4. No deliberate change is made to the core allocation algorithm.
