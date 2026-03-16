import type { State } from "./gameStateTypes";
import type { Strategy } from "./playerTypes";

/**
 * AI manager strategy selection — mirrors the choices a human manager can make.
 *
 * Picks a batting strategy based on game context so the unmanaged team responds
 * intelligently instead of always using "balanced".
 *
 * Rules (evaluated in priority order):
 *  - Down 2+ late game (inning ≥ 7) → "power"   (swing for extra bases)
 *  - Down 1  late game (inning ≥ 7) → "aggressive" (pressure the bases)
 *  - 2 outs, close game (±2), inning ≥ 7 → "aggressive" (extend the inning)
 *  - Early game with runners in scoring position → "contact" (put ball in play)
 *  - Default → "balanced"
 */
export function makeAiStrategyDecision(state: State, battingTeamIdx: 0 | 1): Strategy {
  const { score, inning, outs } = state;
  const battingScore = score[battingTeamIdx];
  const fieldingScore = score[1 - battingTeamIdx];
  const runDiff = battingScore - fieldingScore; // positive = batting team leading

  if (inning >= 7) {
    if (runDiff <= -2) return "power";
    if (runDiff === -1) return "aggressive";
  }

  if (outs === 2 && inning >= 7 && Math.abs(runDiff) <= 2) return "aggressive";

  // Runners in scoring position (no other condition matched) → contact hitting (put it in play)
  const { baseLayout } = state;
  if (baseLayout[1] || baseLayout[2]) return "contact";

  return "balanced";
}
