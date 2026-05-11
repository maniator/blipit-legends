# 03 — Amelia Dev Slice: Implementation Checklist

> Amelia (Senior Software Engineer) — per-story implementation checklist.  
> Read `02-winston-arch-spec.md` fully before starting. Run the validation cadence after each story.

---

## Story 1: Route Split

### New files to create

- `src/features/exhibition/pages/ExhibitionGamePage/index.tsx`
- `src/features/exhibition/pages/ExhibitionGamePage/index.test.tsx`
- `src/features/leagues/pages/LeagueGamePage/index.tsx`
- `src/features/leagues/pages/LeagueGamePage/index.test.tsx`

### Files to modify

- `src/router.tsx` — add `/game/exhibition` and `/game/league/:seasonGameId` routes
- `src/features/gameplay/components/AppShell/index.tsx` — update `handleStartFromExhibition` to
  navigate to `/game/exhibition` instead of `/game`. **This is the only file that needs to change
  for exhibition navigation** — `ExhibitionSetupPage` calls `onStartGame()` from
  `AppShellOutletContext` which routes through `AppShell`, so `ExhibitionSetupPage` itself does not
  change.
- `src/features/leagues/pages/SeasonSchedulePage/index.tsx` — change navigate target to
  `/game/league/${game.id}` with `{ state: { managedTeam: managedTeamIdx } }`
- `src/features/leagues/pages/SeasonHomePage/index.tsx` — same as `SeasonSchedulePage`
- `e2e/tests/game-routes.spec.ts` — **NEW** — add route smoke tests

### `ExhibitionGamePage` implementation notes

```typescript
// Reads location.state.pendingGameSetup (same shape as today's GamePage)
// Passes to Game component — no GameSessionProvider yet (Story 2 adds this)
// Handles back-navigation: "New Game" → /exhibition/new
// Renders same <Game> component as GamePage
```

Key: `ExhibitionGamePage` is intentionally thin in Story 1. It is a routing shim only. The
`GameSessionProvider` is added in Story 2. Do not combine.

### `LeagueGamePage` implementation notes

```typescript
// 1. Read seasonGameId from useParams()
// 2. Fetch SeasonGameRecord from RxDB using seasonGameId
// 3. Fetch SeasonRecord to resolve userCustomTeamId
// 4. Fetch SeasonTeamRecords for homeSeasonTeamId and awaySeasonTeamId
// 5. Call the same hydration helper used by SeasonSchedulePage to build ExhibitionGameSetup
//    (search SeasonSchedulePage for the helper — e.g. buildLeagueGameSetup or equivalent)
// 6. Derive managedTeamIdx:
//    - Use location.state.managedTeam if present in navigation state
//    - Otherwise derive from season.userCustomTeamId vs the two team IDs
//    - Set null if user is watching (no managed team)
// Renders <Game> component — no GameSessionProvider yet (Story 2 adds this)
// Loading state: show spinner while DB fetch is in flight; do not render <Game> until ready
// Error/not-found guard — TWO distinct failure modes:
// 1. Invalid ID: RxDB finds no document for seasonGameId → redirect to /leagues
// 2. Missing setup: document exists but hydration fails (e.g. corrupt team record) →
//    show a brief error message, then redirect to /leagues after 2 seconds
// Both paths must show a loading spinner WHILE the check runs, not a blank screen.
// Direct URL load of /game/league/invalid-id must not flash a blank frame.
```

### Story 1 hard stop: do NOT touch `GamePage.tsx`

`GamePage.tsx` must not change in Story 1, not even for cleanup. Any edit creates a conflict with
Story 2's `<GameSessionProvider>` addition, making revert impossible and potentially merging two
architectural changes into the same diff.

### Unit tests for Story 1

- Both new page components: assert they render without crashing on a happy path (basic smoke)
- `ExhibitionGamePage`: assert that missing `pendingGameSetup` in location state triggers a redirect to `/exhibition/new`
- `LeagueGamePage`: assert loading state renders when fetch is in flight
- `LeagueGamePage`: assert redirect to `/leagues` on invalid `seasonGameId`
- `AppShell.handleStartFromExhibition`: unit test that verifies it navigates to `/game/exhibition` (not `/game`)

### E2E tests for Story 1

Minimum 3 smoke tests in `e2e/tests/game-routes.spec.ts`:

1. Exhibition flow: `ExhibitionSetupPage` → click Play Ball → expect `/game/exhibition` → game starts
2. League flow: Season schedule → click Watch → expect `/game/league/:id` → game starts (no manager controls)
3. Save resume: Saves page → click resume → expect `/game` → game resumes (regression guard)

### Validation cadence (Story 1)

```
yarn lint
yarn format:check
yarn typecheck
yarn typecheck:e2e
yarn test src/features/exhibition/pages/ExhibitionGamePage/
yarn test src/features/leagues/pages/LeagueGamePage/
yarn build
```

---

## Story 2: GameSessionContext Extraction

### New files to create

- `src/features/gameplay/context/GameSessionContext.tsx` (see `02-winston-arch-spec.md` for exact interface)
- `src/features/gameplay/context/GameSessionContext.test.tsx`

### Files to modify

- `src/features/gameplay/context/index.tsx` — re-export `GameSessionContextValue`, `useGameSessionContext`, `GameSessionProvider`
- `src/features/exhibition/pages/ExhibitionGamePage/index.tsx` — add `<GameSessionProvider>` using `deriveExhibitionSession()`
- `src/features/leagues/pages/LeagueGamePage/index.tsx` — add `<GameSessionProvider>` using `deriveLeagueSession()`
- **`src/features/gameplay/components/Game/GamePage.tsx`** — add `<GameSessionProvider>` with `useState`-based value (required for save-resume auto-resume path — see `02-winston-arch-spec.md` §"How `GamePage` Wraps the Context")
- `src/features/gameplay/components/Game/GameInner.tsx` — remove `managerModeAllowed` local `useState` and its prop pass to `<GameControls>`. Do NOT yet remove `seasonGameIdRef` or `disableSave` handling — those are Story 3.
- `src/features/gameplay/components/GameControls/index.tsx` — remove `managerModeAllowed` prop, use `useGameSessionContext()`
- `src/features/gameplay/components/GameControls/GameControls.test.tsx` — wrap all renders with `<GameSessionProvider value={makeGameSessionContext(...)}>`
- `src/test/testHelpers.ts` — add `makeGameSessionContext()` helper

### Risky call sites

- `GameControls.test.tsx` — any test rendering `<GameControls>` without a `GameSessionProvider` will
  throw at runtime. Audit every `render(<GameControls ...>)` call and wrap.
- `GameControls/index.tsx` `Props` type — remove `managerModeAllowed?: boolean`. Check for any
  other callers with `grep -r "managerModeAllowed" src/`.
- **`GamePage.tsx` auto-resume path** — after `setSessionCtx({ sessionReady: true })` fires,
  `useAutoPlayScheduler` must receive the updated value. Verify the scheduler re-evaluates
  `sessionReady` on context change, not just on mount.
- **`useAutoPlayScheduler`** — must add `if (!sessionReady) return;` at the top of the `tick`
  function in Story 2. Without this, a pitch fires before the save is restored. This is a Story 2
  change; add `src/features/gameplay/hooks/useAutoPlayScheduler.ts` to the Story 2 file list.

### Hook unit test isolation

`useRxdbGameSync` and `useSeasonGameSync` will call `useGameSessionContext()` after Story 3.
Their unit tests must use `vi.mock`, not a real `<GameSessionProvider>` wrapper (which pulls in
RxDB setup unnecessarily). Pattern:

```typescript
vi.mock("@feat/gameplay/context/index", () => ({
  useGameSessionContext: vi.fn(),
}));
import { useGameSessionContext } from "@feat/gameplay/context/index";

beforeEach(() => {
  vi.mocked(useGameSessionContext).mockReturnValue(
    makeGameSessionContext({ disableSave: false, seasonGameId: null }),
  );
});
```

Add this pattern to `useRxdbGameSync.test.ts` and `useSeasonGameSync.test.ts` in Story 3.

### Validation cadence (Story 2)

```
yarn lint
yarn format:check
yarn typecheck
yarn test src/features/gameplay/context/GameSessionContext.test.tsx
yarn test src/features/gameplay/components/GameControls/
yarn test src/features/gameplay/hooks/useAutoPlayScheduler.test.ts
yarn build
```

---

## Story 3: Remove if-checks from `GameInner`

### Files to modify

- `src/features/gameplay/components/Game/GameInner.tsx` — replace all session if-checks with `useGameSessionContext()` reads
- `src/features/gameplay/hooks/useRxdbGameSync.ts` — hook reads `disableSave` from context internally; update tests with `vi.mock` pattern
- `src/features/leagues/hooks/useSeasonGameSync.ts` — hook reads `seasonGameId` from context internally; remove `seasonGameIdRef` param; update tests with `vi.mock` pattern
- `src/storage/types.ts` — add `@deprecated` JSDoc comment to `ExhibitionGameSetup.disableSave` and `ExhibitionGameSetup.seasonGameId`

### What gets removed from `GameInner`

```typescript
// Remove:
const [managerModeAllowed, setManagerModeAllowed] = React.useState(true);
const seasonGameIdRef = React.useRef<string | undefined>(undefined);

// Remove the consumeSetup effect block that sets managerModeAllowed and seasonGameIdRef
// Remove the managerModeAllowed prop pass to <GameControls>

// Replace with:
const { managerModeAllowed, seasonGameId, disableSave, sessionReady } = useGameSessionContext();
```

### `useRxdbGameSync` signature change

```typescript
// Before: receives disableSave info indirectly via refs/state in GameInner
// After: hook calls useGameSessionContext() internally to read disableSave
// No prop or parameter change at the call site in GameInner — the hook self-sources from context
// Tests: add vi.mock("@feat/gameplay/context/index", ...) — see hook test isolation section above
```

### `useSeasonGameSync` signature change

```typescript
// Before: receives seasonGameIdRef: React.MutableRefObject<string | undefined>
// After: hook calls useGameSessionContext() internally to read seasonGameId (string | null)
// Remove the seasonGameIdRef parameter from the hook signature
// Remove the corresponding ref from GameInner
// Tests: add vi.mock("@feat/gameplay/context/index", ...) — see hook test isolation section above
```

**There is no "OR" here.** Both hooks read from `useGameSessionContext()` internally. Passing
values via props/refs was the pattern we are removing. See Winston's spec for confirmation.

### Validation cadence (Story 3 — full regression)

```
yarn lint
yarn format:check
yarn typecheck
yarn typecheck:e2e
yarn test
yarn build
yarn test:e2e   ← full Playwright run; route to e2e-test-runner specialist
```

---

## Conflict Minimization

- One story per PR. No simultaneous edits to `GameInner`, `GameControls`, or `router.tsx`.
- Keep `data-testid` selectors stable throughout all three stories.
- Do not touch PRNG, RxDB schema, or the cycle-free simulation modules in any of these stories.
- If a story PR touches a file that has an in-flight change on another branch, stop and rebase first.
