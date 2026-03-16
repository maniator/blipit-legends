import { fnv1a } from "@storage/hash";

import type { Handedness } from "./playerTypes";

export type EffectiveBatterSide = "R" | "L";

export type MatchupBucket = "R_R" | "R_L" | "L_R" | "L_L" | "S_R" | "S_L";

export interface HandednessMatchup {
  batterHandedness: Handedness;
  pitcherHandedness: "R" | "L";
  effectiveBatterSide: EffectiveBatterSide;
  bucket: MatchupBucket;
}

export interface HandednessOutcomeModifiers {
  swingRateMultiplier: number;
  whiffRateMultiplier: number;
  walkRateMultiplier: number;
  calledStrikeRateMultiplier: number;
  hardContactMultiplier: number;
  /** Prompt-friendly relative edge in percent (positive = batter edge). */
  promptDeltaPct: number;
}

const MATCHUP_OUTCOME_MODIFIERS: Record<MatchupBucket, HandednessOutcomeModifiers> = {
  // Same-side matchups are mildly pitcher-favored.
  R_R: {
    swingRateMultiplier: 0.99,
    whiffRateMultiplier: 1.05,
    walkRateMultiplier: 0.92,
    calledStrikeRateMultiplier: 1.04,
    hardContactMultiplier: 0.95,
    promptDeltaPct: -5,
  },
  L_L: {
    swingRateMultiplier: 0.99,
    whiffRateMultiplier: 1.07,
    walkRateMultiplier: 0.9,
    calledStrikeRateMultiplier: 1.05,
    hardContactMultiplier: 0.93,
    promptDeltaPct: -7,
  },
  // Opposite-side matchups are batter-favored (platoon edge).
  R_L: {
    swingRateMultiplier: 1.01,
    whiffRateMultiplier: 0.95,
    walkRateMultiplier: 1.08,
    calledStrikeRateMultiplier: 0.96,
    hardContactMultiplier: 1.06,
    promptDeltaPct: 6,
  },
  L_R: {
    swingRateMultiplier: 1.01,
    whiffRateMultiplier: 0.93,
    walkRateMultiplier: 1.1,
    calledStrikeRateMultiplier: 0.95,
    hardContactMultiplier: 1.08,
    promptDeltaPct: 8,
  },
  // Switch-hitter buckets map to their effective opposite-side profile.
  S_R: {
    swingRateMultiplier: 1.01,
    whiffRateMultiplier: 0.93,
    walkRateMultiplier: 1.1,
    calledStrikeRateMultiplier: 0.95,
    hardContactMultiplier: 1.08,
    promptDeltaPct: 8,
  },
  S_L: {
    swingRateMultiplier: 1.01,
    whiffRateMultiplier: 0.95,
    walkRateMultiplier: 1.08,
    calledStrikeRateMultiplier: 0.96,
    hardContactMultiplier: 1.06,
    promptDeltaPct: 6,
  },
};

/**
 * Deterministic fallback used when a player has no explicit handedness value.
 * Uses stable player ID hashing so repeated setups remain reproducible.
 */
export const deterministicHandednessForPlayerId = (playerId: string): Handedness => {
  const hash = parseInt(fnv1a(playerId), 16) % 100;
  if (hash < 62) return "R";
  if (hash < 90) return "L";
  return "S";
};

export const resolvePlayerHandedness = (
  explicitHandedness: Handedness | undefined,
  playerId: string,
): Handedness => explicitHandedness ?? deterministicHandednessForPlayerId(playerId);

export const resolvePitcherHandedness = (
  explicitHandedness: Handedness | undefined,
  pitcherId: string,
): "R" | "L" => {
  const resolved = resolvePlayerHandedness(explicitHandedness, pitcherId);
  // Pitchers should not be switch-handed in this model; normalize to a throw side.
  if (resolved === "S") return "R";
  return resolved;
};

export const resolveEffectiveBatterSide = (
  batterHandedness: Handedness,
  pitcherHandedness: "R" | "L",
): EffectiveBatterSide => {
  if (batterHandedness === "S") return pitcherHandedness === "R" ? "L" : "R";
  return batterHandedness;
};

export const getMatchupBucket = (
  batterHandedness: Handedness,
  pitcherHandedness: "R" | "L",
): MatchupBucket => {
  if (batterHandedness === "S") return pitcherHandedness === "R" ? "S_R" : "S_L";
  return `${batterHandedness}_${pitcherHandedness}` as MatchupBucket;
};

export const buildHandednessMatchup = (
  batterHandedness: Handedness,
  pitcherHandedness: "R" | "L",
): HandednessMatchup => ({
  batterHandedness,
  pitcherHandedness,
  effectiveBatterSide: resolveEffectiveBatterSide(batterHandedness, pitcherHandedness),
  bucket: getMatchupBucket(batterHandedness, pitcherHandedness),
});

export const getHandednessOutcomeModifiers = (
  matchup: HandednessMatchup,
): HandednessOutcomeModifiers => MATCHUP_OUTCOME_MODIFIERS[matchup.bucket];
