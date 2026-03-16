import { random } from "@shared/utils/rng";

import type { AiDecision, AiDecisionReason } from "./aiTypes";
import type { State } from "./gameStateTypes";
import {
  buildHandednessMatchup,
  getHandednessOutcomeModifiers,
  resolvePitcherHandedness,
  resolvePlayerHandedness,
} from "./handednessMatchup";
import { computeFatigueFactor } from "./pitchSimulation";

/** Pitch-count reference thresholds used to derive fatigue-factor limits below. */
export const AI_FATIGUE_THRESHOLD_HIGH = 100;
export const AI_FATIGUE_THRESHOLD_MEDIUM = 85;

/**
 * Fatigue-factor limits for AI pitching-change decisions.
 * Derived from the reference thresholds at default stamina (staminaMod = 0, battersFaced = 0):
 *
 * computeFatigueFactor(100, 0, 0) = 1.0 + 0.009*(100-75) = 1.225  →  AI_FATIGUE_FACTOR_HIGH
 * computeFatigueFactor(85,  0, 0) = 1.0 + 0.009*(85-75)  = 1.09   →  AI_FATIGUE_FACTOR_MEDIUM
 */
const AI_FATIGUE_FACTOR_HIGH = 1.225;
const AI_FATIGUE_FACTOR_MEDIUM = 1.09;

/**
 * Returns true if a pitcher ID is a viable in-game replacement:
 * - Not already the active pitcher
 * - Not substituted out (no-reentry)
 * - Has a reliever-eligible role (RP, SP/RP, or no role set — legacy/stock teams)
 */
export function isPitcherEligibleForChange(
  pitcherId: string,
  pitcherIdx: number,
  activePitcherIdx: number,
  substitutedOut: string[],
  pitcherRole?: string,
): boolean {
  if (pitcherIdx === activePitcherIdx) return false;
  if (substitutedOut.includes(pitcherId)) return false;
  // If no role set (stock/legacy teams), allow any pitcher.
  if (!pitcherRole) return true;
  return pitcherRole === "RP" || pitcherRole === "SP/RP";
}

/**
 * Returns the index of the best available reliever for a given team, or -1 if none.
 * "Best" is determined by a simple heuristic: prefer RP over SP/RP over no-role.
 * Picks the first eligible candidate using priority order: RP > SP/RP > no-role.
 */
export function findBestReliever(
  rosterPitchers: string[],
  activePitcherIdx: number,
  substitutedOut: string[],
  pitcherRoles: Record<string, string>,
): number {
  // Prefer explicit RP first, then SP/RP, then any eligible.
  const priorities: Array<(role?: string) => boolean> = [
    (r) => r === "RP",
    (r) => r === "SP/RP",
    (r) => r === undefined || r === "",
  ];

  for (const matchesPriority of priorities) {
    const idx = rosterPitchers.findIndex((id, i) => {
      const role = pitcherRoles[id];
      return (
        isPitcherEligibleForChange(id, i, activePitcherIdx, substitutedOut, role) &&
        matchesPriority(role)
      );
    });
    if (idx !== -1) return idx;
  }
  return -1;
}

interface FindMatchupAwareRelieverOptions {
  pitchingTeamIdx: 0 | 1;
  rosterPitchers: string[];
  activePitcherIdx: number;
  substitutedOut: string[];
  pitcherRoles: Record<string, string>;
}

const findMatchupAwareReliever = (
  state: State,
  {
    pitchingTeamIdx,
    rosterPitchers,
    activePitcherIdx,
    substitutedOut,
    pitcherRoles,
  }: FindMatchupAwareRelieverOptions,
): number => {
  const fallback = findBestReliever(rosterPitchers, activePitcherIdx, substitutedOut, pitcherRoles);
  if (fallback === -1) return -1;

  const battingTeamIdx = (1 - pitchingTeamIdx) as 0 | 1;
  const batterIdx = (state.batterIndex ?? [0, 0])[battingTeamIdx] ?? 0;
  const batterId = state.lineupOrder?.[battingTeamIdx]?.[batterIdx];
  if (!batterId) return fallback;

  const batterHandedness = resolvePlayerHandedness(
    state.handednessByTeam?.[battingTeamIdx]?.[batterId],
    batterId,
  );

  let bestIdx = fallback;
  let bestPitcherEdge = Number.POSITIVE_INFINITY;

  for (let i = 0; i < rosterPitchers.length; i++) {
    const pitcherId = rosterPitchers[i];
    const role = pitcherRoles[pitcherId];
    if (!isPitcherEligibleForChange(pitcherId, i, activePitcherIdx, substitutedOut, role)) continue;

    const pitcherHandedness = resolvePitcherHandedness(
      state.handednessByTeam?.[pitchingTeamIdx]?.[pitcherId],
      pitcherId,
    );
    const batterEdge = getHandednessOutcomeModifiers(
      buildHandednessMatchup(batterHandedness, pitcherHandedness),
    ).promptDeltaPct;
    // Lower batter edge is better for the pitcher.
    if (batterEdge < bestPitcherEdge) {
      bestPitcherEdge = batterEdge;
      bestIdx = i;
    }
  }

  return bestIdx;
};

/**
 * Main AI manager decision function.
 *
 * Evaluates whether the AI-managed pitching team should make a pitching change
 * at the start of a new at-bat (0-0 count, beginning of plate appearance).
 *
 * Returns the decision to take, or `{ kind: "none" }` if no action is warranted.
 */
export function makeAiPitchingDecision(
  state: State,
  pitchingTeamIdx: 0 | 1,
  pitcherRoles: Record<string, string> = {},
): AiDecision {
  const pitchCount = (state.pitcherPitchCount ?? [0, 0])[pitchingTeamIdx];
  const battersFaced = (state.pitcherBattersFaced ?? [0, 0])[pitchingTeamIdx];
  const activePitcherIdx = (state.activePitcherIdx ?? [0, 0])[pitchingTeamIdx];
  const rosterPitchers = (state.rosterPitchers ?? [[], []])[pitchingTeamIdx];
  const substitutedOut = (state.substitutedOut ?? [[], []])[pitchingTeamIdx];

  const activePitcherId = rosterPitchers[activePitcherIdx];
  const staminaMod = activePitcherId
    ? (state.resolvedMods?.[pitchingTeamIdx]?.[activePitcherId]?.staminaMod ?? 0)
    : 0;
  const fatigueFactor = computeFatigueFactor(pitchCount, battersFaced, staminaMod);

  const isHighFatigue = fatigueFactor >= AI_FATIGUE_FACTOR_HIGH;

  const isTightGame = Math.abs((state.score[0] ?? 0) - (state.score[1] ?? 0)) <= 2;
  const hasRunnersOn =
    state.baseLayout != null && (state.baseLayout[0] || state.baseLayout[1] || state.baseLayout[2]);
  const isMediumFatigue =
    fatigueFactor >= AI_FATIGUE_FACTOR_MEDIUM && (state.inning >= 7 || isTightGame || hasRunnersOn);

  if (!isHighFatigue && !isMediumFatigue) return { kind: "none" };

  const pullProbability = isHighFatigue
    ? Math.min(1, 0.6 + (fatigueFactor - AI_FATIGUE_FACTOR_HIGH) * 2.5)
    : 0.4;
  if (random() > pullProbability) return { kind: "none" };

  const relieverIdx = findMatchupAwareReliever(state, {
    pitchingTeamIdx,
    rosterPitchers,
    activePitcherIdx,
    substitutedOut,
    pitcherRoles,
  });

  if (relieverIdx === -1) return { kind: "none" };

  const reason: AiDecisionReason = isHighFatigue
    ? "pitcher_fatigue_high"
    : "pitcher_fatigue_medium";

  const reasonText =
    reason === "pitcher_fatigue_high"
      ? "pitcher fatigue becoming a concern"
      : "looking fresh arm late in the game";

  return {
    kind: "pitching_change",
    teamIdx: pitchingTeamIdx,
    pitcherIdx: relieverIdx,
    reason,
    reasonText,
  };
}
