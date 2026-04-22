# Taro Project Stability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore project-level verification signal, block invalid remote odds before they reach the UI, and clean high-signal config and lint noise without changing the page structure or core algorithm.

**Architecture:** Keep the current Taro page structure intact and make focused changes at the toolchain boundary, request boundary, and config boundary. Use one tiny helper for remote odds validation so the page logic stays readable without turning this round into a refactor.

**Tech Stack:** Taro 4, Vue 3, TypeScript, ESLint, NutUI

---

## File Map

- Modify: `tsconfig.json`
  Purpose: narrow TypeScript noise so project-code checking is usable.
- Modify: `.eslintrc`
  Purpose: add a targeted page-entry exemption for `src/pages/**/index.vue`.
- Modify: `config/index.ts`
  Purpose: remove unused declarations and dead config noise while preserving current behavior.
- Modify: `src/app.ts`
  Purpose: remove the current lint-only unused parameter.
- Modify: `src/pages/index/index.vue`
  Purpose: keep the page structure but add request-boundary validation and small helper usage.
- Create: `src/utils/matchOdds.ts`
  Purpose: provide a tiny reusable helper to validate and normalize API odds payloads.

## Task 1: Stabilize TypeScript Checking

**Files:**
- Modify: `tsconfig.json`

- [ ] **Step 1: Update the compiler options to reduce external declaration noise**

Apply this shape to `compilerOptions` while preserving existing runtime-facing intent:

```json
{
  "compilerOptions": {
    "target": "es2017",
    "module": "commonjs",
    "moduleResolution": "node",
    "jsx": "preserve",
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,
    "allowJs": true,
    "baseUrl": ".",
    "rootDir": ".",
    "outDir": "lib",
    "sourceMap": true,
    "removeComments": false,
    "preserveConstEnums": true,
    "experimentalDecorators": true,
    "skipLibCheck": true,
    "types": []
  }
}
```

- [ ] **Step 2: Run TypeScript verification**

Run: `npx tsc -p tsconfig.json --noEmit`

Expected:
- the command completes without the previous `@tarojs/*` and `@nutui/*` declaration flood
- any remaining errors point at project files

- [ ] **Step 3: If project-code errors remain, fix only the ones introduced by this tighter verification loop**

Keep scope small. Examples of acceptable fixes:

```ts
const App = createApp({
  onShow() {}
})
```

Do not broaden this into a strict-mode migration.

- [ ] **Step 4: Re-run TypeScript verification**

Run: `npx tsc -p tsconfig.json --noEmit`

Expected: exit code `0`

- [ ] **Step 5: Commit**

```bash
git add tsconfig.json src/app.ts
git commit -m "build: stabilize project TypeScript checks"
```

## Task 2: Block Invalid Remote Odds at the Request Boundary

**Files:**
- Create: `src/utils/matchOdds.ts`
- Modify: `src/pages/index/index.vue`

- [ ] **Step 1: Write the helper contract before wiring it into the page**

Create `src/utils/matchOdds.ts` with a focused helper shape:

```ts
import type { MatchOdds } from './lotteryCalculator'

const MIN_ODDS = 1.3

export function parseRemoteMatchOdds(input: Partial<Record<keyof MatchOdds, unknown>> | null | undefined): MatchOdds | null {
  if (!input) {
    return null
  }

  const keys: Array<keyof MatchOdds> = ['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7']
  const normalized = {} as MatchOdds

  for (const key of keys) {
    const value = Number(input[key])
    if (!Number.isFinite(value) || value < MIN_ODDS) {
      return null
    }
    normalized[key] = value
  }

  return normalized
}
```

- [ ] **Step 2: Replace inline `Number(...)` mapping in the page with validated parsing**

In `src/pages/index/index.vue`, switch from direct mapping:

```ts
ttg: {
  s0: Number(match.ttg?.s0),
  s1: Number(match.ttg?.s1),
  s2: Number(match.ttg?.s2),
  s3: Number(match.ttg?.s3),
  s4: Number(match.ttg?.s4),
  s5: Number(match.ttg?.s5),
  s6: Number(match.ttg?.s6),
  s7: Number(match.ttg?.s7)
}
```

to guarded parsing:

```ts
const parsedOdds = parseRemoteMatchOdds(match.ttg)
if (!parsedOdds) {
  return
}

dynamicOptions.push({
  label: matchName,
  displayLabel: formatMatchOptionLabel(matchName, presentation.leagueName, presentation.flag),
  leagueName: presentation.leagueName,
  flag: presentation.flag,
  value: `week${weekIndex}-${matchIndex}`,
  ttg: parsedOdds
})
```

- [ ] **Step 3: Prevent empty week headers from being rendered**

Refactor the week-group building logic so the group header is only pushed when there is at least one valid child match:

```ts
const weekOptions: MatchOption[] = []

weekGroup.subMatchList?.forEach((match, matchIndex) => {
  const parsedOdds = parseRemoteMatchOdds(match.ttg)
  if (!parsedOdds) {
    return
  }

  weekOptions.push({
    label: matchName,
    displayLabel: formatMatchOptionLabel(matchName, presentation.leagueName, presentation.flag),
    leagueName: presentation.leagueName,
    flag: presentation.flag,
    value: `week${weekIndex}-${matchIndex}`,
    ttg: parsedOdds
  })
})

if (weekOptions.length > 0) {
  dynamicOptions.push({
    label: weekLabel,
    value: `group-${weekIndex}`,
    ttg: { ...DEFAULT_ODDS },
    disabled: true
  })
  dynamicOptions.push(...weekOptions)
}
```

- [ ] **Step 4: Keep the existing full-request fallback behavior unchanged**

Preserve this shape in the `catch` path:

```ts
options.value = [
  {
    label: '自定义',
    displayLabel: '⚙️ 自定义赔率',
    leagueName: '手动输入',
    flag: '⚙️',
    value: 'none',
    ttg: { ...DEFAULT_ODDS }
  }
]
showToast('比赛列表获取失败，已切换为手动输入', 'error')
```

- [ ] **Step 5: Run TypeScript verification again**

Run: `npx tsc -p tsconfig.json --noEmit`

Expected: exit code `0`

- [ ] **Step 6: Commit**

```bash
git add src/utils/matchOdds.ts src/pages/index/index.vue
git commit -m "fix: validate remote match odds before rendering"
```

## Task 3: Clean High-Signal Lint and Config Noise

**Files:**
- Modify: `.eslintrc`
- Modify: `config/index.ts`
- Modify: `src/app.ts`

- [ ] **Step 1: Remove the current lint-only unused parameter**

Update `src/app.ts`:

```ts
const App = createApp({
  onShow() {}
})
```

- [ ] **Step 2: Remove unused config declarations without changing behavior**

In `config/index.ts`, remove:

- unused `TsconfigPathsPlugin` import
- unused `command` and `mode` callback parameters
- empty `defineConstants`, `copy.patterns`, and `copy.options` blocks if they add no value

Target shape:

```ts
import { defineConfig, type UserConfigExport } from '@tarojs/cli'
import devConfig from './dev'
import prodConfig from './prod'
import NutUIResolver from '@nutui/auto-import-resolver'
import Components from 'unplugin-vue-components/vite'

export default defineConfig<'vite'>(async (merge) => {
  const baseConfig: UserConfigExport<'vite'> = {
    projectName: 'SoccerLotteryForecasterTaro',
    date: '2026-4-21',
    // ...
  }

  if (process.env.NODE_ENV === 'development') {
    return merge({}, baseConfig, devConfig)
  }

  return merge({}, baseConfig, prodConfig)
})
```

- [ ] **Step 3: Add a targeted ESLint override for Taro page entry files**

Extend `.eslintrc` with an override instead of weakening the rule globally:

```json
{
  "overrides": [
    {
      "files": ["src/pages/**/index.vue"],
      "rules": {
        "vue/multi-word-component-names": "off"
      }
    }
  ]
}
```

- [ ] **Step 4: Run lint verification**

Run: `npx eslint src config --ext .ts,.vue`

Expected:
- the previous template-noise errors are gone
- output is clean, or any remaining issue is a real project issue worth keeping

- [ ] **Step 5: Re-run TypeScript verification to catch config regressions**

Run: `npx tsc -p tsconfig.json --noEmit`

Expected: exit code `0`

- [ ] **Step 6: Commit**

```bash
git add .eslintrc config/index.ts src/app.ts
git commit -m "chore: clean project lint and config noise"
```

## Task 4: Final Verification and Acceptance Check

**Files:**
- No new files

- [ ] **Step 1: Run the final TypeScript acceptance command**

Run: `npx tsc -p tsconfig.json --noEmit`

Expected: exit code `0`

- [ ] **Step 2: Run the final ESLint acceptance command**

Run: `npx eslint src config --ext .ts,.vue`

Expected: exit code `0`

- [ ] **Step 3: Re-check the request-boundary behavior in code**

Confirm these conditions are true in `src/pages/index/index.vue` and `src/utils/matchOdds.ts`:

- invalid `ttg` values return `null`
- invalid matches are skipped
- empty week groups are not pushed
- request failure still falls back to manual input

- [ ] **Step 4: Confirm scope remained stable**

Check that none of these were changed:

- `calculatePlan`
- `pickCoverageIndexes`
- multi-platform package scripts
- page visual structure
- large-scale page file extraction

- [ ] **Step 5: Commit final acceptance checkpoint if needed**

```bash
git status --short
```

Expected:
- clean working tree, or only intentional untracked artifacts unrelated to this work
*** End Patch
天天中彩票 to=functions.apply_patch code was 23353 bytes long; no output truncated? need see result. There is no result shown maybe because omitted? Wait. Let’s check.անր
