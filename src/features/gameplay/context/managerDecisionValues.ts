/**
 * Manager/AI decision-value knobs that users can tune during gameplay.
 *
 * These values control the thresholds and toggles used by both the human
 * manager decision prompts (detectDecision) and the unmanaged AI manager.
 *
 * Design notes:
 * - These are control-layer values (localStorage + save setup), NOT game State.
 *   They are never added to the reducer to keep determinism concerns isolated.
 * - All defaults reproduce the pre-existing simulator behavior so changing
 *   nothing is a no-op for existing games.
 * - The AI steal threshold bug (0.62 fraction vs 65 integer %) is corrected
 *   here as the canonical fix; the new default 65 is the baseball-correct value.
 * - defensiveShiftEnabled defaults to false to reflect the 2023 MLB shift ban
 *   (Rule 5.02(c)). Users can enable it for a pre-2023 / old-school experience.
 */

export interface ManagerDecisionValues {
  /**
   * Minimum steal success % at which the human manager is offered a steal
   * decision prompt. Range: 62–85 (integer %). Default: 70.
   *
   * Higher = only offer steals with a very high success chance.
   * Lower  = offer steals more aggressively (higher risk).
   * ~70% is the MLB run-expectancy break-even for stealing 2nd.
   */
  stealMinOfferPct: number;

  /**
   * Minimum steal success % at which the AI auto-commits to a steal attempt.
   * Range: 62–stealMinOfferPct (integer %). Default: 65.
   *
   * Being below stealMinOfferPct means the AI steals more aggressively than
   * the human is prompted. Must be ≤ stealMinOfferPct; enforced in sanitize.
   */
  aiStealThreshold: number;

  /**
   * Whether the sacrifice bunt option is offered to the human manager /
   * attempted by the AI. Default: true.
   */
  buntEnabled: boolean;

  /**
   * Whether the intentional walk option is offered to the human manager /
   * attempted by the AI. Default: true.
   */
  ibbEnabled: boolean;

  /**
   * Whether the pinch-hitter substitution option is offered to the human
   * manager / attempted by the AI. Default: true.
   */
  pinchHitterEnabled: boolean;

  /**
   * Whether the defensive shift is offered to the human manager / applied by
   * the AI. Defaults to false to reflect the 2023 MLB shift ban. Enable for
   * pre-2023 / old-school rules.
   */
  defensiveShiftEnabled: boolean;

  /**
   * How aggressively the AI pulls a tired pitcher. Range: 0–100. Default: 50.
   *
   *  0 = very conservative (1990s complete-game era, ~110–125 pitch threshold)
   * 50 = modern MLB average (~85–100 pitch threshold — matches prior defaults)
   * 100 = bullpen-era aggressive (~60–75 pitch threshold)
   *
   * Only affects the AI pitching-change logic (makeAiPitchingDecision).
   * Human managers trigger pitching changes through the substitution panel.
   */
  aiPitchingChangeAggressiveness: number;
}

export const DEFAULT_MANAGER_DECISION_VALUES: ManagerDecisionValues = {
  stealMinOfferPct: 70,
  aiStealThreshold: 65,
  buntEnabled: true,
  ibbEnabled: true,
  pinchHitterEnabled: true,
  defensiveShiftEnabled: false,
  aiPitchingChangeAggressiveness: 50,
};

const STEAL_PCT_MIN = 62;
const STEAL_PCT_MAX = 85;
const AGGRESSIVENESS_MIN = 0;
const AGGRESSIVENESS_MAX = 100;

const clampInt = (value: number, min: number, max: number): number =>
  Math.round(Math.min(max, Math.max(min, value)));

/**
 * Returns a sanitized copy of the provided decision values.
 * All fields are clamped/coerced to safe values so corrupt localStorage data
 * does not reach gameplay logic.
 */
export const sanitizeManagerDecisionValues = (
  raw: Partial<ManagerDecisionValues>,
): ManagerDecisionValues => {
  const stealMinOfferPct = clampInt(
    typeof raw.stealMinOfferPct === "number"
      ? raw.stealMinOfferPct
      : DEFAULT_MANAGER_DECISION_VALUES.stealMinOfferPct,
    STEAL_PCT_MIN,
    STEAL_PCT_MAX,
  );

  const aiStealThreshold = clampInt(
    typeof raw.aiStealThreshold === "number"
      ? raw.aiStealThreshold
      : DEFAULT_MANAGER_DECISION_VALUES.aiStealThreshold,
    STEAL_PCT_MIN,
    // AI threshold must be ≤ the manager offer threshold.
    stealMinOfferPct,
  );

  const aggressiveness = clampInt(
    typeof raw.aiPitchingChangeAggressiveness === "number"
      ? raw.aiPitchingChangeAggressiveness
      : DEFAULT_MANAGER_DECISION_VALUES.aiPitchingChangeAggressiveness,
    AGGRESSIVENESS_MIN,
    AGGRESSIVENESS_MAX,
  );

  return {
    stealMinOfferPct,
    aiStealThreshold,
    buntEnabled:
      typeof raw.buntEnabled === "boolean"
        ? raw.buntEnabled
        : DEFAULT_MANAGER_DECISION_VALUES.buntEnabled,
    ibbEnabled:
      typeof raw.ibbEnabled === "boolean"
        ? raw.ibbEnabled
        : DEFAULT_MANAGER_DECISION_VALUES.ibbEnabled,
    pinchHitterEnabled:
      typeof raw.pinchHitterEnabled === "boolean"
        ? raw.pinchHitterEnabled
        : DEFAULT_MANAGER_DECISION_VALUES.pinchHitterEnabled,
    defensiveShiftEnabled:
      typeof raw.defensiveShiftEnabled === "boolean"
        ? raw.defensiveShiftEnabled
        : DEFAULT_MANAGER_DECISION_VALUES.defensiveShiftEnabled,
    aiPitchingChangeAggressiveness: aggressiveness,
  };
};
