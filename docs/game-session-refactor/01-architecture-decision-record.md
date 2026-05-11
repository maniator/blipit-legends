# ADR: GameSessionContext + Game Route Split

> **Author:** Winston (System Architect)  
> **Date:** 2026-05-11  
> **Status:** APPROVED — implement in the pre-v2 game-session-refactor epic  
> **Verdict:** REQUEST_CHANGES on current prop-drilling; APPROVED for the planned context approach

---

## Context

League v1 introduced `disableSave`, `seasonGameId`, and `managedTeam` as discriminating fields on
`ExhibitionGameSetup`. Watch-mode gating added `managerModeAllowed` as local state in `GameInner`
prop-drilled to `GameControls`. Every new game session variant layered another if-check into the
middle of the component tree. This is unsustainable.

## Decision

### 1. Introduce `GameSessionContext`

A new context at `src/features/gameplay/context/GameSessionContext.tsx`:

```typescript
export type GameSessionType = "exhibition" | "league";

export interface GameSessionContextValue {
  /** "exhibition" | "league" */
  sessionType: GameSessionType;
  /** When false, manager controls are hidden and cannot be enabled. */
  managerModeAllowed: boolean;
  /** When true, GameInner skips creating a mid-game RxDB save slot. */
  disableSave: boolean;
  /** When set, GameInner calls applySeasonGameResult on FINAL. */
  seasonGameId: string | null;
  /** Which team (if any) the user manages — mirrors ExhibitionGameSetup.managedTeam. */
  managedTeam: 0 | 1 | null;
}

export const GameSessionContext =
  React.createContext<GameSessionContextValue | undefined>(undefined);

export const useGameSessionContext = (): GameSessionContextValue => {
  const ctx = React.useContext(GameSessionContext);
  if (!ctx) throw new Error("useGameSessionContext must be used within GameSessionProvider");
  return ctx;
};

export const GameSessionProvider: React.FunctionComponent<{
  value: GameSessionContextValue;
  children: React.ReactNode;
}> = ({ value, children }) => (
  <GameSessionContext.Provider value={value}>{children}</GameSessionContext.Provider>
);
```

### 2. Component tree after refactor

```
GamePage (route — reads location.state, derives GameSessionContextValue)
  GameSessionProvider (value={derivedSession})
    GameProviderWrapper (simulation context — unchanged)
      GameInner (pure game loop — zero session if-checks, reads useGameSessionContext())
        GameControls (reads useGameSessionContext() for managerModeAllowed — no prop)
        useRxdbGameSync (reads disableSave from useGameSessionContext())
        useSeasonGameSync (reads seasonGameId from useGameSessionContext())
```

### 3. Route split (Story 1 — see `02-route-split-design.md`)

New routes:

| Route                        | Page Component         | Session Derived From                                                               |
| ---------------------------- | ---------------------- | ---------------------------------------------------------------------------------- |
| `/game/exhibition`           | `ExhibitionGamePage`   | `location.state.pendingGameSetup` (managedTeam, overrides, seed)                   |
| `/game/league/:seasonGameId` | `LeagueGamePage`       | URL param + SeasonContext (seasonGameId, managedTeam from season.userCustomTeamId) |
| `/game`                      | `GamePage` (unchanged) | Legacy: `location.state` as today — handles saves resume                           |

The legacy `/game` route remains to handle `SavesPage` navigation (which does
`navigate("/game", { state: { pendingLoadSave: slot } })`). It is not deprecated in this epic.

### 4. Session derivation logic

**Exhibition session** (from `location.state.pendingGameSetup`):

```typescript
const derivedSession: GameSessionContextValue = {
  sessionType: "exhibition",
  managerModeAllowed: setup.managedTeam !== null,
  disableSave: false,
  seasonGameId: null,
  managedTeam: setup.managedTeam,
};
```

**League session** (from URL param + SeasonContext):

```typescript
const derivedSession: GameSessionContextValue = {
  sessionType: "league",
  managerModeAllowed: managedTeamIdx !== null, // from season.userCustomTeamId lookup
  disableSave: true,
  seasonGameId: seasonGameIdParam,
  managedTeam: managedTeamIdx,
};
```

**Legacy saves session** (from `location.state.pendingLoadSave` — `GamePage` on `/game`):

`GamePage` must also wrap `<GameSessionProvider>`. The save-resume flow reads the
`SaveRecord.setup.managedTeam` from the restored state to derive `managerModeAllowed`:

```typescript
// GamePage derives session after consuming pendingLoadSave:
const derivedSaveSession: GameSessionContextValue = {
  sessionType: "exhibition", // saves are always exhibition games
  managerModeAllowed: slot.setup.managedTeam !== null,
  disableSave: false, // saves always write back
  seasonGameId: null,
  managedTeam: slot.setup.managedTeam,
};
```

For the **auto-resume path** (no `pendingLoadSave` — `GamePage` restores from the reactive
saves list on first mount), `GamePage` defaults to `managerModeAllowed: true` until the save
is consumed, then updates the `GameSessionContextValue` once the auto-resume effect fires.
This requires `GameSessionContextValue` to be mutable state inside `GamePage` (a `useState`),
not a static derivation at render time.

**Story 2 must include `GamePage` in the files-changed list.** Failure to wrap `GamePage` with
`<GameSessionProvider>` causes a runtime crash ("useGameSessionContext must be used within
GameSessionProvider") on any save-resume flow.

---

## BLOCK Constraints — Must Not Be Violated

1. **Do NOT add `GameSessionContext` or any session metadata to `GameContext`.**
   `GameContext` is the simulation engine. It holds score, inning, outs, runners, PRNG-adjacent
   values. Any session metadata there pollutes the pure-logic boundary and risks PRNG call-order
   violations as the simulation chain cannot safely import UI-layer contexts.

2. **`GameSessionProvider` MUST wrap `GameProviderWrapper`, not be nested inside it.**
   Session determines the rules; simulation runs under those rules. Inverting this order creates a
   context where session queries might fire before the simulation state is initialized.

3. **No imports from `GameSessionContext` inside the cycle-free simulation chain.**
   The cycle-free order `strategy → advanceRunners → gameOver → playerOut → hitBall → buntAttempt →
playerActions → reducer` must stay free of UI-layer imports. `GameSessionContext` is UI-layer.
   Any gameplay module importing from it would break the chain and invalidate PRNG replay guarantees.

4. **Do NOT split routes and introduce `GameSessionContext` in the same PR.**
   Two architectural changes in one diff make revert impossible. Story 1 is routes; Story 2 is
   context extraction; Story 3 removes the if-checks. This ordering is mandatory.

5. **Do NOT deprecate or remove the `/game` route in this epic.**
   Save-resume navigation (`SavesPage` → `/game`) must continue to work. Migration of that flow is
   post-v2 scope.

---

## Alternatives Rejected

| Alternative                                  | Reason Rejected                                                                                |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Add session metadata to `GameContext`        | Category error — simulation context must stay pure                                             |
| Use `SeasonContext` for league game sessions | Exhibition games have no SeasonContext; creates coupling                                       |
| Use URL query params for session type        | Requires migration of `location.state` contract; bigger blast radius than needed for this epic |
| Prop-drill all session values                | Already done and identified as unsustainable (the current problem)                             |
| Single fat `GamePage` with more if-checks    | Worsens the problem we are solving                                                             |

---

## Acceptance Criteria

- `GameSessionContext` exists at `src/features/gameplay/context/GameSessionContext.tsx`
- `useGameSessionContext()` hook throws a clear error if called outside the provider
- `GameInner` has **zero** direct reads of `setup.disableSave`, `setup.seasonGameId`,
  `setup.managedTeam` — all replaced by `useGameSessionContext()`
- `GameControls` has **zero** `managerModeAllowed` prop — reads from `useGameSessionContext()`
- `useRxdbGameSync` reads `disableSave` from `useGameSessionContext()` (not from a ref)
- `useSeasonGameSync` reads `seasonGameId` from `useGameSessionContext()` (not from a ref)
- Unit tests for `GameSessionContext` exist with mocked provider values
- `GameControls` unit tests use `<GameSessionProvider>` wrapper (no prop)
- `/game/exhibition` and `/game/league/:seasonGameId` routes exist and pass E2E smoke tests
- `/game` legacy route still handles save-resume (E2E regression guard)
- Winston CR sign-off received before PR is created
