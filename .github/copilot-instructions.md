# Copilot Instructions for BlipIt Legends

## Project Overview

**Ballgame** is a **self-playing baseball simulator** built as a React/TypeScript PWA with a **React Router data-router** route-first architecture. The game auto-plays continuously through innings, tracking strikes, balls, outs, bases, and score. Users navigate to `/exhibition/new` to start a game, adjust autoplay speed (slow/normal/fast), or turn on **Manager Mode** to make strategic decisions that influence the simulation. The app is installable on Android and desktop via a Web App Manifest.

**Repository size:** ~130 source files. **Language:** TypeScript. **Framework:** React 19 (hooks-based). **Styling:** styled-components v6 + SASS. **Bundler:** Vite v7. **Package manager:** Yarn Berry v4. **Persistence:** RxDB v17 (IndexedDB, local-only — no sync).

---

## Detailed Reference Documentation

This file is the quick-reference index. For deeper detail, see:

| Doc                                                     | Contents                                                                                                                                                                                                                     |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [docs/repo-layout.md](../docs/repo-layout.md)           | Full directory tree, file descriptions, path aliases                                                                                                                                                                         |
| [docs/rxdb-persistence.md](../docs/rxdb-persistence.md) | RxDB setup, schema versioning, collections, SaveStore/CustomTeamStore APIs, fingerprints, export/import bundles, game-loop integration                                                                                       |
| [docs/architecture.md](../docs/architecture.md)         | Route architecture, auto-play scheduler, Manager Mode, notification system, shared logger                                                                                                                                    |
| [docs/e2e-testing.md](../docs/e2e-testing.md)           | Playwright projects, E2E helpers, `data-testid` reference, visual snapshots, CI workflows, save fixtures                                                                                                                     |
| [docs/style-guide.md](../docs/style-guide.md)           | **UI Style Guide** — color palette, typography, breakpoints, all button variants, form elements, modals, cards, tables, game UI, and status patterns. **Consult before introducing any new color, font size, or component.** |
| [agents/README.md](agents/README.md)                    | Agent routing guide — which specialized agent to use for each task type, common gotchas for multi-session PRs                                                                                                                |
| [agents/prompt-examples.md](agents/prompt-examples.md)  | Copy-paste prompt templates for each agent type                                                                                                                                                                              |

---

## Canonical Docs and Agent Scope

The sections below used to duplicate large portions of the docs set (layout, architecture, lint scripts, validation steps, style guide, and E2E process). To avoid drift, treat the docs as the single source of truth and keep this file focused on Copilot-only guardrails.

Use these canonical docs directly:

- Repo layout, aliases, and feature ownership: `docs/repo-layout.md`
- Architecture and gameplay flow details: `docs/architecture.md`
- RxDB schema/versioning/migrations: `docs/rxdb-persistence.md`
- E2E projects/helpers/fixtures/snapshots/CI: `docs/e2e-testing.md`
- UI rules and tokens: `docs/style-guide.md`

Copilot-specific policy that remains in this file:

- Keep generated code under 200 lines when practical; split large files.
- Prefer extracting shared logic over duplication.
- Use American English in user-facing copy and docs.
- Ensure PR title/body describe the full branch scope, not just the latest commit.
- **When you notice duplication**, fix it before adding more: extract first, then wire both consumers.
- **Duplication in tests is acceptable** when it aids test readability, but shared test setup belongs in `@test/testHelpers`.
- **Always make small, focused commits** — one logical change per commit. Never batch unrelated changes into a single commit. Small commits are easier to review, bisect, and revert.

---

## Technical Notes & Gotchas

- **`tsconfig.json`** has `moduleResolution: "node"`, `jsx: "react-jsx"`, and path aliases. Vite reads it automatically via `vite.config.ts`. Do not change `moduleResolution` without testing the build and tests.
- **Single config file:** `vite.config.ts` is the only config for both Vite (build/dev) and Vitest (tests). It imports `defineConfig` from `vitest/config`. There is no separate `vitest.config.ts`.
- **Static assets live in `public/`** (not `src/`): `public/images/`, `public/manifest.webmanifest`, `public/og-image.png`. Vite copies them verbatim to `dist/` at their original paths — no content hashing. HTML references these with absolute paths (`/images/…`, `/manifest.webmanifest`).
- **Service worker is a module worker:** `src/sw.ts` is built by `vite-plugin-pwa` (`injectManifest` strategy, `rollupFormat: "es"`), output as `dist/sw.js`, and registered via `navigator.serviceWorker.register("/sw.js", { type: "module" })`.
- **`self.__WB_MANIFEST`** is the precache list injected into `sw.ts` at build time by `vite-plugin-pwa`. It is declared locally in `sw.ts` — do not import from any external package.
- **Lazy-loaded components:** `InstructionsModal`, `SavesModal`, and `DecisionPanel` are loaded via `React.lazy()` in `src/features/gameplay/components/GameControls/index.tsx` and wrapped in `<React.Suspense fallback={null}>`. Do not convert them back to static imports.
- **React 19:** Entry point uses `createRoot` from `react-dom/client`.
- **React import style:** Files use `import * as React from "react"` (not the default import).
- **Styled-components v6:** Custom props **must** be typed via generics, e.g. `styled.div<{ $active: boolean }>`. Use `$propName` (transient props) for non-HTML props.
- \*\*No `React.FunctionComponent<{}>` — write `React.FunctionComponent` (no type param) for zero-prop components.
- **Node version:** Node 24.x (see `.nvmrc`).
- **`browserslist`** is set in `package.json` (`> 0.5%, last 2 versions, not dead`).
- **`webkitAudioContext`** — use `(window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext` for the Safari fallback in `audio.ts`.
- **Never import GameContext directly** — always use the `useGameContext()` hook from `@feat/gameplay/context/index`.
- **`announce.ts` is a barrel re-export** — always import from `@feat/gameplay/utils/announce`; never import directly from `tts.ts` or `audio.ts`.
- **Context module cycle-free order** — `strategy` → `advanceRunners` → `gameOver` → `playerOut` → `hitBall` → `buntAttempt` → `playerActions` → `reducer`. No module may import from a module later in this chain.
- **`Function` type is banned** — use explicit function signatures: `(action: GameAction) => void` for dispatch, `(action: LogAction) => void` for dispatchLog.
- **Options-hash convention for new functions** — any new function with more than two non-`state`/`log` parameters must use an options object as its final argument instead of positional params. Define a named `interface` (or `type`) for it, give every field a clear name, and provide defaults via destructuring. This avoids callers passing magic `0` / `false` sentinels to skip optional params. Example:

  ```typescript
  // ✅ Correct: named options, defaults in destructuring
  interface HandleFlyOutOptions { sacFlyPct: number; tagUp2ndPct?: number; }
  const handleFlyOut = (state, log, pitchKey, { sacFlyPct, tagUp2ndPct = 0 }: HandleFlyOutOptions) => …

  // ❌ Wrong: positional params requiring callers to pass 0 to skip
  const handleFlyOut = (state, log, pitchKey, sacFlyPct, tagUp2ndPct) => …
  handleFlyOut(state, log, key, 65, 0)  // what is 0?
  ```

  Exported options interfaces live alongside the function they describe in the same file. Existing functions with positional params are not required to be refactored unless they are being modified as part of the current task.

- **ESLint enforces import order** — run `yarn lint:fix` after adding imports to auto-sort them.
- **`@storage/*` alias** — always import from `@storage/db`, `@storage/types`, `@storage/hash`, `@storage/generateId`, `@storage/saveIO`; never use relative paths across directories. Note: `saveStore` has moved to `@feat/saves/storage/saveStore`; `customTeamStore` to `@feat/customTeams/storage/customTeamStore`; `gameHistoryStore` to `@feat/careerStats/storage/gameHistoryStore`.
- **`SaveStore` is a singleton** backed by `getDb()`. For tests, use `makeSaveStore(_createTestDb(getRxStorageMemory()))` — each call to `_createTestDb()` appends a random suffix to avoid RxDB registry collisions.
- **`_createTestDb` requires `fake-indexeddb/auto`** — import it at the top of any test file that calls `_createTestDb`. It is a dev-only dependency.
- **`useSaveStore` requires `<RxDatabaseProvider>`** in the tree. Mock the hook in component tests with `vi.mock("@feat/saves/hooks/useSaveStore", ...)`.
- **RxDB schema changes MUST bump `version` and add a migration strategy** — any change to a collection's `properties`, `required`, or `indexes` at the same version number causes a DB6 schema hash mismatch for every existing user, blocking app startup. Always: (1) increment `version`, (2) add a `migrationStrategies` entry that never throws, (3) add an upgrade-path unit test. See `### Schema versioning & migration` in [`docs/rxdb-persistence.md`](../docs/rxdb-persistence.md).
- **Service worker must NOT initialize or use RxDB** — RxDB is window-only. The service worker only handles notifications and lightweight message passing.
- **`InstructionsModal` visibility** — `display: flex` lives inside `&[open]` in `src/features/help/components/InstructionsModal/styles.ts`. Never move it outside or the native `<dialog>` hidden state will be overridden. Import `InstructionsModal` via `@feat/help/components/InstructionsModal`.
- **Do NOT use `@vitest/browser` for E2E tests** — `@vitest/browser` (with the Playwright provider) runs component tests _inside_ a real browser, but it cannot do page navigation, multi-step user flows, or visual regression. Use `@playwright/test` (in `e2e/`) for all end-to-end tests. The two test runners serve different purposes and coexist without conflict.
- **No IIFEs in JSX** — never use `(() => { ... })()` inside JSX. IIFEs create a new function reference on every render causing unnecessary re-renders and unpredictable behaviour. Instead, compute values as `const` variables before the `return` statement and reference them directly in JSX. For non-trivial conditional rendering blocks, extract them into a named sub-component (e.g. `StarterPitcherSelector` in `ExhibitionSetupPage/`) to keep them independently testable.
- **`SavesModal` no longer has `autoOpen`/`openSavesRequestCount`/`onRequestClose`/`closeLabel` props** — these were removed when "Load Saved Game" became a dedicated `/saves` route. The modal now always closes with a simple `close()`. Do not re-add these props.
- **`CustomTeamEditor` uses drag-and-drop for all sections** — lineup, bench, and pitchers all use `SortablePlayerRow` with `@dnd-kit/sortable`. There are **no up/down arrow buttons** in the editor. Lineup and bench share one `DndContext` (inside `<div data-testid="lineup-bench-dnd-container">`) so players can be dragged between sections. Pitchers have their own isolated `DndContext`. The `TRANSFER_PLAYER` action (`{ fromSection, toSection, playerId, toIndex }`) in `editorReducer` handles cross-section moves. `PlayerRow` (the old up/down component) is preserved in the file system but is not used in `index.tsx` — do not resurrect it.
- **`useImportCustomTeams` is the shared hook for all custom-team import flows** — always use it rather than calling `importCustomTeams` directly in components. It handles file upload, paste JSON, clipboard paste, in-flight state, errors, and the two-step duplicate-player confirmation flow. The hook exposes `pendingDuplicateImport`, `confirmDuplicateImport()`, and `cancelDuplicateImport()`.
- **FNV-1a hash is in `@storage/hash`** — import `fnv1a` from there. Never reimplement it in components or store modules.
- **`generateId.ts` is the only source of new DB IDs** — always call `generateTeamId()`, `generatePlayerId()`, `generateSaveId()` from `@storage/generateId`. Never use `Date.now()` or `Math.random()` directly for IDs.
- **Seed input is on ExhibitionSetupPage** — the seed is settable via `data-testid="seed-input"` on `/exhibition/new`. The field is pre-populated with a fresh random seed via `generateFreshSeed()`. On form submit, `reinitSeed(seedStr)` in `rng.ts` re-initializes the PRNG. The seed is **not** written to the URL. E2E tests fill this field via `configureNewGame(page, { seed: "..." })` — no URL navigation needed.
- **Always use `mq` helpers in styled-components** — never write raw `@media` strings inline. Import `mq` from `@shared/utils/mediaQueries` and interpolate: `${mq.mobile} { … }`, `${mq.desktop} { … }`, `${mq.tablet} { … }`, `${mq.notMobile} { … }`. This keeps all breakpoints in sync with the SCSS variables in `index.scss`. Breakpoints: mobile ≤ 768 px, desktop ≥ 1024 px.
- **UI style guide** — before adding any new color, font size, button variant, or interactive component, consult [`docs/style-guide.md`](../docs/style-guide.md). It is the single source of truth for every visual token and pattern in the app. Never introduce one-off colors or component shapes that deviate from it.
- **NewGameDialog mobile compaction** — `NewGameDialog/styles.ts` uses `${mq.mobile}` blocks on every styled component (Dialog, Title, FieldGroup, FieldLabel, Input, Select, SectionLabel, RadioLabel, ResumeButton, Divider, PlayBallButton, SeedHint) to reduce padding/margins so the modal fits without scrolling on phone viewports. `PlayerCustomizationPanel.styles.ts` does the same for `PanelSection`. The Dialog's `max-height` uses `min(96dvh, 820px)` on mobile (vs `90dvh` on desktop) to reclaim browser-chrome space. Never revert these to desktop-only values.
- **Viewport-safe modal sizing** — always use `dvh` (dynamic viewport height) units, not bare `vh`, for modal `max-height`. `100vh` on mobile browsers can exceed the visible area because it ignores browser chrome (address bar, navigation bar). `dvh` tracks the actual visible viewport. The `responsive-smoke.spec.ts` E2E test verifies the Play Ball button bottom edge is within `viewport.height` on all projects.
- **`ResumeLabel` span in NewGameDialog** — the "Resume: " prefix inside `ResumeButton` is wrapped in `<ResumeLabel>` (exported from `NewGameDialog/styles.ts`). `ResumeLabel` uses `display: none` inside `${mq.mobile}` so on phone viewports the button shows "▶ {saveName}" (shorter) while desktop still shows "▶ Resume: {saveName}". Do not remove this span or inline the text directly into `ResumeButton`.
- **`responsive-smoke.spec.ts` New Game dialog tests** — three tests guard the no-scroll contract on all viewport projects: (1) Play Ball button bottom edge ≤ viewport height; (2) critical fields (`matchup-mode-select`, `home-team-select`, `away-team-select`, `seed-input`, `play-ball-button`) all have bottom edges within viewport height; (3) `document.documentElement.scrollWidth <= window.innerWidth` (no horizontal overflow). Always keep these passing when touching NewGameDialog layout.
