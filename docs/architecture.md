# Architecture Reference

> Part of the Ballgame reference docs. See the [docs index](README.md) or [`.github/copilot-instructions.md`](../.github/copilot-instructions.md) (Copilot-specific).

## Route Architecture (Stage 4A)

The app uses **React Router v7** (`react-router` package — not `react-router-dom`) with the data router API (`createBrowserRouter` + `RouterProvider`) defined in `src/router.tsx`. `AppShell` is a **pure layout component** that renders only `<Outlet context={outletContext} />` — it does NOT mount the game persistently. `Game` lives at the `/game` route as a real route element (`GamePage`) that mounts on entry and unmounts on navigation away.

| Route             | Component                         | Notes                                                                                        |
| ----------------- | --------------------------------- | -------------------------------------------------------------------------------------------- |
| `/`               | `HomeScreen`                      | New Game, Load Saved Game, Manage Teams, Help buttons                                        |
| `/exhibition/new` | `ExhibitionSetupPage`             | Primary new-game entry point; defaults to Custom Teams tab                                   |
| `/game`           | `GamePage`                        | Mounts on entry, unmounts on navigate-away; state persisted to RxDB on unmount               |
| `/teams`          | `ManageTeamsScreen`               | Custom team list                                                                             |
| `/teams/new`      | `ManageTeamsScreen` (create view) | URL-routed editor; browser-back returns to list                                              |
| `/teams/:id/edit` | `ManageTeamsScreen` (edit view)   | Loader redirects to `/teams` if team ID missing; shows loading/not-found states on deep-link |
| `/saves`          | `SavesPage`                       | Standalone saves list; navigates to `/game` only after a save is loaded                      |
| `/help`           | `HelpPage`                        | How to Play; browser back returns to previous page                                           |

**AppShellOutletContext** — all navigation callbacks and session state passed through outlet context to child routes:

- `onStartGame(setup: ExhibitionGameSetup)` — navigates to `/game` with `pendingGameSetup` in `location.state`
- `onLoadSave(slot: SaveDoc)` — navigates to `/game` with `pendingLoadSave` in `location.state`
- `onGameSessionStarted()` — called by `GamePage` once a session is active (gates "Resume Current Game" button)
- `hasActiveSession` — `true` once a real game session has started or been loaded

---

Auto-play is implemented in `src/features/gameplay/hooks/useAutoPlayScheduler.ts`:

> **Note:** The game is always auto-play unless paused. There is **no step-by-step pitch mode**. The scheduler runs continuously at the selected speed and only pauses when: (a) the user presses the pause button, (b) a Manager Mode decision is pending, or (c) `GamePage` unmounts.

- Speech-gated `setTimeout` scheduler (`tick`) that calls `handlePitch()`. Receives `inning` and `atBat` as direct values for proper React dependency tracking.
- **Route-aware pause** — `GamePage` unmounts when the user navigates away from `/game`, which cancels the scheduler's cleanup function. No `isRouteActive` flag needed — the component lifecycle handles it.
- Manager Mode pausing — when `pendingDecision` is set, the scheduler returns early and restarts once the decision resolves.
- All settings are persisted in `localStorage` (`speed`, `announcementVolume`, `alertVolume`, `managerMode`, `strategy`, `managedTeam`) and restored on page load.

**Persistence split:**

| What                                                               | Where                                                       |
| ------------------------------------------------------------------ | ----------------------------------------------------------- |
| Game save state + events                                           | RxDB (`saves` + `events` collections via `useRxdbGameSync`) |
| UI preferences (speed, volume, managerMode, strategy, managedTeam) | `localStorage` (scalars only)                               |

---

## Manager Mode & Decision System

- **Decision detection** (`detectDecision` from `src/features/gameplay/context/reducer.ts`) — evaluated before each pitch in `usePitchDispatch`. Returns one of: `steal`, `bunt`, `count30`, `count02`, `ibb`, `ibb_or_steal`, `pinch_hitter`, `defensive_shift`, or `null`.
- `DecisionPanel/index.tsx` renders the panel, plays a chime, shows a browser notification via service worker, and runs a 10-second countdown bar.

### `managerModeAllowed` semantics

`GameInner` holds `managerModeAllowed: boolean` state that gates the manager-mode toggle in `GameControls`. The rule is:

| Game type                       | `managedTeam`    | `seasonGameId` | `managerModeAllowed` |
| ------------------------------- | ---------------- | -------------- | -------------------- |
| Exhibition (any matchup mode)   | `null` or `0\|1` | `undefined`    | **always `true`**    |
| League — managed game           | `0\|1`           | set            | **`true`**           |
| League — spectator / watch game | `null`           | set            | **`false`**          |

Formula applied in all four paths in `GameInner` (fresh start, auto-restore, load save, modal-load):

```ts
setManagerModeAllowed(seasonGameId == null || managedTeam !== null);
```

**Do NOT change this to `managedTeam !== null` alone** — that would hide the manager-mode toggle for all exhibition games (regression introduced in PR #260 and fixed in the same branch).

### Handedness/Platoon Methodology

- Matchups are resolved from batter/pitcher handedness buckets (`R_R`, `R_L`, `L_R`, `L_L`, `S_R`, `S_L`) in `src/features/gameplay/context/handednessMatchup.ts`.
- Switch hitters use an opposite-side batting profile (`S_R` behaves like `L_R`; `S_L` behaves like `R_L`).
- Outcome multipliers are intentionally modest and affect swing, whiff, walk/called-strike, and hard-contact rates without overpowering core player mods.
- Calibration target is directionally MLB-like platoon behavior rather than exact season replication:
  - Same-side buckets slightly favor the pitcher (more whiffs/called strikes, fewer walks/hard contact).
  - Opposite-side buckets slightly favor the batter (fewer whiffs/called strikes, more walks/hard contact).
- Prompt deltas (`promptDeltaPct`) are informational UI values for manager decisions and AI tie-breakers, not direct stat percentages.

---

## Notification System (Service Worker)

`src/sw.ts` is a **module service worker** registered at `/sw.js` with `{ type: "module" }`. It uses `self.__WB_MANIFEST` (the precache list injected at build time by `vite-plugin-pwa`'s `injectManifest` strategy), implements network-first + cache fallback, and listens for `notificationclick` events, posting `{ type: 'NOTIFICATION_ACTION', action, payload }` to the page.

**Logging**: imports `createLogger` from `@shared/utils/logger` and creates its own `log` singleton tagged with a version derived from the manifest content hashes.

**Service worker must NOT initialize or use RxDB** — RxDB is window-only.

---

## Shared Logger (`src/shared/utils/logger.ts`)

- **`appLog`** — singleton for the main-app context. Import this directly; do not call `createLogger("app")` again.
- **SW logger** — `sw.ts` creates its own: `const log = createLogger(\`SW ${version.slice(0, 8)}\`)`where`version`is derived from`self.\_\_WB_MANIFEST` content hashes.
