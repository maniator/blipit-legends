/**
 * Contact quality and batted-ball type resolution.
 *
 * Given that a swing made contact, resolves the contact quality (weak/medium/hard)
 * and the specific batted-ball type, which `handleBallInPlay` in `hitBall.ts`
 * maps to a final ball-in-play result.
 */

import type { Strategy } from "../playerTypes";

/** Broad contact quality categories. */
export type ContactQuality = "weak" | "medium" | "hard";

/**
 * The type of ball put in play.
 *
 * This is the explicit intermediate layer between contact quality and the final
 * ball-in-play result.  The final outcome (hit type or out) is determined by
 * `handleBallInPlay()` in `hitBall.ts` using the batted-ball type.
 *
 * Outcome shape per type (approximate):
 *   pop_up       → ~100% out (pop-up)
 *   weak_grounder→ ~65% out (ground out / FC / DP), ~35% infield single
 *   hard_grounder→ ~50% out (ground out / FC / DP), ~50% single
 *   line_drive   → ~20% out (liner caught),          ~80% hit (Single–HR)
 *   medium_fly   → ~70% out (fly out),               ~30% hit (Single–Double)
 *   deep_fly     → ~35% out (warning-track out),     ~65% hit (Double–HR)
 */
export type BattedBallType =
  | "pop_up"
  | "weak_grounder"
  | "hard_grounder"
  | "line_drive"
  | "medium_fly"
  | "deep_fly";

/**
 * Compute contact quality from a 0–99 roll and pitcher/batter modifiers.
 *
 * Extracted so it can be reused by `resolveBattedBallType` and tested in
 * isolation.
 */
export interface ResolveContactQualityOptions {
  batterPowerMod?: number;
  pitcherVelocityMod?: number;
  pitcherMovementMod?: number;
  /** Pitcher fatigue (≥ 1.0; higher = more tired, allows more hard contact). */
  fatigueFactor?: number;
  /** Handedness/platoon multiplier applied to hard-contact threshold. */
  hardContactMultiplier?: number;
}

export const resolveContactQuality = (
  contactRoll: number,
  {
    batterPowerMod = 0,
    pitcherVelocityMod = 0,
    pitcherMovementMod = 0,
    fatigueFactor = 1.0,
    hardContactMultiplier = 1,
  }: ResolveContactQualityOptions = {},
): ContactQuality => {
  // Hard contact threshold: batter power raises it; pitcher stuff lowers it;
  // fatigue raises it (tired pitchers allow more hard contact).
  // hardBase = 26% hard contact (vs MLB ~32%; tuned for sim realism).
  const hardBase = 26;
  const hardThreshold = Math.max(
    10,
    Math.min(
      50,
      Math.round(
        (hardBase +
          Math.round(batterPowerMod / 5) -
          Math.round((pitcherVelocityMod + pitcherMovementMod) / 10) +
          Math.round((fatigueFactor - 1) * 10)) *
          hardContactMultiplier,
      ),
    ),
  );
  const mediumThreshold = Math.min(75, hardThreshold + 35);

  if (contactRoll < hardThreshold) return "hard";
  if (contactRoll < mediumThreshold) return "medium";
  return "weak";
};

/**
 * Determine the batted-ball type from contact quality and a 0–99 type roll.
 *
 * This is the explicit ball-in-play intermediate layer:
 *   contact quality → batted-ball type → final result (in `handleBallInPlay`)
 *
 * Hard contact skews toward deep fly balls and line drives.
 * Medium contact produces a mix of fly balls, grounders, and liners.
 * Weak contact mostly produces pop-ups and weak grounders.
 *
 * Power strategy can upgrade the batted-ball type for the same contact quality.
 */
export interface ResolveBattedBallOptions {
  strategy?: Strategy;
  batterPowerMod?: number;
  pitcherVelocityMod?: number;
  pitcherMovementMod?: number;
  /** Pitcher fatigue (≥ 1.0; higher = more tired). */
  fatigueFactor?: number;
  hardContactMultiplier?: number;
}

export const resolveBattedBallType = (
  contactRoll: number,
  typeRoll: number,
  {
    strategy = "balanced",
    batterPowerMod = 0,
    pitcherVelocityMod = 0,
    pitcherMovementMod = 0,
    fatigueFactor = 1.0,
    hardContactMultiplier = 1,
  }: ResolveBattedBallOptions = {},
): BattedBallType => {
  const quality = resolveContactQuality(contactRoll, {
    batterPowerMod,
    pitcherVelocityMod,
    pitcherMovementMod,
    fatigueFactor,
    hardContactMultiplier,
  });

  // Power strategy can upgrade the batted-ball type one tier toward extra bases.
  const powerBoost = strategy === "power" && typeRoll < 15;

  switch (quality) {
    case "hard":
      // Hard contact: deep fly (40%) → line drive (35%) → hard grounder (25%).
      if (typeRoll < 40) return "deep_fly";
      if (typeRoll < 75) return "line_drive";
      return "hard_grounder";

    case "medium":
      // Power boost on medium: elevate to deep fly.
      if (powerBoost) return "deep_fly";
      // medium fly (35%) → hard grounder (20%) → line drive (20%) → weak grounder (25%).
      if (typeRoll < 35) return "medium_fly";
      if (typeRoll < 55) return "hard_grounder";
      if (typeRoll < 75) return "line_drive";
      return "weak_grounder";

    case "weak":
      // Power boost on weak: elevate to medium fly (at least a chance at a hit).
      if (powerBoost) return "medium_fly";
      // pop up (35%) → weak grounder (45%) → medium fly (20%).
      if (typeRoll < 35) return "pop_up";
      if (typeRoll < 80) return "weak_grounder";
      return "medium_fly";
  }
};
