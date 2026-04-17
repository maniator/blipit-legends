import type { PinchHitterCandidate } from "./playerTypes";

export type DecisionType =
  | { kind: "steal"; base: 0 | 1; successPct: number }
  | { kind: "bunt" }
  | { kind: "count30" }
  | { kind: "count02" }
  | { kind: "ibb" }
  | { kind: "ibb_or_steal"; base: 0 | 1; successPct: number }
  | {
      kind: "pinch_hitter";
      /** Available bench players for selection (empty when no bench roster is set). */
      candidates: PinchHitterCandidate[];
      /** Team index that is batting (the team making the substitution). */
      teamIdx: 0 | 1;
      /** Lineup position index of the current batter being replaced. */
      lineupIdx: number;
      /** Throwing side of the active pitcher the pinch hitter would face. */
      pitcherHandedness?: "R" | "L";
      /** Current batter platoon edge (positive = batter edge). */
      currentBatterMatchupDeltaPct?: number;
      /** Completed plate appearances for the current batter this game. */
      currentBatterPlateAppearances?: number;
      /** Current batter fatigue penalties for manager decision context. */
      currentBatterFatigueContactPenalty?: number;
      currentBatterFatiguePowerPenalty?: number;
    }
  | { kind: "defensive_shift" };

export type OnePitchModifier = "take" | "swing" | "protect" | "normal" | null;
