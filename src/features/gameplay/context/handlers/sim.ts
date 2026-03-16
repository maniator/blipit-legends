import type { PitchType } from "@feat/gameplay/constants/pitchTypes";
import { pitchName } from "@feat/gameplay/constants/pitchTypes";
import { Hit } from "@shared/constants/hitTypes";

import { checkWalkoff } from "../gameOver";
import type { GameAction, State } from "../gameStateTypes";
import { handleBallInPlay, hitBall } from "../hitBall";
import type { BattedBallType } from "../pitchSimulation";
import { buntAttempt, playerStrike, playerWait, stealAttempt } from "../playerActions";
import { incrementPitchCount } from "../playerOut";
import type { Strategy } from "../playerTypes";
import type { ReducerCtx } from "../reducerHelpers";
import { withDecisionLog, withStrikeoutLog } from "../reducerHelpers";

/**
 * Handles simulation (on-field) actions.
 * Returns `undefined` for any action type that is not a sim action,
 * allowing the root reducer to fall through to its own branches.
 * The `default` branch is the sole sentinel — no separate membership set needed.
 */
export const handleSimAction = (
  state: State,
  action: GameAction,
  ctx: ReducerCtx,
): State | undefined => {
  const { log } = ctx;

  switch (action.type) {
    case "hit": {
      const p = action.payload as { battedBallType: BattedBallType; strategy?: Strategy };
      const strategy: Strategy = p?.strategy ?? "balanced";
      // Count this pitch (ball in play) before resolving the hit.
      const stateWithPitch = incrementPitchCount(state);
      // Saves restore from stateSnapshot (not event replay), so all "hit" actions
      // in active play carry a battedBallType — no legacy hitType fallback needed.
      return checkWalkoff(
        handleBallInPlay(p.battedBallType, stateWithPitch, log, { strategy }),
        log,
      );
    }
    case "strike": {
      const sp = action.payload as { swung?: boolean; pitchType?: PitchType };
      const result = playerStrike(state, log, sp?.swung ?? false, false, sp?.pitchType);
      return withStrikeoutLog(state, result);
    }
    case "foul": {
      const fp = action.payload as { pitchType?: PitchType };
      const pt = fp?.pitchType;
      if (state.strikes < 2) return playerStrike(state, log, true, true, pt);
      const msg = pt ? `${pitchName(pt)} — foul ball — count stays.` : "Foul ball — count stays.";
      log(msg);
      // Count this pitch (foul with 2 strikes — count stays, but a pitch was thrown).
      const stateWithPitch = incrementPitchCount(state);
      return {
        ...stateWithPitch,
        pendingDecision: null,
        hitType: undefined,
        pitchKey: (stateWithPitch.pitchKey ?? 0) + 1,
      };
    }
    case "wait": {
      const wp = action.payload as {
        strategy?: Strategy;
        pitchType?: PitchType;
        walkRateMultiplier?: number;
        calledStrikeRateMultiplier?: number;
      };
      const result = playerWait(
        state,
        log,
        wp?.strategy ?? "balanced",
        state.onePitchModifier,
        wp?.pitchType,
        {
          walkRateMultiplier: wp?.walkRateMultiplier,
          calledStrikeRateMultiplier: wp?.calledStrikeRateMultiplier,
        },
      );
      // checkWalkoff is required here: a 4th ball (walk) can score the game-winning run
      // in the bottom of the 9th or later (e.g. bases-loaded walk in extra innings).
      // Without it, tie games would continue past the walkoff pitch instead of ending immediately.
      return checkWalkoff(withStrikeoutLog(state, result), log);
    }
    case "steal_attempt": {
      const { successPct, base } = action.payload as { successPct: number; base: 0 | 1 };
      const result = stealAttempt(state, log, successPct, base);
      return withDecisionLog(state, result, `${state.pitchKey}:steal:${base}:${successPct}`);
    }
    case "bunt_attempt": {
      const bp = action.payload as { strategy?: Strategy };
      const result = checkWalkoff(buntAttempt(state, log, bp?.strategy ?? "balanced"), log);
      return withDecisionLog(state, result, `${state.pitchKey}:bunt`);
    }
    case "intentional_walk": {
      const fieldingTeam = state.teamLabels[(1 - (state.atBat as number)) as 0 | 1];
      log(`${fieldingTeam} manager issues an intentional walk.`);
      // Count as a single pitch event — the engine models the full IBB sequence as one pitch.
      const stateWithPitch = incrementPitchCount(state);
      const result = checkWalkoff(
        hitBall(
          Hit.Walk,
          { ...stateWithPitch, pendingDecision: null, suppressNextDecision: true },
          log,
        ),
        log,
      );
      return withDecisionLog(state, result, `${state.pitchKey}:ibb`);
    }
    default:
      return undefined;
  }
};
