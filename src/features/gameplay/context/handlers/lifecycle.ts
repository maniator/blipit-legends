import type { GameAction, State } from "../gameStateTypes";
import { backfillRestoredState, createFreshGameState } from "../initialState";

/**
 * Handles game-lifecycle actions: reset, restore_game, nextInning.
 * Returns `undefined` for any action type that is not a lifecycle action,
 * allowing the root reducer to fall through to its own branches.
 * Reuses shared initialState helpers from Stage 1 rather than inlining literals.
 */
export const handleLifecycleAction = (state: State, action: GameAction): State | undefined => {
  switch (action.type) {
    case "reset":
      return createFreshGameState(state.teams, state.teamLabels);
    case "restore_game":
      return backfillRestoredState(action.payload as State);
    case "nextInning":
      return { ...state, inning: state.inning + 1 };
    default:
      return undefined;
  }
};
