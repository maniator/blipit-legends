# 02 — Winston Architecture Spec: GameSessionContext

> Winston (System Architect) — 2026-05-11  
> Verdict: APPROVED for implementation as specified below.

---

## Context Interface

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
  };
}
```

## How `GamePage` Wraps the Context (Legacy Save-Resume Path)

`GamePage` cannot derive `GameSessionContextValue` statically at render time because the auto-resume
flow reads the `SaveRecord` asynchronously (reactive save list, then matched save effect). The value
must be mutable state:

```typescript
// GamePage.tsx — after Story 2
const [sessionCtx, setSessionCtx] = React.useState<GameSessionContextValue>(() => ({
  sessionType: "exhibition",
  managerModeAllowed: pendingLoadSave?.setup.managedTeam !== null ?? true,
  disableSave: false,
  seasonGameId: null,
  managedTeam: pendingLoadSave?.setup.managedTeam ?? null,
}));

// After auto-resume effect fires (when the reactive save is matched and consumed):
// setSessionCtx({ ...sessionCtx, managerModeAllowed: restoredSave.setup.managedTeam !== null, ... });

return (
  <GameSessionProvider value={sessionCtx}>
    <GameProviderWrapper>
      <GameInner ... />
    </GameProviderWrapper>
  </GameSessionProvider>
);
```

`GamePage` **must** be in Story 2's files-changed list. Forgetting it causes a runtime crash
on any save-resume flow once Story 2 is live.

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
    ...overrides,
  };
}

// Usage in tests:
// render(
//   <GameSessionProvider value={makeGameSessionContext({ managerModeAllowed: false })}>
//     <GameControls />
//   </GameSessionProvider>
// );
```

## BLOCK Constraints (mandatory — stop if violated)

1. Do NOT add `GameSessionContextValue` fields to `GameContext` (simulation context).
2. Do NOT nest `GameSessionProvider` inside `GameProviderWrapper`.
3. Do NOT import from `GameSessionContext` inside any module in the cycle-free chain:
   `strategy → advanceRunners → gameOver → playerOut → hitBall → buntAttempt → playerActions → reducer`
4. Do NOT bundle route split (Story 1) and context introduction (Story 2) in the same PR.
5. Do NOT remove or deprecate the `/game` route in this epic.
