# Route Split Design: Exhibition vs League Game Pages

> Part of the game-session-refactor epic. Read `01-architecture-decision-record.md` first.

---

## Current Routing (as of League v1)

All game sessions navigate to `/game` via React Router `location.state`:

```
ExhibitionSetupPage  →  navigate("/game", { state: { pendingGameSetup, pendingLoadSave: null } })
SeasonSchedulePage   →  navigate("/game", { state: { pendingGameSetup: leagueSetup, pendingLoadSave: null } })
SeasonHomePage       →  navigate("/game", { state: { pendingGameSetup: leagueSetup, pendingLoadSave: null } })
SavesPage            →  navigate("/game", { state: { pendingGameSetup: null, pendingLoadSave: slot } })
```

`GamePage` reads `location.state` on first render, captures into refs, and clears state.
`ExhibitionGameSetup` carries discriminating fields (`disableSave`, `seasonGameId`, `managedTeam`)
to distinguish exhibition from league sessions.

---

## Target Routing (after this epic)

### New routes

| Route                        | Component              | Purpose                                     |
| ---------------------------- | ---------------------- | ------------------------------------------- |
| `/game/exhibition`           | `ExhibitionGamePage`   | Exhibition games from `ExhibitionSetupPage` |
| `/game/league/:seasonGameId` | `LeagueGamePage`       | League games from schedule/home             |
| `/game`                      | `GamePage` (unchanged) | Legacy — save resume from `SavesPage`       |

### Navigation contract changes

**Exhibition games** (from `ExhibitionSetupPage`):

```typescript
// Before:
navigate("/game", { state: { pendingGameSetup: setup, pendingLoadSave: null } });

// After:
navigate("/game/exhibition", { state: { pendingGameSetup: setup } });
```

**League games** (from `SeasonSchedulePage` and `SeasonHomePage`):

```typescript
// Before:
navigate("/game", { state: { pendingGameSetup: leagueSetup, pendingLoadSave: null } });
// (leagueSetup was a fully hydrated ExhibitionGameSetup built in SeasonSchedulePage)

// After:
navigate(`/game/league/${game.id}`, {
  state: { managedTeam: managedTeamIdx }, // 0 | 1 | null
});
// seasonGameId is read from the URL param by LeagueGamePage.
// LeagueGamePage fetches SeasonGameRecord from RxDB to hydrate the full ExhibitionGameSetup.
// The managedTeam index is passed in state only to avoid an extra DB lookup on the page;
// if absent, LeagueGamePage derives it from season.userCustomTeamId.
```

**Save resume** (`SavesPage` → `/game` unchanged):

```typescript
// Unchanged — stays on /game for this epic
navigate("/game", { state: { pendingGameSetup: null, pendingLoadSave: slot } });
```

---

## New Page Components

### `ExhibitionGamePage` (`src/features/exhibition/pages/ExhibitionGamePage/index.tsx`)

Thin wrapper. Reads `location.state.pendingGameSetup`, derives `GameSessionContextValue`, renders
`<GameSessionProvider>` → `<Game>`.

```typescript
// Derives session:
const session: GameSessionContextValue = {
  sessionType: "exhibition",
  managerModeAllowed: setup.managedTeam !== null,
  disableSave: false,
  seasonGameId: null,
  managedTeam: setup.managedTeam,
};
```

Handles back-navigation to `/exhibition/new` (not to `/game`).

### `LeagueGamePage` (`src/features/leagues/pages/LeagueGamePage/index.tsx`)

Reads `:seasonGameId` from `useParams()`. Fetches the `SeasonGameRecord` from RxDB, then builds
the fully hydrated `ExhibitionGameSetup` using the same helper already called in
`SeasonSchedulePage` (currently `buildLeagueGameSetup` or equivalent — check the existing
`SeasonSchedulePage` implementation for the exact helper name and call signature). The key steps are:

1. Fetch `SeasonGameRecord` from RxDB using `seasonGameId`
2. Fetch the associated `SeasonRecord` to resolve `userCustomTeamId` (for managed-team derivation)
3. Fetch `SeasonTeamRecord`s for `homeSeasonTeamId` and `awaySeasonTeamId`
4. Call the existing hydration helper (same as `SeasonSchedulePage`) to build `ExhibitionGameSetup`
   — this populates teams, rosters, pitcher assignments, player overrides, seed, etc.
5. Derive `managedTeamIdx` (0 | 1 | null): use `location.state.managedTeam` if present; otherwise
   derive from `season.userCustomTeamId` vs the two team IDs. If the user is watching
   (no managed team), `managedTeamIdx = null`.

```typescript
// Session derivation:
const session: GameSessionContextValue = {
  sessionType: "league",
  managerModeAllowed: managedTeamIdx !== null,
  disableSave: true,
  seasonGameId: seasonGameIdParam,
  managedTeam: managedTeamIdx, // null when user is watching (spectator)
};
```

Handles:

- Loading state while DB fetch is in flight (show spinner — do not render `<Game>` until ready)
- Not-found guard: redirect to `/leagues` if `seasonGameId` is invalid or the record is missing
- Error state: show an error message if the DB fetch fails

Handles back-navigation to `/leagues/:seasonId/schedule`.

---

## Router Changes (`src/router.tsx`)

```typescript
// Add inside AppShell children:
{
  path: "game/exhibition",
  element: (
    <LazyRoute>
      <ExhibitionGamePage />
    </LazyRoute>
  ),
},
{
  path: "game/league/:seasonGameId",
  element: (
    <LazyRoute>
      <LeagueGamePage />
    </LazyRoute>
  ),
},
// Existing "/game" route stays unchanged (save resume)
```

---

## Migration Path

### Story 1 (this epic, PR 1): Routes only

- Add `ExhibitionGamePage` (thin wrapper, proxies to existing `Game` component)
- Add `LeagueGamePage` (fetches session from URL + DB, proxies to existing `Game`)
- Update `ExhibitionSetupPage` to navigate to `/game/exhibition`
- Update `SeasonSchedulePage` and `SeasonHomePage` to navigate to `/game/league/:id`
- `/game` stays — save resume unchanged
- `GameInner` is NOT modified in Story 1
- E2E regression guards for all three paths

### Story 2 (PR 2): `GameSessionContext` extraction

- Create `GameSessionContext.tsx` and `GameSessionProvider`
- `ExhibitionGamePage` and `LeagueGamePage` each wrap `<GameSessionProvider>` (static derivation)
- **`GamePage` wraps `<GameSessionProvider>` with a `useState`-based value** — required so the
  legacy save-resume flow can update `managerModeAllowed` once the auto-resume effect fires. Without
  this, any save-resume path throws `"useGameSessionContext must be used within GameSessionProvider"`.
  See `01-architecture-decision-record.md` §"Legacy saves session" for the full derivation.
- `GameInner.tsx` — remove the `managerModeAllowed` local state and its prop pass to `<GameControls>`.
  Other session fields (`disableSave`, `seasonGameId`) stay in `GameInner` as local state/refs until Story 3.
- `GameControls` removes `managerModeAllowed` prop, reads from `useGameSessionContext()`
- Unit tests for context + updated `GameControls` tests

### Story 3 (PR 3): Remove if-checks from `GameInner`

- `useRxdbGameSync` reads `disableSave` from `useGameSessionContext()`
- `useSeasonGameSync` reads `seasonGameId` from `useGameSessionContext()`
- `GameInner` has zero direct reads of `setup.disableSave`, `setup.seasonGameId`, `setup.managedTeam`
- `ExhibitionGameSetup` type can deprecate `disableSave` and `seasonGameId` fields (leave for now;
  remove in v2 cleanup)
- Full regression run of all E2E projects

---

## Files Changed Per Story

### Story 1 (Routes)

| File                                                          | Change                                                                                 |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `src/router.tsx`                                              | Add 2 new routes                                                                       |
| `src/features/exhibition/pages/ExhibitionGamePage/index.tsx`  | **NEW**                                                                                |
| `src/features/leagues/pages/LeagueGamePage/index.tsx`         | **NEW**                                                                                |
| `src/features/gameplay/components/AppShell/index.tsx`         | Update `handleStartFromExhibition` to navigate to `/game/exhibition`                   |
| `src/features/exhibition/pages/ExhibitionSetupPage/index.tsx` | No change if using `onStartGame` outlet context callback (AppShell handles navigation) |
| `src/features/leagues/pages/SeasonSchedulePage/index.tsx`     | Change navigate target to `/game/league/:id`; pass `{ state: { managedTeam } }`        |
| `src/features/leagues/pages/SeasonHomePage/index.tsx`         | Change navigate target to `/game/league/:id`; pass `{ state: { managedTeam } }`        |
| `e2e/tests/game-routes.spec.ts`                               | **NEW** — route regression guards                                                      |

> **Note on `ExhibitionSetupPage`:** Currently `ExhibitionSetupPage` calls `onStartGame(setup)` from
> `AppShellOutletContext`, which routes through `AppShell.handleStartFromExhibition` → `navigate("/game")`.
> In Story 1, update `handleStartFromExhibition` in `AppShell` to navigate to `/game/exhibition` instead.
> `ExhibitionSetupPage` itself does **not** change. `AppShellOutletContext.onStartGame` type signature
> is unchanged.

### Story 2 (Context)

| File                                                                  | Change                                                                                            |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `src/features/gameplay/context/GameSessionContext.tsx`                | **NEW**                                                                                           |
| `src/features/gameplay/context/index.tsx`                             | Export `GameSessionContextValue`, `useGameSessionContext`, `GameSessionProvider`                  |
| `src/features/exhibition/pages/ExhibitionGamePage/index.tsx`          | Add `GameSessionProvider` (static derivation)                                                     |
| `src/features/leagues/pages/LeagueGamePage/index.tsx`                 | Add `GameSessionProvider` (static derivation)                                                     |
| `src/features/gameplay/components/Game/GamePage.tsx`                  | **Add `GameSessionProvider` with `useState`-based value** (supports auto-resume flow)             |
| `src/features/gameplay/components/Game/GameInner.tsx`                 | Remove `managerModeAllowed` local state + prop pass; other session fields unchanged until Story 3 |
| `src/features/gameplay/components/GameControls/index.tsx`             | Remove prop, use context hook                                                                     |
| `src/features/gameplay/components/GameControls/GameControls.test.tsx` | Wrap with provider                                                                                |
| `src/test/testHelpers.ts`                                             | Add `makeGameSessionContext()` helper                                                             |

### Story 3 (Cleanup)

| File                                                  | Change                                                           |
| ----------------------------------------------------- | ---------------------------------------------------------------- |
| `src/features/gameplay/components/Game/GameInner.tsx` | Remove all session if-checks                                     |
| `src/features/gameplay/hooks/useRxdbGameSync.ts`      | Read `disableSave` from context                                  |
| `src/features/leagues/hooks/useSeasonGameSync.ts`     | Read `seasonGameId` from context                                 |
| `src/storage/types.ts`                                | Deprecate `disableSave`, `seasonGameId` on `ExhibitionGameSetup` |

---

## Back-Navigation Behavior

| From                         | Clicking ← | Destination                   |
| ---------------------------- | ---------- | ----------------------------- |
| `/game/exhibition` game over | "New Game" | `/exhibition/new`             |
| `/game/exhibition` ← Home    | "← Home"   | `/`                           |
| `/game/league/:id` game over | "← Season" | `/leagues/:seasonId/schedule` |
| `/game/league/:id` ← Home    | "← Home"   | `/`                           |
| `/game` (save resume)        | "← Home"   | `/` (unchanged)               |

**Mid-game browser back button:** When the user presses the browser back button during an active
game on `/game/exhibition` or `/game/league/:id`, React Router unmounts the page component, which
cancels the `useAutoPlayScheduler` cleanup function (same component-lifecycle mechanism as `/game`).
No additional back-button handling is required — `GamePage` already relies on this and the new pages
inherit the same behavior.

---

## Service Worker / PWA Cache Note

The app uses the `injectManifest` strategy via `vite-plugin-pwa`. At build time, Vite automatically
adds all output URLs to `self.__WB_MANIFEST` (the precache list injected into `sw.ts`). The two new
routes (`/game/exhibition`, `/game/league/:seasonGameId`) map to the same `index.html` entry point
— they are SPA client-side routes, not separate HTML files. Therefore no explicit cache update is
needed; the existing precache of `index.html` covers them.

**Verify at build time:** Run `yarn build` and confirm that `dist/sw.js` does not explicitly exclude
the new paths. No action required unless the manifest strategy configuration is changed.

---

## E2E Regression Guards Required

Each story must ship with Playwright tests covering:

1. Exhibition game: navigate from `/exhibition/new` → `/game/exhibition` → game starts
2. League game: navigate from schedule → `/game/league/:id` → game starts, FINAL writes season record
3. Watch mode: league game with no `managedTeam` → manager controls not visible
4. Save resume: saves page → `/game` → game resumes (must not regress)
5. Visual snapshots: Story 1 routes render the same `<Game>` component — **existing baselines are
   expected to pass without regeneration** because the visual output is identical. If any snapshot
   diffs appear, investigate before regenerating. Snapshot regeneration routes exclusively to the
   `e2e-test-runner` specialist inside `mcr.microsoft.com/playwright:v1.58.2-noble`.

---

## Post-Epic Docs Update (required after Story 3 merges)

After all three stories are merged, update the following docs. This is a hard requirement, not optional.

| Doc                                                             | What to update                                                                                                                                           |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/architecture.md` Route table                              | Add `/game/exhibition` and `/game/league/:seasonGameId` rows; mark `/game` as legacy; update `onStartGame` description; add `GameSessionContext` section |
| `docs/architecture.md` Auto-play                                | "pauses when (c) `GamePage` unmounts" → add `ExhibitionGamePage` and `LeagueGamePage`                                                                    |
| `docs/repo-layout.md`                                           | Add `ExhibitionGamePage` and `LeagueGamePage` file entries; add new routes to router description                                                         |
| `.github/copilot-instructions.md` Route table                   | Add two new route rows                                                                                                                                   |
| `docs/game-session-refactor/01-architecture-decision-record.md` | Update Status from APPROVED to IMPLEMENTED                                                                                                               |

Route Paige (`bmad-agent-tech-writer`) to produce all doc updates for Winston's final sign-off.
