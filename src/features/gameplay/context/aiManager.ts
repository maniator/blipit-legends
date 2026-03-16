/**
 * AI Manager — baseline context-aware decisions for unmanaged teams.
 *
 * This file is a barrel that keeps existing imports stable while the large
 * AI decision logic is split into focused modules.
 */

import type { AiDecision } from "./aiTypes";
import type { DecisionType } from "./decisionTypes";
import type { State } from "./gameStateTypes";
import { PINCH_HITTER_CONTACT_WEIGHT, PINCH_HITTER_POWER_WEIGHT } from "./playerTypes";

export {
  AI_FATIGUE_THRESHOLD_HIGH,
  AI_FATIGUE_THRESHOLD_MEDIUM,
  findBestReliever,
  isPitcherEligibleForChange,
  makeAiPitchingDecision,
} from "./aiPitchingDecision";
export { makeAiStrategyDecision } from "./aiStrategyDecision";
export type {
  AiDecision,
  AiDecisionReason,
  AiNoneDecision,
  AiPitchingChangeDecision,
  AiTacticalDecision,
} from "./aiTypes";

/** Steal success % above which the AI sends the runner. */
const AI_STEAL_THRESHOLD = 0.62;

/**
 * AI tactical decision for the unmanaged batting/fielding team.
 *
 * Given a detected DecisionType (from `detectDecision`), returns what the AI
 * manager would do with it — either acting (AiTacticalDecision) or passing
 * (AiNoneDecision, meaning let the normal pitch proceed).
 */
export function makeAiTacticalDecision(state: State, decision: DecisionType): AiDecision {
  const { score, inning, outs, atBat } = state;
  const scoreDiff = score[0] - score[1]; // positive = away leading

  switch (decision.kind) {
    case "steal": {
      if (decision.successPct >= AI_STEAL_THRESHOLD) {
        return {
          kind: "tactical",
          actionType: "steal_attempt",
          payload: { base: decision.base, successPct: decision.successPct },
          reasonText: "high-percentage steal opportunity",
        };
      }
      return { kind: "none" };
    }

    case "bunt": {
      // Sacrifice bunt when trailing by 1 in innings 7+, 0 outs, runner on first
      const isBehind = atBat === 0 ? scoreDiff < 0 : scoreDiff > 0;
      const isLateCloseGame = inning >= 7 && Math.abs(scoreDiff) <= 1 && outs === 0 && isBehind;
      if (isLateCloseGame) {
        return {
          kind: "tactical",
          actionType: "bunt_attempt",
          payload: {},
          reasonText: "sacrifice bunt in close late game",
        };
      }
      return { kind: "none" };
    }

    case "count30": {
      // Always take a 3-0 pitch (work the count, draw a walk)
      return {
        kind: "tactical",
        actionType: "set_one_pitch_modifier",
        payload: "take",
        reasonText: "taking the pitch with a 3-0 count",
      };
    }

    case "count02": {
      // Protect the plate — swing at anything to avoid a strikeout
      return {
        kind: "tactical",
        actionType: "set_one_pitch_modifier",
        payload: "protect",
        reasonText: "protecting the plate with two strikes",
      };
    }

    case "ibb":
    case "ibb_or_steal": {
      // Always issue the intentional walk when the game situation calls for it
      return {
        kind: "tactical",
        actionType: "intentional_walk",
        payload: {},
        reasonText: "intentional walk — set up the double play",
      };
    }

    case "pinch_hitter": {
      const { candidates, teamIdx, lineupIdx, pitcherHandedness } = decision;
      if (candidates.length > 0) {
        // Composite score: contact first, then power, then platoon edge.
        const bestCandidate = candidates.reduce((best, c) => {
          const bestScore =
            best.contactMod * PINCH_HITTER_CONTACT_WEIGHT +
            best.powerMod * PINCH_HITTER_POWER_WEIGHT +
            (best.matchupDeltaPct ?? 0);
          const candidateScore =
            c.contactMod * PINCH_HITTER_CONTACT_WEIGHT +
            c.powerMod * PINCH_HITTER_POWER_WEIGHT +
            (c.matchupDeltaPct ?? 0);
          return candidateScore > bestScore ? c : best;
        });
        const matchupText =
          pitcherHandedness && bestCandidate.matchupDeltaPct !== undefined
            ? ` vs ${pitcherHandedness}HP (${bestCandidate.matchupDeltaPct >= 0 ? "+" : ""}${bestCandidate.matchupDeltaPct}%)`
            : "";
        const reason =
          (bestCandidate.matchupDeltaPct ?? 0) > 0
            ? "pinch hitter — platoon edge"
            : bestCandidate.contactMod > 0
              ? "pinch hitter — strong contact bat"
              : "pinch hitter — best available";
        return {
          kind: "tactical",
          actionType: "make_substitution",
          payload: {
            teamIdx,
            kind: "batter",
            lineupIdx,
            benchPlayerId: bestCandidate.id,
            reason,
          },
          reasonText: `${bestCandidate.name} in as pinch hitter${matchupText}`,
        };
      }
      // No bench available — fall back to strategy override
      return {
        kind: "tactical",
        actionType: "set_pinch_hitter_strategy",
        payload: "contact",
        reasonText: "pinch hitter in, looking for contact late in the game",
      };
    }

    case "defensive_shift": {
      // Enable shift — AI always uses the shift when offered
      return {
        kind: "tactical",
        actionType: "set_defensive_shift",
        payload: true,
        reasonText: "defensive shift deployed",
      };
    }

    default:
      return { kind: "none" };
  }
}
