import * as React from "react";

import type { PitchingRole } from "@feat/gameplay/components/SubstitutionPanel";
import {
  makeAiPitchingDecision,
  makeAiStrategyDecision,
  makeAiTacticalDecision,
} from "@feat/gameplay/context/aiManager";
import { GameAction, LogAction, State, Strategy } from "@feat/gameplay/context/index";
import type { ManagerDecisionValues } from "@feat/gameplay/context/managerDecisionValues";
import { DEFAULT_MANAGER_DECISION_VALUES } from "@feat/gameplay/context/managerDecisionValues";
import { resolvePitch } from "@feat/gameplay/context/pitchResolutionPipeline";
import { detectDecision } from "@feat/gameplay/context/reducer";

/**
 * Builds and returns the pitch handler callback.
 * Receives current game state as direct parameters for proper React data flow.
 */
export const usePitchDispatch = ({
  dispatch,
  currentState,
  managerMode,
  strategy,
  managedTeam,
  skipDecision,
  dispatchLog,
  allTeamPitcherRoles,
  decisionValues = DEFAULT_MANAGER_DECISION_VALUES,
}: {
  dispatch: (action: GameAction) => void;
  currentState: State;
  managerMode: boolean;
  strategy: Strategy;
  managedTeam: 0 | 1;
  skipDecision: boolean;
  dispatchLog?: (action: LogAction) => void;
  allTeamPitcherRoles?: [Record<string, PitchingRole>, Record<string, PitchingRole>];
  /** Runtime manager/AI decision tuning values. Defaults to DEFAULT_MANAGER_DECISION_VALUES. */
  decisionValues?: ManagerDecisionValues;
}): (() => void) => {
  const handlePitch = React.useCallback(() => {
    if (currentState.gameOver) return;
    if (managerMode && currentState.pendingDecision) return;

    // Defensive shift: offered once per half-inning when the managed team is FIELDING.
    // Respects the defensiveShiftEnabled knob.
    if (
      managerMode &&
      !skipDecision &&
      currentState.atBat !== managedTeam &&
      decisionValues.defensiveShiftEnabled
    ) {
      if (
        !currentState.defensiveShiftOffered &&
        currentState.balls === 0 &&
        currentState.strikes === 0
      ) {
        dispatch({ type: "set_pending_decision", payload: { kind: "defensive_shift" } });
        return;
      }
    }

    if (managerMode && !skipDecision && currentState.atBat === managedTeam) {
      if (currentState.suppressNextDecision) {
        // Clear the suppression flag but still allow this pitch to proceed.
        // Suppression only disables decision evaluation for a single pitch.
        dispatch({ type: "clear_suppress_decision" });
      } else {
        const decision = detectDecision(currentState as State, strategy, true, decisionValues);
        if (decision) {
          dispatch({ type: "set_pending_decision", payload: decision });
          return;
        }
      }
    }

    // ── AI manager for unmanaged teams ────────────────────────────────────────
    // Determine which teams are NOT managed by the human (or both when no manager mode).
    const isBattingUnmanaged = !managerMode || currentState.atBat !== managedTeam;
    const isFieldingUnmanaged = !managerMode || 1 - currentState.atBat !== managedTeam;

    // Context-aware strategy for the unmanaged batting team — only computed when
    // needed (isBattingUnmanaged) so there's no overhead for human-managed pitches.
    const aiStrategy = isBattingUnmanaged
      ? makeAiStrategyDecision(currentState as State, currentState.atBat as 0 | 1)
      : "balanced";

    // Pitching change (fielding team): evaluate at start of each at-bat (0-0 count).
    if (currentState.balls === 0 && currentState.strikes === 0) {
      const pitchingTeamIdx = (1 - currentState.atBat) as 0 | 1;
      if (isFieldingUnmanaged) {
        const roles = allTeamPitcherRoles?.[pitchingTeamIdx] ?? {};
        const aiDecision = makeAiPitchingDecision(
          currentState as State,
          pitchingTeamIdx,
          roles,
          decisionValues.aiPitchingChangeAggressiveness,
        );
        if (aiDecision.kind === "pitching_change") {
          dispatch({
            type: "make_substitution",
            payload: {
              teamIdx: aiDecision.teamIdx,
              kind: "pitcher",
              pitcherIdx: aiDecision.pitcherIdx,
              reason: aiDecision.reasonText,
            },
          });
          // Continue — the pitch is still processed after the substitution.
        }
      }
    }

    // Fielding-team AI: defensive shift (unmanaged fielding team).
    // Respects the defensiveShiftEnabled knob.
    if (
      isFieldingUnmanaged &&
      decisionValues.defensiveShiftEnabled &&
      !currentState.defensiveShiftOffered &&
      currentState.balls === 0 &&
      currentState.strikes === 0
    ) {
      const shiftDecision = makeAiTacticalDecision(
        currentState as State,
        { kind: "defensive_shift" },
        decisionValues,
      );
      if (shiftDecision.kind === "tactical") {
        dispatch({
          type: shiftDecision.actionType as GameAction["type"],
          payload: shiftDecision.payload,
        });
        // The reducer for the defensive shift action marks the shift as offered so
        // we don't re-offer it every 0-0 count; no need for a pending/skip pair here.
        dispatchLog?.({ type: "log", payload: `The manager: ${shiftDecision.reasonText}.` });
        // Fall through — the pitch is still processed in the same tick.
      }
    }

    // Batting-team AI: tactical decisions (steal, bunt, count modifiers, pinch-hitter).
    if (isBattingUnmanaged) {
      if (currentState.suppressNextDecision) {
        // Mirror the human-manager path: clear the suppress flag so AI decisions
        // resume for the next batter (e.g. after an intentional walk).
        dispatch({ type: "clear_suppress_decision" });
        // Fall through to normal pitch after clearing the suppress flag.
      } else {
        // AI picks a context-aware strategy (same choices a human manager has).
        const battingDecision = detectDecision(
          currentState as State,
          aiStrategy,
          true,
          decisionValues,
        );
        if (battingDecision) {
          const aiAction = makeAiTacticalDecision(
            currentState as State,
            battingDecision,
            decisionValues,
          );
          if (aiAction.kind === "tactical") {
            dispatch({
              type: aiAction.actionType as GameAction["type"],
              payload: aiAction.payload,
            });
            // After AI makes a concrete pinch-hit substitution, lock pinchHitterStrategy to
            // prevent the decision from being re-offered during this at-bat.
            // Use "contact" to reflect the AI's late-game tactical intent.
            if (
              battingDecision.kind === "pinch_hitter" &&
              aiAction.actionType === "make_substitution"
            ) {
              dispatch({ type: "set_pinch_hitter_strategy", payload: "contact" });
            }
            // Only log discrete, visible actions. Transient one-pitch modifiers
            // (set_one_pitch_modifier, set_pinch_hitter_strategy) are re-applied on
            // every pitch at the same count and would spam the play-by-play log.
            const isDiscreteAction = [
              "steal_attempt",
              "bunt_attempt",
              "intentional_walk",
              "make_substitution",
              "set_defensive_shift",
            ].includes(aiAction.actionType);
            if (isDiscreteAction) {
              dispatchLog?.({
                type: "log",
                payload: `The manager: ${aiAction.reasonText}.`,
              });
            }
            // Decisions that replace the pitch (steal_attempt, bunt_attempt,
            // intentional_walk) should return early so the regular pitch is not
            // also dispatched in the same tick.
            const replacePitch = ["steal_attempt", "bunt_attempt", "intentional_walk"].includes(
              aiAction.actionType,
            );
            if (replacePitch) return;
          } else {
            // AI decided not to act — skip the decision so it is not re-offered
            dispatch({ type: "skip_decision" });
          }
        }
      }
    }
    // ── End AI manager ────────────────────────────────────────────────────────

    // ── Pitch resolution pipeline ─────────────────────────────────────────────

    // For unmanaged batting teams, use the AI's context-aware strategy.
    // For the human-managed team, use the human's configured strategy.
    // This applies regardless of whether the opposing team has a human manager.
    const baseStrategy = isBattingUnmanaged ? aiStrategy : strategy;
    const effectiveStrategy = currentState.pinchHitterStrategy ?? baseStrategy;
    const onePitchMod = currentState.onePitchModifier;
    resolvePitch({
      currentState,
      effectiveStrategy,
      onePitchMod,
      dispatch,
    });
  }, [
    dispatch,
    dispatchLog,
    currentState,
    managedTeam,
    managerMode,
    allTeamPitcherRoles,
    skipDecision,
    strategy,
    decisionValues,
  ]);

  return handlePitch;
};
