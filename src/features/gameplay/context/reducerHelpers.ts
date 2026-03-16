import type { StrikeoutEntry } from "./gameLogTypes";
import type { GameAction, State } from "./gameStateTypes";

/** Shared logger context passed to handlers that emit play-by-play messages. */
export interface ReducerCtx {
  log: (msg: string) => void;
}

/**
 * Common handler function signature: returns updated State, or undefined when
 * the action is not in this handler's domain (sentinel / fall-through pattern).
 */
export type HandlerFn = (state: State, action: GameAction) => State | undefined;

/**
 * Tries each handler in order and returns the first non-undefined result.
 * Handler precedence is explicit in the call-site array (sim → lifecycle → decisions → setup).
 * Throws for any action type that no handler claims.
 */
export const applyHandlersInOrder = (
  state: State,
  action: GameAction,
  handlers: HandlerFn[],
): State => {
  for (const handler of handlers) {
    const result = handler(state, action);
    if (result !== undefined) return result;
  }
  throw new Error(`No such reducer type as ${action.type}`);
};

/**
 * Returns true when the transition from `prev` to `next` represents a strikeout:
 * prev had 2 strikes, next reset the strike count, and no hit type was recorded
 * (a walk sets hitType = Hit.Walk; a strikeout leaves hitType undefined/null).
 */
export const wasStrikeout = (prev: State, next: State): boolean =>
  prev.strikes === 2 && next.strikes !== 2 && next.hitType == null;

/** Builds the StrikeoutEntry for the batter who just struck out. */
export const makeStrikeoutEntry = (state: State): StrikeoutEntry => {
  const battingTeam = state.atBat as 0 | 1;
  const slotIdx = state.batterIndex[battingTeam];
  const playerId = state.lineupOrder[battingTeam][slotIdx] || undefined;
  return {
    team: battingTeam,
    batterNum: slotIdx + 1,
    ...(playerId ? { playerId } : {}),
  };
};

/**
 * Appends a strikeout log entry to `next` when the play was a strikeout.
 * Compares `prev` (pre-action state) to `next` (post-action state).
 */
export const withStrikeoutLog = (prev: State, next: State): State =>
  wasStrikeout(prev, next)
    ? { ...next, strikeoutLog: [...next.strikeoutLog, makeStrikeoutEntry(prev)] }
    : next;

/**
 * Appends a decision log entry to `result` when `state` had a pending decision.
 * Uses `state.decisionLog` as the base so the new entry always follows the
 * original log, even if `result` was produced by a function that may have
 * modified other fields.
 */
export const withDecisionLog = (state: State, result: State, entry: string): State =>
  state.pendingDecision ? { ...result, decisionLog: [...state.decisionLog, entry] } : result;
