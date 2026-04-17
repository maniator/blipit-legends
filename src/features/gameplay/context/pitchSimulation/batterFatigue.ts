/**
 * Batter fatigue model.
 *
 * Uses completed plate appearances for the current game as workload. Higher
 * stamina shifts fatigue onset later. Returns bounded penalties that are
 * intentionally modest in v1 to avoid broad offense rebalance.
 */

export interface ComputeBatterFatigueFactorResult {
  /** Multiplicative fatigue factor where 1.0 is fresh and higher is more tired. */
  fatigueFactor: number;
  /** Contact-mod penalty to apply (subtract from contact mod). */
  contactPenalty: number;
  /** Power-mod penalty to apply (subtract from power mod). */
  powerPenalty: number;
}

/**
 * Compute batter fatigue from game-local workload.
 *
 * @param plateAppearances Completed PAs this game for the batter.
 * @param staminaMod Batter stamina modifier (typically -20..+20).
 */
export const computeBatterFatigueFactor = (
  plateAppearances: number,
  staminaMod: number,
): ComputeBatterFatigueFactorResult => {
  // Most batters remain effectively fresh early; higher stamina delays onset.
  // Round away from zero so ±5 staminaMod both have an effect (Math.round alone
  // would round −0.5 toward +∞, making −5 silently identical to 0).
  const freshPaThreshold = 3 + Math.sign(staminaMod) * Math.round(Math.abs(staminaMod) / 10);
  const paBeyond = Math.max(0, plateAppearances - freshPaThreshold);

  // Keep v1 effect gentle and bounded.
  const fatigueFactor = Math.min(1.24, 1 + paBeyond * 0.03);
  const contactPenalty = Math.min(10, Math.round((fatigueFactor - 1) * 42));
  const powerPenalty = Math.min(6, Math.round((fatigueFactor - 1) * 24));

  return { fatigueFactor, contactPenalty, powerPenalty };
};
