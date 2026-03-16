/**
 * Swing-decision helpers.
 *
 * Determines whether a batter swings at a given pitch based on the count,
 * strategy, contact skill, pitch type, and any active one-pitch modifier.
 */

import type { PitchType } from "@feat/gameplay/constants/pitchTypes";
import { pitchSwingRateMod } from "@feat/gameplay/constants/pitchTypes";

import type { OnePitchModifier } from "../decisionTypes";
import type { Strategy } from "../playerTypes";

/** Per-strategy swing-rate multipliers (relative to "balanced" = 1.0). */
const SWING_RATE_MODS: Record<Strategy, number> = {
  balanced: 1.0,
  aggressive: 1.15,
  patient: 0.87,
  contact: 1.05,
  power: 0.95,
};

/**
 * Options for `computeSwingRate`.
 *
 * All fields are optional — defaults produce "balanced" swing behaviour with no modifiers.
 */
export interface ComputeSwingRateOptions {
  strategy?: Strategy;
  batterContactMod?: number;
  pitchType?: PitchType;
  onePitchMod?: OnePitchModifier;
  /** Handedness/platoon multiplier applied after strategy/contact adjustments. */
  swingRateMultiplier?: number;
}

/**
 * Compute the per-pitch swing rate for the current count, strategy, and context.
 *
 * Returns an integer in [0, 1000].  Compare with `getRandomInt(1000)`:
 * if roll < swingRate → swing, otherwise → take.
 *
 * Special modifiers:
 *   "swing" → 1000 (guarantees a swing — batter committed to hack)
 *   "take"  → 0   (batter takes the pitch no matter what)
 *
 * Swing rates by strikes (base):
 *   0 strikes → 360 (36%)  — selective early
 *   1 strike  → 450 (45%)  — start protecting
 *   2 strikes → 580 (58%)  — must protect the plate
 */
export const computeSwingRate = (
  strikes: number,
  {
    strategy = "balanced",
    batterContactMod = 0,
    pitchType,
    onePitchMod = null,
    swingRateMultiplier = 1,
  }: ComputeSwingRateOptions = {},
): number => {
  if (onePitchMod === "swing") return 1000;
  if (onePitchMod === "take") return 0;

  const baseRates = [360, 450, 580];
  const base = baseRates[Math.min(strikes, 2)];

  const protectBonus = onePitchMod === "protect" ? 1.2 : 1.0;
  const stratFactor = SWING_RATE_MODS[strategy] ?? 1.0;

  // Better contact skills = marginally more willing to swing (makes contact more often)
  const contactBonus = 1 + batterContactMod / 200;

  const pitchMod = pitchType ? pitchSwingRateMod(pitchType) : 1.0;

  const raw = Math.round(
    base * stratFactor * protectBonus * contactBonus * pitchMod * swingRateMultiplier,
  );
  // Normal play caps at 920 — only the "swing" modifier reaches 1000.
  return Math.min(920, Math.max(0, raw));
};
