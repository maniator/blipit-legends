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

/**
 * Reference pitch-count thresholds at default aggressiveness (50 / modern MLB average).
 * These are exported so other modules (e.g. SubstitutionPanel) can use them as
 * display references without duplicating the constants.
 *
 * ⚠️  These are the aggressiveness=50 anchor values only.
 * The effective thresholds during gameplay are derived internally from
 * `aiPitchingChangeAggressiveness` and will differ when that value ≠ 50.
 * Treat these exports as display/reference anchors, not fixed in-game thresholds.
 */
export const AI_FATIGUE_THRESHOLD_HIGH = 100;
export const AI_FATIGUE_THRESHOLD_MEDIUM = 85;

/**
 * Derives the effective high/medium pitch-count thresholds from the
 * aiPitchingChangeAggressiveness knob (0–100).
 *
 *   aggressiveness  0  → medium=110, high=125  (old-school, complete-game era)
 *   aggressiveness 50  → medium=85,  high=100  (modern MLB average — the defaults)
 *   aggressiveness 100 → medium=60,  high=75   (bullpen-first / opener era)
 *
 * Linear interpolation: delta = (50 - aggressiveness) * 0.5
 */
const derivePitchCountThresholds = (
  aggressiveness: number,
): { highCount: number; mediumCount: number } => {
  const delta = (50 - aggressiveness) * 0.5;
  return {
    highCount: Math.round(AI_FATIGUE_THRESHOLD_HIGH + delta),
    mediumCount: Math.round(AI_FATIGUE_THRESHOLD_MEDIUM + delta),
  };
};

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
 *
 * @param aggressiveness - AI pitching-change aggressiveness knob (0–100). Default 50
 *   reproduces the prior hard-coded behavior. See derivePitchCountThresholds.
 */
export function makeAiPitchingDecision(
  state: State,
  pitchingTeamIdx: 0 | 1,
  pitcherRoles: Record<string, string> = {},
  aggressiveness = 50,
): AiDecision {
  const { highCount, mediumCount } = derivePitchCountThresholds(aggressiveness);
  const fatigueFactor_HIGH = computeFatigueFactor(highCount, 0, 0);
  const fatigueFactor_MEDIUM = computeFatigueFactor(mediumCount, 0, 0);

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

  // Gate by pitch count first so that computeFatigueFactor's floor of 1.0 (returned
  // for any pitch count below the fresh threshold) cannot trigger a change for a
  // fresh pitcher.  At max aggressiveness (100) highCount=75 which equals the
  // fatigue-free zone, so fatigueFactor_HIGH would also be 1.0 — identical to
  // a pitcher at 0 pitches.  The pitch-count gate prevents that false positive.
  const isHighFatigue = pitchCount >= highCount && fatigueFactor >= fatigueFactor_HIGH;

  const isTightGame = Math.abs((state.score[0] ?? 0) - (state.score[1] ?? 0)) <= 2;
  const hasRunnersOn =
    state.baseLayout != null && (state.baseLayout[0] || state.baseLayout[1] || state.baseLayout[2]);
  const isMediumFatigue =
    pitchCount >= mediumCount &&
    fatigueFactor >= fatigueFactor_MEDIUM &&
    (state.inning >= 7 || isTightGame || hasRunnersOn);

  // Always consume one RNG draw unconditionally so the PRNG sequence is stable
  // regardless of whether the managerMode flag is on or off. The conditional
  // random() in the original code desynchronizes the PRNG when managerMode
  // toggles between sessions on the same seed.
  const pullRoll = random();

  if (!isHighFatigue && !isMediumFatigue) return { kind: "none" };

  const pullProbability = isHighFatigue
    ? Math.min(1, 0.6 + (fatigueFactor - fatigueFactor_HIGH) * 2.5)
    : 0.4;
  if (pullRoll > pullProbability) return { kind: "none" };

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
