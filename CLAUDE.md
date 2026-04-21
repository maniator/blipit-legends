# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Ballgame** is a self-playing baseball simulator PWA. Users watch auto-played games and optionally enable **Manager Mode** to make real-time strategic decisions (steal, bunt, pinch-hit, defensive shift, IBB). The app is fully installable via Web App Manifest.

**Stack:** React 19 · TypeScript · Vite v7 · Vitest · Playwright · styled-components v6 · React Router v7 · RxDB v17 (IndexedDB) · Yarn Berry v4 · Node 24

## Commands

```bash
yarn dev                    # dev server at localhost:5173
yarn build                  # production build to dist/
yarn dev:deploy             # build + vite preview

yarn test                   # run all unit tests once (Vitest)
yarn test src/path/file.test.ts   # run a single unit test file
yarn test -- --watch src/path/file.test.ts  # watch mode
yarn test:coverage          # unit tests with coverage (90% lines/functions/statements, 80% branches)

yarn test:e2e               # build + run all Playwright E2E tests (7 device projects)
yarn test:e2e:ui            # Playwright interactive UI
yarn test:e2e:update-snapshots  # regenerate visual snapshots (must run inside Playwright Docker container)

yarn lint                   # ESLint
yarn lint:fix               # ESLint with auto-fix (also sorts imports)
yarn format                 # Prettier
yarn format:check           # Prettier check only
yarn typecheck              # TypeScript check for src/
yarn typecheck:e2e          # TypeScript check for e2e/
yarn check:circular-deps    # Madge circular dependency analysis
```

Pre-commit hooks (Husky + lint-staged) auto-run ESLint fix, Prettier, and Vitest on staged files.

## Detailed Reference Docs

| Doc                                | Contents                                                                                                                                                                   |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/repo-layout.md`              | Full directory tree, path aliases, feature ownership                                                                                                                       |
| `docs/architecture.md`             | Route architecture, auto-play scheduler, Manager Mode, notifications                                                                                                       |
| `docs/rxdb-persistence.md`         | RxDB setup, schema versioning/migrations, SaveStore/CustomTeamStore APIs                                                                                                   |
| `docs/e2e-testing.md`              | Playwright projects, helpers, `data-testid` reference, visual snapshots, CI                                                                                                |
| `docs/style-guide.md`              | **Consult before any new color, font size, or component** — owned by `@ux-design-lead`; color palette, typography, breakpoints, all button variants, forms, modals, tables |
| `.github/copilot-instructions.md`  | Technical gotchas and code conventions (full list)                                                                                                                         |
| `.github/agents/README.md`         | Specialist agent routing guide                                                                                                                                             |
| `.github/agents/ux-design-lead.md` | UX specs, wireframes, accessibility audits, design-system additions — route here before `@ui-visual-snapshot` for any net-new UI                                           |
| `.github/agents/user-*.md`         | User persona proxy agents — invoke any of these from any agent for in-persona UX research interviews                                                                       |

## Architecture

### Route Structure

Routes are defined in `src/router.tsx` using `createBrowserRouter`. `AppShell` is a pure layout component that passes navigation callbacks via outlet context — it does **not** mount the game persistently. The game lives at `/game` and mounts/unmounts with the route.

| Route                                        | Component                                               |
| -------------------------------------------- | ------------------------------------------------------- |
| `/`                                          | `HomeScreen`                                            |
| `/exhibition/new`                            | `ExhibitionSetupPage` — new game entry point            |
| `/game`                                      | `GamePage` — mounts on entry, unmounts on navigate-away |
| `/saves`                                     | `SavesPage`                                             |
| `/teams`, `/teams/new`, `/teams/:id/edit`    | `ManageTeamsScreen`                                     |
| `/help`                                      | `HelpPage`                                              |
| `/stats/:teamId`, `/stats/players/:playerId` | Career stats pages                                      |

`InstructionsModal`, `SavesModal`, and `DecisionPanel` are lazy-loaded via `React.lazy()` in `GameControls/index.tsx`.

### Gameplay Context (Simulation Engine)

`src/features/gameplay/context/` is the core simulation engine. State lives in React Context backed by `useReducer` — not Redux. A separate `logReducer` tracks play-by-play announcements.

**Cycle-free module order (enforced — do not break):**
`strategy` → `advanceRunners` → `gameOver` → `playerOut` → `hitBall` → `buntAttempt` → `playerActions` → `reducer`

No module may import from a module later in this chain.

Auto-play is driven by `useAutoPlayScheduler` — a speech-gated `setTimeout` loop that calls `handlePitch()` and pauses for Manager Mode decisions.

### Persistence

| What                                                  | Where                                 |
| ----------------------------------------------------- | ------------------------------------- |
| Game saves + pitch-by-pitch event log                 | RxDB (`saves` + `events` collections) |
| Custom teams                                          | RxDB (`customTeams` collection)       |
| Career stats                                          | RxDB (`gameHistory` collection)       |
| UI preferences (speed, volume, managerMode, strategy) | `localStorage`                        |

Game state is flushed to RxDB on `GamePage` unmount via `useRxdbGameSync`. **RxDB schema changes MUST bump `version` and add a migration strategy** — same-version schema changes cause a DB6 hash mismatch for all existing users.

### Seeded Randomness

All simulation randomness flows through `src/shared/utils/rng.ts` (mulberry32 PRNG). Same seed → identical play-by-play. Seed is stored in save snapshots + RNG state so games can resume mid-inning.

## Critical Code Conventions

- **Never import `GameContext` directly** — use the `useGameContext()` hook from `@feat/gameplay/context/index`.
- **Always import from `@feat/gameplay/utils/announce`** — `announce.ts` is a barrel re-export over `tts.ts` and `audio.ts`.
- **`Function` type is banned** — use explicit signatures: `(action: GameAction) => void`.
- **Options-hash for new functions with >2 non-`state`/`log` params** — use a named options interface with destructured defaults, not positional magic numbers.
- **Never write raw `@media` strings** — use `mq` helpers from `@shared/utils/mediaQueries`: `${mq.mobile}`, `${mq.desktop}`, `${mq.tablet}`, `${mq.notMobile}`. Breakpoints: mobile ≤768px, desktop ≥1024px.
- **Always use `dvh` not `vh`** for modal `max-height` — `vh` ignores browser chrome on mobile.
- **No IIFEs in JSX** — compute values as `const` before `return`; extract non-trivial blocks into named sub-components.
- **`React.FunctionComponent` with no type param** for zero-prop components (not `React.FunctionComponent<{}>`).
- **`import * as React from "react"`** — not the default import.
- **Styled-components transient props** — non-HTML props must use `$propName` prefix and be typed via generics: `styled.div<{ $active: boolean }>`.
- **Always use `mq` helpers** — before adding new visual tokens, consult `docs/style-guide.md`.
- **`@storage/*` alias** — import from `@storage/db`, `@storage/types`, `@storage/hash`, `@storage/generateId`, `@storage/saveIO`; never relative paths across directories.
- **`generateId.ts` is the only source of DB IDs** — use `generateTeamId()`, `generatePlayerId()`, `generateSaveId()`. Never `Date.now()` or `Math.random()` for IDs.
- **`fnv1a` hash from `@storage/hash`** — never reimplement it.
- Run `yarn lint:fix` after adding imports to auto-sort them.

## Testing Notes

- Unit tests co-located with source files; `@test/testHelpers` for shared setup.
- E2E tests in `e2e/tests/` use `@playwright/test` against a `vite preview` build (production, not dev server).
- For RxDB tests: import `fake-indexeddb/auto` at top of file, use `makeSaveStore(_createTestDb(getRxStorageMemory()))`.
- Visual regression snapshots must be regenerated inside the Playwright Docker container only.
- Do not use `@vitest/browser` for E2E tests — use Playwright in `e2e/`.
