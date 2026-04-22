/**
 * Swing-outcome helpers.
 *
 * Given that a batter has decided to swing, resolves whether the swing produces
 * a whiff, foul ball, or contact.
 */

/** The outcome when a batter swings at a pitch. */
export type SwingOutcome = "whiff" | "foul" | "contact";

/**
 * Options for `resolveSwingOutcome`.
 *
 * All fields are optional — defaults model an average pitcher facing an average batter.
 */
export interface ResolveSwingOutcomeOptions {
  /** Pitcher's velocity modifier (−20 … +20). Increases whiff rate. */
  pitcherVelocityMod?: number;
  /** Pitcher's movement modifier. Shifts fouls vs. contact. */
  pitcherMovementMod?: number;
  /** Batter's contact modifier. Reduces whiff and foul rates. */
  batterContactMod?: number;
  /** Pitcher fatigue (≥ 1.0; higher = more tired, reduces velocity effectiveness). */
  fatigueFactor?: number;
  /** Handedness/platoon multiplier applied to whiff threshold. */
  whiffRateMultiplier?: number;
}

/**
 * Determine whether a swing results in a whiff, foul, or contact.
 *
 * Uses a 0–99 roll.  Thresholds are modified by pitcher stuff and batter
 * contact skill.  Fatigue softens pitcher velocity effectiveness.
 *
 * Base rates: whiff 20%, foul 33%, contact 47%.
 *
 * @param roll     0–99 random roll from the caller.
 * @param options  Pitcher/batter modifier options (all default to 0 / 1.0).
 */
export const resolveSwingOutcome = (
  roll: number,
  {
    pitcherVelocityMod = 0,
    pitcherMovementMod = 0,
    batterContactMod = 0,
    fatigueFactor = 1.0,
    whiffRateMultiplier = 1,
  }: ResolveSwingOutcomeOptions = {},
): SwingOutcome => {
  const baseWhiff = 20;
  const baseFoul = 33;

  // Velocity adds to whiff (harder to square up); fatigue reduces this bonus.
  const velocityBonus = Math.round(pitcherVelocityMod / 5);
  const fatigueReduction = Math.round((fatigueFactor - 1) * 8);
  // Batter contact skill reduces whiff probability.
  const contactReduction = Math.round(batterContactMod / 10);

  const whiffThreshold = Math.max(
    8,
    Math.min(
      40,
      Math.round(
        (baseWhiff + velocityBonus - fatigueReduction - contactReduction) * whiffRateMultiplier,
      ),
    ),
  );

  // Movement shifts energy from contact to foul/weak contact.
  const movementFoulBonus = Math.round(pitcherMovementMod / 6);
  const contactFoulReduction = Math.round(batterContactMod / 20);
  const foulThreshold = Math.max(
    whiffThreshold + 15,
    Math.min(75, whiffThreshold + baseFoul + movementFoulBonus - contactFoulReduction),
  );

  if (roll < whiffThreshold) return "whiff";
  if (roll < foulThreshold) return "foul";
  return "contact";
};
