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
 * - The AI steal threshold bug (0.62 fraction vs 65 integer %) is corrected
 *   here as the canonical fix; the new default 67 sits just above the realistic
 *   MLB break-even noise floor (~65–70 %) so the AI runs decisively when the
 *   numbers favor it without chasing high-variance attempts.
 * - defensiveShiftEnabled defaults to false to reflect the 2023 MLB shift ban
 *   (Rule 5.02(c)). Users can enable it for a pre-2023 / old-school experience.
 *
 * A/B experiment:
 * - Set `localStorage.__blip_ab_decision_variant = "b"` to opt into Variant B.
 * - Variant B tests more aggressive AI steal/pitching defaults with bunts off.
 * - The flag is read once at module load via `_abVariant`.
 * - Normal runtime code should call `getDefaultDecisionValues()` rather than
 *   importing `DEFAULT_MANAGER_DECISION_VALUES` directly so the variant is
 *   respected. The exported const is kept for backward-compat and for
 *   sanitization fallbacks that should not change per-variant.
 */

export interface ManagerDecisionValues {
  /**
   * Minimum steal success % at which the human manager is offered a steal
   * decision prompt. Range: 65–85 (integer %). Default: 72.
   *
   * Higher = only offer steals with a very high success chance.
   * Lower  = offer steals more aggressively (higher risk).
   * 72 matches the previous hard-coded threshold (pct > 72, i.e. 73%+).
   */
  stealMinOfferPct: number;

  /**
   * Minimum steal success % at which the AI auto-commits to a steal attempt.
   * Range: 65–stealMinOfferPct (integer %). Default: 67.
   *
   * Being below stealMinOfferPct means the AI steals more aggressively than
   * the human is prompted. Must be ≤ stealMinOfferPct; enforced in sanitize.
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

/**
 * Variant A — current production defaults.
 * Kept as a named export for backward compatibility (sanitize fallbacks, tests,
 * and comparisons that need the stable baseline). New runtime callers should
 * prefer `getDefaultDecisionValues()` so the A/B variant is respected.
 */
export const DEFAULT_MANAGER_DECISION_VALUES: ManagerDecisionValues = {
  stealMinOfferPct: 72,
  aiStealThreshold: 67,
  stealEnabled: true,
  buntEnabled: true,
  ibbEnabled: true,
  pinchHitterEnabled: true,
  defensiveShiftEnabled: false,
  aiPitchingChangeAggressiveness: 50,
};

/**
 * Variant B — experimental defaults for A/B testing.
 * More aggressive AI steal threshold, bullpen-leaning pitching aggressiveness,
 * and bunts disabled to compare game feel against Variant A.
 *
 * Opt in by setting `localStorage.__blip_ab_decision_variant = "b"`.
 * QA can toggle this in the browser console:
 *   `localStorage.setItem('__blip_ab_decision_variant', 'b'); location.reload();`
 */
const VARIANT_B_DECISION_VALUES: ManagerDecisionValues = {
  ...DEFAULT_MANAGER_DECISION_VALUES,
  aiStealThreshold: 70,
  aiPitchingChangeAggressiveness: 60,
  buntEnabled: false,
};

/**
 * A/B experiment variant flag — read once at module load so that all callers
 * within a session see a consistent value without re-reading localStorage on
 * every call. `"b"` opts into Variant B; any other value (or absence) uses
 * Variant A (production defaults).
 *
 * localStorage access is wrapped in a try/catch to handle environments where
 * storage access is blocked (e.g. private-browsing with strict settings,
 * server-side rendering).
 */
const _abVariant = (() => {
  try {
    return localStorage.getItem("__blip_ab_decision_variant");
  } catch {
    return null;
  }
})();

/**
 * Returns the default decision values for the current A/B variant.
 *
 * Runtime code that needs "fresh defaults" (e.g. initial state, reset-to-defaults)
 * should call this function rather than importing `DEFAULT_MANAGER_DECISION_VALUES`
 * directly, so the experiment variant is respected.
 *
 * Variant B is active when `localStorage.__blip_ab_decision_variant === "b"`.
 */
export function getDefaultDecisionValues(): ManagerDecisionValues {
  return _abVariant === "b" ? VARIANT_B_DECISION_VALUES : DEFAULT_MANAGER_DECISION_VALUES;
}

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
 *
 * Fallback values come from `getDefaultDecisionValues()` so that the A/B
 * experiment variant is respected when a field is missing from stored data.
 */
export const sanitizeManagerDecisionValues = (
  raw: Partial<ManagerDecisionValues>,
): ManagerDecisionValues => {
  const defaults = getDefaultDecisionValues();

  const stealMinOfferPct = clampInt(
    Number.isFinite(raw.stealMinOfferPct)
      ? (raw.stealMinOfferPct as number)
      : defaults.stealMinOfferPct,
    STEAL_PCT_MIN,
    STEAL_PCT_MAX,
  );

  const aiStealThreshold = clampInt(
    Number.isFinite(raw.aiStealThreshold)
      ? (raw.aiStealThreshold as number)
      : defaults.aiStealThreshold,
    STEAL_PCT_MIN,
    // AI threshold must be ≤ the manager offer threshold.
    stealMinOfferPct,
  );

  const aggressiveness = clampInt(
    Number.isFinite(raw.aiPitchingChangeAggressiveness)
      ? (raw.aiPitchingChangeAggressiveness as number)
      : defaults.aiPitchingChangeAggressiveness,
    AGGRESSIVENESS_MIN,
    AGGRESSIVENESS_MAX,
  );

  return {
    stealMinOfferPct,
    aiStealThreshold,
    stealEnabled: typeof raw.stealEnabled === "boolean" ? raw.stealEnabled : defaults.stealEnabled,
    buntEnabled: typeof raw.buntEnabled === "boolean" ? raw.buntEnabled : defaults.buntEnabled,
    ibbEnabled: typeof raw.ibbEnabled === "boolean" ? raw.ibbEnabled : defaults.ibbEnabled,
    pinchHitterEnabled:
      typeof raw.pinchHitterEnabled === "boolean"
        ? raw.pinchHitterEnabled
        : defaults.pinchHitterEnabled,
    defensiveShiftEnabled:
      typeof raw.defensiveShiftEnabled === "boolean"
        ? raw.defensiveShiftEnabled
        : defaults.defensiveShiftEnabled,
    aiPitchingChangeAggressiveness: aggressiveness,
  };
};
