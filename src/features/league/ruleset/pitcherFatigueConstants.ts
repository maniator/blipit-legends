/**
 * Pitcher fatigue constants keyed by ruleset version.
 *
 * These values govern pitcher availability decay and recovery across game days.
 * They are version-gated so season replays remain deterministic — a season
 * created with rulesetVersion 1 always uses v1 constants even if the app has
 * since advanced to a newer ruleset.
 *
 * Glossary:
 *   - SP  = Starting Pitcher
 *   - RP  = Relief Pitcher
 *   - Recovery curve: maps days of rest (0, 1, 2, …) → cumulative availability
 *     fraction recovered after that many rest days following an appearance.
 *   - Eligibility threshold: minimum availability required before a pitcher
 *     can be assigned to a start (SP) or a relief appearance (RP).
 *   - Max fatigue effect: maximum performance penalty applied at 0 availability.
 */

export interface PitcherFatigueConstants {
  /**
   * SP recovery curve: days-of-rest → availability after an appearance.
   * Keys are string-ified integers for JSON serialisation compatibility.
   */
  spRecovery: Record<number, number>;
  /**
   * RP recovery curve: days-of-rest → availability after an appearance.
   * 3+ days rest always yields 1.00 availability.
   */
  rpRecovery: Record<number, number>;
  /** Minimum availability (0–1) for a starter to be eligible to start. */
  spEligibilityThreshold: number;
  /** Minimum availability (0–1) for a reliever to be eligible to appear. */
  rpEligibilityThreshold: number;
  /**
   * Maximum in-game performance penalty applied when availability == 0.
   * Expressed as a fraction (0.12 = 12% penalty on relevant stat modifiers).
   */
  maxFatigueEffect: number;
}

const V1_CONSTANTS: PitcherFatigueConstants = {
  // SP: 4-day rotation cycle — essentially full rest by day 4.
  spRecovery: { 0: 0.1, 1: 0.2, 2: 0.4, 3: 0.75, 4: 1.0 },
  // RP: shorter recovery window — ready again by day 2–3.
  rpRecovery: { 0: 0.4, 1: 0.8, 2: 0.95 },
  spEligibilityThreshold: 0.7,
  rpEligibilityThreshold: 0.35,
  maxFatigueEffect: 0.12,
};

/**
 * Returns the pitcher fatigue constants for the given ruleset version.
 * Falls back to v1 constants for any unknown future version so callers
 * never receive undefined values.
 */
export function getPitcherFatigueConstants(rulesetVersion: number): PitcherFatigueConstants {
  switch (rulesetVersion) {
    case 1:
      return V1_CONSTANTS;
    default:
      // Unknown version — return v1 as a safe fallback.
      return V1_CONSTANTS;
  }
}
