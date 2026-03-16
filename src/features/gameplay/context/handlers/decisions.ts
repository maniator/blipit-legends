import type { DecisionType, OnePitchModifier } from "../decisionTypes";
import type { GameAction, State } from "../gameStateTypes";
import { createPitcherLogEntry, pushPitcherLogEntry } from "../pitcherLog";
import type { Strategy } from "../playerTypes";
import type { ReducerCtx } from "../reducerHelpers";
import { withDecisionLog } from "../reducerHelpers";

/**
 * Handles manager/UI decision state actions.
 * Returns `undefined` for any action type that is not a decision action,
 * allowing the root reducer to fall through to its own branches.
 */
export const handleDecisionsAction = (
  state: State,
  action: GameAction,
  ctx: ReducerCtx,
): State | undefined => {
  const { log } = ctx;

  switch (action.type) {
    case "set_one_pitch_modifier": {
      const result = {
        ...state,
        onePitchModifier: action.payload as OnePitchModifier,
        pendingDecision: null,
      };
      return withDecisionLog(state, result, `${state.pitchKey}:${action.payload}`);
    }
    case "skip_decision": {
      const result = { ...state, pendingDecision: null };
      return withDecisionLog(state, result, `${state.pitchKey}:skip`);
    }
    case "set_pending_decision": {
      const newState: State = { ...state, pendingDecision: action.payload as DecisionType };
      if ((action.payload as DecisionType).kind === "defensive_shift") {
        newState.defensiveShiftOffered = true;
      }
      return newState;
    }
    case "clear_suppress_decision":
      return { ...state, suppressNextDecision: false };
    case "set_pinch_hitter_strategy": {
      const ph = action.payload as Strategy;
      const battingTeam = state.teamLabels[state.atBat as 0 | 1];
      log(`${battingTeam} manager: Pinch hitter in — playing ${ph} strategy.`);
      const result = { ...state, pinchHitterStrategy: ph, pendingDecision: null };
      return withDecisionLog(state, result, `${state.pitchKey}:pinch:${ph}`);
    }
    case "set_defensive_shift": {
      const shiftOn = action.payload as boolean;
      // Suppress re-announcement when the shift state hasn't actually changed.
      // Always set defensiveShiftOffered=true so the AI does not re-evaluate every at-bat.
      if (shiftOn === state.defensiveShift) {
        // True no-op: nothing to update at all.
        if (state.pendingDecision === null && state.defensiveShiftOffered) return state;
        const result = { ...state, pendingDecision: null, defensiveShiftOffered: true };
        // If this resolves a real pending decision, record it in decisionLog so
        // deterministic replay (useReplayDecisions) captures the manager's choice.
        if (state.pendingDecision !== null) {
          return withDecisionLog(
            state,
            result,
            `${state.pitchKey}:shift:${shiftOn ? "on" : "off"}`,
          );
        }
        return result;
      }
      const fieldingTeam = state.teamLabels[(1 - (state.atBat as number)) as 0 | 1];
      if (shiftOn)
        log(`${fieldingTeam} manager: Defensive shift deployed — outfield repositioned.`);
      else log(`${fieldingTeam} manager: Normal alignment restored.`);
      const result = {
        ...state,
        defensiveShift: shiftOn,
        pendingDecision: null,
        defensiveShiftOffered: true,
      };
      return withDecisionLog(state, result, `${state.pitchKey}:shift:${shiftOn ? "on" : "off"}`);
    }
    case "make_substitution": {
      const p = action.payload as {
        teamIdx: 0 | 1;
        kind: "batter" | "pitcher";
        lineupIdx?: number;
        benchPlayerId?: string;
        pitcherIdx?: number;
        reason?: string;
      };
      const { teamIdx, kind } = p;
      const getPlayerName = (id: string): string =>
        state.playerOverrides[teamIdx][id]?.nickname ?? id.slice(0, 8);

      if (kind === "batter") {
        const { lineupIdx, benchPlayerId } = p;
        if (
          lineupIdx === undefined ||
          !benchPlayerId ||
          lineupIdx < 0 ||
          lineupIdx >= state.lineupOrder[teamIdx].length ||
          !state.rosterBench[teamIdx].includes(benchPlayerId)
        ) {
          return state;
        }
        const oldPlayerId = state.lineupOrder[teamIdx][lineupIdx];
        // No-reentry: refuse if bench player was already substituted out.
        if (state.substitutedOut[teamIdx].includes(benchPlayerId)) {
          return state;
        }
        const newLineup = [...state.lineupOrder[teamIdx]];
        newLineup[lineupIdx] = benchPlayerId;
        // Remove incoming player from bench; return old player to bench but mark as substituted out.
        const newBench = state.rosterBench[teamIdx].filter((id) => id !== benchPlayerId);
        newBench.push(oldPlayerId);
        const newLineupOrder: [string[], string[]] = [
          teamIdx === 0 ? newLineup : state.lineupOrder[0],
          teamIdx === 1 ? newLineup : state.lineupOrder[1],
        ];
        const newRosterBench: [string[], string[]] = [
          teamIdx === 0 ? newBench : state.rosterBench[0],
          teamIdx === 1 ? newBench : state.rosterBench[1],
        ];
        // Track the old player as substituted out (no-reentry).
        const newSubOut: [string[], string[]] = [
          teamIdx === 0 ? [...state.substitutedOut[0], oldPlayerId] : state.substitutedOut[0],
          teamIdx === 1 ? [...state.substitutedOut[1], oldPlayerId] : state.substitutedOut[1],
        ];
        const reasonSuffix = p.reason ? ` (${p.reason})` : "";
        const teamName = state.teamLabels[teamIdx];
        log(
          `${teamName}: ${getPlayerName(benchPlayerId)} in for ${getPlayerName(oldPlayerId)}${reasonSuffix}.`,
        );
        return {
          ...state,
          lineupOrder: newLineupOrder,
          rosterBench: newRosterBench,
          substitutedOut: newSubOut,
          // Clear the pending decision so the new batter's at-bat proceeds immediately.
          pendingDecision: null,
        };
      }

      if (kind === "pitcher") {
        const { pitcherIdx } = p;
        if (
          pitcherIdx === undefined ||
          pitcherIdx < 0 ||
          pitcherIdx >= state.rosterPitchers[teamIdx].length ||
          pitcherIdx === state.activePitcherIdx[teamIdx]
        ) {
          return state;
        }
        const newPitcherId = state.rosterPitchers[teamIdx][pitcherIdx];
        // No-reentry: refuse if incoming pitcher was already substituted out.
        if (state.substitutedOut[teamIdx].includes(newPitcherId)) {
          return state;
        }
        const oldPitcherId = state.rosterPitchers[teamIdx][state.activePitcherIdx[teamIdx]];
        const newActivePitcherIdx: [number, number] = [
          teamIdx === 0 ? pitcherIdx : state.activePitcherIdx[0],
          teamIdx === 1 ? pitcherIdx : state.activePitcherIdx[1],
        ];
        // Track the old pitcher as substituted out (no-reentry).
        const newSubOut: [string[], string[]] = [
          teamIdx === 0 ? [...state.substitutedOut[0], oldPitcherId] : state.substitutedOut[0],
          teamIdx === 1 ? [...state.substitutedOut[1], oldPitcherId] : state.substitutedOut[1],
        ];
        // Reset batters-faced and pitch-count counters for the new pitcher.
        const newBattersFaced: [number, number] = [
          teamIdx === 0 ? 0 : state.pitcherBattersFaced[0],
          teamIdx === 1 ? 0 : state.pitcherBattersFaced[1],
        ];
        const newPitchCount: [number, number] = [
          teamIdx === 0 ? 0 : (state.pitcherPitchCount ?? [0, 0])[0],
          teamIdx === 1 ? 0 : (state.pitcherPitchCount ?? [0, 0])[1],
        ];
        const reasonSuffix = p.reason ? ` (${p.reason})` : "";
        const teamName = state.teamLabels[teamIdx];
        log(`${teamName} manager: ${getPlayerName(newPitcherId)} now pitching${reasonSuffix}.`);
        // Add a new pitcher log entry for the incoming pitcher.
        const newEntry = createPitcherLogEntry(teamIdx, newPitcherId, state);
        const newPitcherGameLog = pushPitcherLogEntry(
          state.pitcherGameLog ?? [[], []],
          teamIdx,
          newEntry,
        );
        return {
          ...state,
          activePitcherIdx: newActivePitcherIdx,
          substitutedOut: newSubOut,
          pitcherBattersFaced: newBattersFaced,
          pitcherPitchCount: newPitchCount,
          pitcherGameLog: newPitcherGameLog,
        };
      }

      return state;
    }
    default:
      return undefined;
  }
};
