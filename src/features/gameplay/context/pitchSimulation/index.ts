/**
 * Public API for the pitch-simulation module.
 *
 * Implements the layered baseball pitch-resolution model:
 *   1. Swing decision   (computeSwingRate)
 *   2. Swing outcome    (resolveSwingOutcome): whiff | foul | contact
 *   3. Contact quality  (resolveContactQuality): weak → medium → hard
 *   4. Batted-ball type (resolveBattedBallType): pop_up | grounder | line_drive | fly ball
 *   5. Pitcher fatigue  (computeFatigueFactor): degrades effectiveness over batters faced
 *   6. Batter fatigue   (computeBatterFatigueFactor): modest contact/power penalties over PA
 *
 * All functions are pure (no side effects) and deterministic given the same inputs.
 * Random rolls are accepted as parameters so callers control the RNG sequence.
 */

export type {
  BattedBallType,
  ContactQuality,
  ResolveBattedBallOptions,
  ResolveContactQualityOptions,
} from "./battedBall";
export { resolveBattedBallType, resolveContactQuality } from "./battedBall";
export type { ComputeBatterFatigueFactorResult } from "./batterFatigue";
export { computeBatterFatigueFactor } from "./batterFatigue";
export { computeFatigueFactor } from "./fatigue";
export type { ComputeSwingRateOptions } from "./swingDecision";
export { computeSwingRate } from "./swingDecision";
export type { ResolveSwingOutcomeOptions, SwingOutcome } from "./swingOutcome";
export { resolveSwingOutcome } from "./swingOutcome";
