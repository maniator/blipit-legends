/**
 * Manager/AI decision-value knobs that users can tune during gameplay.
 *
 * These values control the thresholds and toggles used by both the human
 * manager decision prompts (detectDecision) and the unmanaged AI manager.
 *
 * Design notes:
 * - These are control-layer values (localStorage + save setup), NOT game State.
 *   They are never added to the reducer to keep determinism concerns isolated.
 * - Defaults preserve prior simulator behavior where practical, with the
 *   following intentional changes called out explicitly:
 *   • Bunt detection is now situational (inning ≥ 6, close game ≤ 2 run diff)
 *     rather than the previous unconditional positional check (`outs < 2 &&
 *     runner on 1st/2nd`).  The old check offered bunts in clearly wrong
 *     situations (e.g. inning 1 up by 10), so the new default is more
 *     baseball-correct.  `buntEnabled` only toggles whether this situational
 *     bunt logic is active; it does not restore the previous unconditional
 *     bunt-offer behavior.
 *   • `stealMinOfferPct` default of 72 matches the prior hard-coded `> 72`
 *     threshold, preserving the exact steal-offer boundary.  The clamp floor
 *     is 65 (raised from 62) — sub-65 % steals are below the realistic MLB
 *     break-even noise floor and are not surfaced even on the most aggressive
 *     user settings.
 * - The AI steal threshold is set to 80 (previously 67). 80 aligns with the
 *   modern MLB break-even for stolen bases; the old 67 sat just above the noise
 *   floor and allowed far too many low-odds attempts. stealMinOfferPct is also
 *   raised to 80 so the constraint aiStealThreshold ≤ stealMinOfferPct holds:
 *   both human prompt and AI now require genuinely high-probability steals.
 * - defensiveShiftEnabled defaults to false to reflect the 2023 MLB shift ban
 *   (Rule 5.02(c)). Users can enable it for a pre-2023 / old-school experience.
 */

export interface ManagerDecisionValues {
  /**
   * Minimum steal success % at which the human manager is offered a steal
   * decision prompt. Range: 65–85 (integer %). Default: 80.
   *
   * Higher = only offer steals with a very high success chance.
   * Lower  = offer steals more aggressively (higher risk).
   * 80 means the human manager is only prompted for very high-chance steals.
   */
  stealMinOfferPct: number;

  /**
   * Minimum steal success % at which the AI auto-commits to a steal attempt.
   * Range: 65–stealMinOfferPct (integer %). Default: 80.
   *
   * 80 aligns with the modern MLB steal break-even; the AI only steals when
   * the odds genuinely favor it. Must be ≤ stealMinOfferPct; enforced in sanitize.
   */
  aiStealThreshold: number;

  /**
   * Whether the steal option is offered to the human manager / attempted by
   * the AI. Default: true. When false, no steal is ever offered or attempted —
   * a team-wide "stop sign" managerial directive (mirrors how `defensiveShiftEnabled`
   * and `ibbEnabled` work for those tactics).
   */
  stealEnabled: boolean;

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
  stealMinOfferPct: 80,
  aiStealThreshold: 80,
  stealEnabled: true,
  buntEnabled: true,
  ibbEnabled: true,
  pinchHitterEnabled: true,
  defensiveShiftEnabled: false,
  aiPitchingChangeAggressiveness: 50,
};

export const STEAL_PCT_MIN = 65;
export const STEAL_PCT_MAX = 85;
export const AGGRESSIVENESS_MIN = 0;
export const AGGRESSIVENESS_MAX = 100;

const clampInt = (value: number, min: number, max: number): number =>
  Math.round(Math.min(max, Math.max(min, value)));

/**
 * Returns a sanitized copy of the provided decision values.
 * All fields are clamped/coerced to safe values so corrupt localStorage data
 * does not reach gameplay logic.
 *
 * `Number.isFinite` is used instead of `typeof === "number"` to reject NaN and
 * ±Infinity — both pass the typeof check but produce NaN/broken values after
 * clamp/round math, causing threshold comparisons (e.g. `pct > NaN`) to always
 * return false.
 */
export const sanitizeManagerDecisionValues = (
  raw: Partial<ManagerDecisionValues>,
): ManagerDecisionValues => {
  const stealMinOfferPct = clampInt(
    Number.isFinite(raw.stealMinOfferPct)
      ? (raw.stealMinOfferPct as number)
      : DEFAULT_MANAGER_DECISION_VALUES.stealMinOfferPct,
    STEAL_PCT_MIN,
    STEAL_PCT_MAX,
  );

  const aiStealThreshold = clampInt(
    Number.isFinite(raw.aiStealThreshold)
      ? (raw.aiStealThreshold as number)
      : DEFAULT_MANAGER_DECISION_VALUES.aiStealThreshold,
    STEAL_PCT_MIN,
    // AI threshold must be ≤ the manager offer threshold.
    stealMinOfferPct,
  );

  const aggressiveness = clampInt(
    Number.isFinite(raw.aiPitchingChangeAggressiveness)
      ? (raw.aiPitchingChangeAggressiveness as number)
      : DEFAULT_MANAGER_DECISION_VALUES.aiPitchingChangeAggressiveness,
    AGGRESSIVENESS_MIN,
    AGGRESSIVENESS_MAX,
  );

  return {
    stealMinOfferPct,
    aiStealThreshold,
    stealEnabled:
      typeof raw.stealEnabled === "boolean"
        ? raw.stealEnabled
        : DEFAULT_MANAGER_DECISION_VALUES.stealEnabled,
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
