# BlipIt Legends — Project Context

> AI-optimized implementation rules for `maniator/blipit-legends`. Loaded as persistent facts by all bmad agents. Contains unobvious details that LLMs must be reminded of.

## Project Identity

- **Name:** BlipIt Legends (also called "Ballgame" internally)
- **Live URL:** https://blipit.net/
- **Type:** Self-playing baseball simulator PWA — fully offline-capable, no backend
- **Stack:** React 19 · TypeScript · Vite v7 · Vitest · Playwright · styled-components v6 · React Router v7 · RxDB v17 (IndexedDB) · Yarn Berry v4 · Node 24

## Critical Code Rules

### Never Break These

- **Seeded PRNG is sacred.** All randomness flows through `src/shared/utils/rng.ts` (mulberry32). Never use `Math.random()`. Same seed + same teams = identical play-by-play.
- **RxDB schema changes MUST bump `version` + add `migrationStrategies`.** Same-version schema changes cause DB6 hash mismatch for all users, blocking app startup.
- **Module cycle-free order is enforced:** `strategy → advanceRunners → gameOver → playerOut → hitBall → buntAttempt → playerActions → reducer`. No module may import from a module later in this chain.
- **Never import `GameContext` directly** — always use the `useGameContext()` hook from `@feat/gameplay/context/index`.
- **Service worker must NOT use RxDB** — RxDB is window-only.

### Import Rules

- **`Function` type is banned** — use explicit signatures: `(action: GameAction) => void`.
- **`@storage/*` alias** — always import from `@storage/db`, `@storage/types`, `@storage/hash`, `@storage/generateId`, `@storage/saveIO`; never relative paths across directories.
- **`generateId.ts` is the only source of DB IDs** — use `generateTeamId()`, `generatePlayerId()`, `generateSaveId()`. Never `Date.now()` or `Math.random()` for IDs.
- **`fnv1a` hash from `@storage/hash`** — never reimplement it.
- **`announce.ts` is a barrel re-export** — always import from `@feat/gameplay/utils/announce`; never import directly from `tts.ts` or `audio.ts`.

### Styling Rules

- **Always use `mq` helpers** from `@shared/utils/mediaQueries`: `${mq.mobile}`, `${mq.desktop}`, `${mq.tablet}`, `${mq.notMobile}`. Never write raw `@media` strings.
- **Always use `dvh` not `vh`** for modal `max-height` — `vh` ignores browser chrome on mobile.
- **Styled-components transient props** — non-HTML props must use `$propName` prefix, typed via generics: `styled.div<{ $active: boolean }>`.
- **No IIFEs in JSX** — compute values as `const` before `return`; extract non-trivial blocks into named sub-components.
- **Consult `docs/style-guide.md` before adding any new color, font size, or component shape.**

### React Conventions

- **`import * as React from "react"`** — not the default import.
- **`React.FunctionComponent` with no type param** for zero-prop components (not `React.FunctionComponent<{}>`).
- **Lazy-loaded components:** `InstructionsModal`, `SavesModal`, `DecisionPanel` use `React.lazy()` in `GameControls/index.tsx`. Do not convert to static imports.
- **Options-hash for new functions with >2 non-`state`/`log` params** — use a named options interface with destructured defaults, not positional magic numbers.

## Key Files

| Area | Key Files |
| --- | --- |
| Simulation engine | `src/features/gameplay/context/reducer.ts`, `playerActions.ts`, `hitBall.ts`, `advanceRunners.ts` |
| PRNG | `src/shared/utils/rng.ts` |
| RxDB persistence | `src/storage/db.ts`, `src/features/saves/storage/saveStore.ts` |
| Custom teams | `src/features/customTeams/storage/customTeamStore.ts` |
| Routes | `src/router.tsx` |
| Styling theme | `src/shared/theme.ts`, `src/shared/utils/mediaQueries.ts` |
| E2E helpers | `e2e/utils/helpers.ts` |

## Path Aliases (tsconfig)

| Alias | Resolves to |
| --- | --- |
| `@feat/*` | `src/features/*` |
| `@shared/*` | `src/shared/*` |
| `@storage/*` | `src/storage/*` |
| `@test/*` | `src/test/*` |

## Build & Test Commands

```bash
yarn lint          # ESLint
yarn lint:fix      # ESLint with auto-fix (also sorts imports)
yarn format        # Prettier (run before every commit)
yarn typecheck     # TypeScript check for src/
yarn test          # Vitest (unit tests)
yarn test:coverage # Unit tests with coverage report
yarn build         # Production build to dist/
```

## Agent Routing

| Task | Agent |
| --- | --- |
| Feature planning, baseball rules, risk review | `pm-agent` |
| Gameplay realism review | `baseball-manager` |
| Behavior-preserving refactor | `safe-refactor` |
| UX/design/wireframes | `ux-design-lead` |
| UI implementation | `ui-visual-snapshot` |
| Simulation bug (wrong counts/logic) | `simulation-correctness` |
| RxDB/save/export changes | `rxdb-save-integrity` |
| CI/GitHub Actions | `ci-workflow` |
| E2E test authoring/running | `e2e-test-runner` |
| High-value change review/sign-off | `senior-lead` |

## Sub-Agent Push Rule

Sub-agents must **never** run `git push`, `gh`, or `report_progress`. Sub-agents may create local commits, then must report the commit SHA back to the root Copilot agent so the root Copilot agent can push using `report_progress`.
