# Disclaimer Banner Design

## Background

The homepage currently presents betting-related calculation capabilities without an explicit disclaimer in the first screen area. We want a minimal, visible disclaimer that clarifies the tool is only for auxiliary calculation and does not constitute betting advice.

## Goal

Add a single disclaimer line inside the existing `hero-card` on the homepage without changing page structure, interaction flow, or algorithm behavior.

## Scope

### In Scope

- Add one disclaimer text node to `src/pages/index/index.vue`
- Add matching lightweight styles to `src/pages/index/index.scss`
- Keep the disclaimer inside the existing `hero-card`

### Out of Scope

- No algorithm changes
- No page layout refactor
- No new components
- No changes to interaction flow

## Placement

The disclaimer will be rendered inside the existing `hero-card`, below the title/subtitle area and near the meta information, so it is visible on first screen but does not interrupt the main form flow.

## Copy

Recommended copy:

`本工具仅用于赔率分配辅助与结果测算，不构成任何投注建议，请理性判断并谨慎参与。`

## Styling

- Use a low-interference presentation that matches the existing hero area
- Keep the text readable on both desktop and mobile
- Avoid warning-red or alarm-heavy styling
- Prefer a subtle bordered or tinted block that visually reads as guidance, not an error

## Acceptance Criteria

1. The disclaimer appears in the homepage `hero-card`
2. The text is visible on desktop and mobile
3. No algorithm or interaction behavior changes
4. Only `src/pages/index/index.vue` and `src/pages/index/index.scss` are modified for implementation
