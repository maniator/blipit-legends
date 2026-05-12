# 02 — Winston Architecture Spec: GameSessionContext

> Winston (System Architect) — 2026-05-11  
> Verdict: APPROVED for implementation as specified below.

---

## `GameSessionContextValue` Interface

```typescript
// src/features/gameplay/context/GameSessionContext.tsx

import * as React from "react";

export type GameSessionType = "exhibition" | "league";

export interface GameSessionContextValue {
  /**
   * Discriminates exhibition games (from ExhibitionSetupPage or save-resume)
   * from league season games (from SeasonSchedulePage/SeasonHomePage).
   */
  sessionType: GameSessionType;

  /**
   * When false, manager controls are hidden and cannot be enabled.
   * Derived at the route level: true iff managedTeam !== null.
   * Exhibition: managedTeam !== null (user chose to manage a team).
   * League watch: false (user clicked Watch on schedule).
   * League manage: true (user clicked Play / Manage on schedule).
   */
  managerModeAllowed: boolean;

  /**
   * When true, GameInner skips creating a mid-game RxDB save slot.
   * Always true for league season games; false for exhibition games.
   */
  disableSave: boolean;

  /**
   * Season game record ID for live league games.
   * Null for exhibition games. When non-null, GameInner calls
   * applySeasonGameResult on FINAL via useSeasonGameSync.
   */
  seasonGameId: string | null;

  /**
   * Which team (0 = away, 1 = home) the user manages.
   * Null when spectating (watch mode).
   * Mirrors ExhibitionGameSetup.managedTeam.
   */
  managedTeam: 0 | 1 | null;

  /**
   * True once the session is fully hydrated and ready to start.
   * On GamePage (save-resume) this starts false and flips to true
   * when the auto-resume effect fires and setSessionCtx is called.
   * On ExhibitionGamePage and LeagueGamePage this is always true
   * because the setup is synchronously available before render.
   *
   * useAutoPlayScheduler MUST gate on `sessionReady` — it must return
   * early if sessionReady is false to prevent a pitch from firing
   * against an uninitialized game state.
   */
  sessionReady: boolean;
}
```

## Provider and Hook

```typescript
export const GameSessionContext =
  React.createContext<GameSessionContextValue | undefined>(undefined);

export const useGameSessionContext = (): GameSessionContextValue => {
  const ctx = React.useContext(GameSessionContext);
  if (!ctx) {
    throw new Error(
      "useGameSessionContext must be used within a GameSessionProvider. " +
      "Wrap the component tree with <GameSessionProvider>.",
    );
  }
  return ctx;
};

export const GameSessionProvider: React.FunctionComponent<{
  value: GameSessionContextValue;
  children: React.ReactNode;
}> = ({ value, children }) => (
  <GameSessionContext.Provider value={value}>{children}</GameSessionContext.Provider>
);
```

## Correct Component Tree Order

```
<GameSessionProvider value={derivedSession}>      ← UI-layer: session rules
  <GameProviderWrapper>                            ← Simulation: reducer, PRNG, dispatch
    <GameInner />                                  ← Reads BOTH contexts
      <GameControls />                             ← Reads GameSessionContext only
```

`GameSessionProvider` must be the **outer** wrapper. It must NOT be nested inside
`GameProviderWrapper`. The simulation context must not know about session type.

## Session Derivation Examples

### Exhibition game (from `ExhibitionGamePage`)

```typescript
function deriveExhibitionSession(setup: ExhibitionGameSetup): GameSessionContextValue {
  return {
    sessionType: "exhibition",
    managerModeAllowed: setup.managedTeam !== null,
    disableSave: false,
    seasonGameId: null,
    managedTeam: setup.managedTeam,
    sessionReady: true, // setup is synchronously available before render
  };
}
```

### League game (from `LeagueGamePage`)

```typescript
function deriveLeagueSession(
  seasonGameId: string,
  managedTeamIdx: 0 | 1 | null,
): GameSessionContextValue {
  return {
    sessionType: "league",
    managerModeAllowed: managedTeamIdx !== null,
    disableSave: true,
    seasonGameId,
    managedTeam: managedTeamIdx,
    sessionReady: true, // LeagueGamePage fetches BEFORE rendering <Game>; ready on mount
  };
}
```

Note: `LeagueGamePage` must not render `<Game>` until the 6-step hydration chain completes —
show a loading spinner until all data is available, then render `<Game>` with
`sessionReady: true`. Never render `<Game>` with a partial session.

## Scheduler Guard (Required in `useAutoPlayScheduler`)

After Story 2, `useAutoPlayScheduler` must gate on `sessionReady`:

```typescript
// useAutoPlayScheduler.ts — after Story 2
const { sessionReady } = useGameSessionContext();

// At the top of the tick() function:
if (!sessionReady) return; // block scheduler until session is hydrated
```

This ensures no pitch fires against an uninitialized game state during the one-render-cycle
window on GamePage before the auto-resume effect fires.

---

## How `GamePage` Wraps the Context (Legacy Save-Resume Path)

`GamePage` cannot derive `GameSessionContextValue` statically at render time because the auto-resume
flow reads the `SaveRecord` asynchronously (reactive save list, then matched save effect). The value
must be mutable state. `sessionReady` starts as `false` so the scheduler does not tick before the
save is loaded.

```typescript
// GamePage.tsx — after Story 2
const [sessionCtx, setSessionCtx] = React.useState<GameSessionContextValue>(() => ({
  sessionType: "exhibition",
  managerModeAllowed: pendingLoadSave?.setup.managedTeam !== null ?? true,
  disableSave: false,
  seasonGameId: null,
  managedTeam: pendingLoadSave?.setup.managedTeam ?? null,
  // sessionReady starts false when using save-resume — scheduler must not tick yet.
  // Flips to true in the same setSessionCtx call that fires after the save is consumed.
  sessionReady: pendingLoadSave != null, // true only if a specific save was passed in state
}));

// Inside the auto-resume effect, AFTER dispatch({ type: "restore_game", ... }):
setSessionCtx((prev) => ({
  ...prev,
  managerModeAllowed: restoredSave.setup.managedTeam !== null,
  managedTeam: restoredSave.setup.managedTeam,
  sessionReady: true, // ← scheduler now allowed to fire
}));
```

**Timing rule:** `setSessionCtx({ sessionReady: true })` is called inside the same `useEffect`
callback that runs `dispatch({ type: "restore_game", ... })`. This is not a loader — it is a
post-mount `useEffect`. The component renders once with `sessionReady: false` (scheduler blocked),
the effect fires on the next event-loop turn, and then `sessionReady` flips to `true`. The scheduler
then starts normally. This is safe because `useAutoPlayScheduler` is a `setTimeout`-based loop —
there is no render-phase logic at risk.

**Note on `pendingLoadSave` path:** When `pendingLoadSave` is present in `location.state` at
`GamePage` mount, `sessionReady` starts `true` immediately because the save metadata is available
synchronously. The auto-resume path (save matched from reactive list) is the only path that starts
with `sessionReady: false`.

**`managedTeam` page-refresh fallback:** `location.state` (including `managedTeam`) is
**in-memory only** and is lost on browser refresh. If a user refreshes `/game` mid-session,
`GamePage` must not crash. Guard: if `pendingLoadSave` is `null` after the state read, default the
session to `{ sessionReady: false, managerModeAllowed: false, managedTeam: null }` and allow the
auto-resume flow to recover from the reactive saves list. This is the same path as a cold-start with
no pending state — the existing auto-resume logic handles it.

`GamePage` **must** be in Story 2's files-changed list. Forgetting it causes a runtime crash
("useGameSessionContext must be used within GameSessionProvider") on any save-resume flow once
Story 2 ships.

---

After Story 3, `GameInner` replaces all session if-checks with context reads:

```typescript
// Story 3 — GameInner.tsx
const { disableSave, seasonGameId, managedTeam, managerModeAllowed } = useGameSessionContext();

// Replaces:
// const [managerModeAllowed, setManagerModeAllowed] = React.useState(true);
// if (setup.disableSave) { ... }
// if (setup.seasonGameId) { ... }
// if (setup.managedTeam !== null) { setManagerModeAllowed(true); }
```

## How `GameControls` Reads the Context

After Story 2, `GameControls` removes the `managerModeAllowed` prop:

```typescript
// GameControls/index.tsx — after Story 2
const { managerModeAllowed } = useGameSessionContext();

// Removes:
// managerModeAllowed?: boolean  ← prop removed from Props type
```

## How `useRxdbGameSync` and `useSeasonGameSync` Read the Context

After Story 3, both hooks call `useGameSessionContext()` internally. There is no OR here — the
architect decision is that hooks read from context, not from props or refs passed by `GameInner`.

```typescript
// useRxdbGameSync — after Story 3:
const { disableSave } = useGameSessionContext();
// Remove: any disableSave boolean param/prop it previously received from GameInner

// useSeasonGameSync — after Story 3:
const { seasonGameId } = useGameSessionContext();
// Remove: seasonGameIdRef parameter (was React.MutableRefObject<string | undefined>)
```

## Test Helper

Add to `src/test/testHelpers.ts`:

```typescript
import {
  GameSessionContextValue,
  GameSessionProvider,
} from "@feat/gameplay/context/GameSessionContext";

export function makeGameSessionContext(
  overrides: Partial<GameSessionContextValue> = {},
): GameSessionContextValue {
  return {
    sessionType: "exhibition",
    managerModeAllowed: true,
    disableSave: false,
    seasonGameId: null,
    managedTeam: null,
    sessionReady: true, // default true so tests don't need to opt-in
    ...overrides,
  };
}

// Usage in component tests:
// render(
//   <GameSessionProvider value={makeGameSessionContext({ managerModeAllowed: false })}>
//     <GameControls />
//   </GameSessionProvider>
// );
```

## Hook Unit Test Isolation Strategy

`useRxdbGameSync` and `useSeasonGameSync` call `useGameSessionContext()` internally. Unit tests
for these hooks **must NOT** wrap in a real `<GameSessionProvider>` — that would pull in RxDB setup
(`fake-indexeddb/auto`, `_createTestDb`) for tests that don't need persistence.

Instead, mock the hook at the module level:

```typescript
// In useRxdbGameSync.test.ts and useSeasonGameSync.test.ts:
import { vi } from "vitest";
import { makeGameSessionContext } from "@test/testHelpers";

vi.mock("@feat/gameplay/context/index", () => ({
  useGameSessionContext: vi.fn(),
  // ...other exports as needed
}));

import { useGameSessionContext } from "@feat/gameplay/context/index";

beforeEach(() => {
  vi.mocked(useGameSessionContext).mockReturnValue(
    makeGameSessionContext({ disableSave: false, seasonGameId: null }),
  );
});
```

This pattern is consistent with how `useSaveStore` is mocked elsewhere in the codebase.

## Cycle-Free Module Order — Hook Placement

`useRxdbGameSync` and `useSeasonGameSync` are **leaf consumers** of `GameSessionContext`. They
import from context; context does NOT import from them. This is a one-way dependency that does not
create a cycle. Verify with `yarn check:circular-deps` after Story 3.

## BLOCK Constraints (mandatory — stop if violated)

1. Do NOT add `GameSessionContextValue` fields to `GameContext` (simulation context).
2. Do NOT nest `GameSessionProvider` inside `GameProviderWrapper`.
3. Do NOT import from `GameSessionContext` inside any module in the cycle-free chain:
   `strategy → advanceRunners → gameOver → playerOut → hitBall → buntAttempt → playerActions → reducer`
4. Do NOT bundle route split (Story 1) and context introduction (Story 2) in the same PR.
5. Do NOT remove or deprecate the `/game` route in this epic.
6. Do NOT render `<Game>` inside `LeagueGamePage` until all 6 hydration steps complete (`sessionReady: true`).
7. `useAutoPlayScheduler` MUST gate on `sessionReady` — see "Scheduler Guard" section above.
