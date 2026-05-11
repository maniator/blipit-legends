/**
 * AI rotation/lineup policy for non-user teams in League Mode v1.
 *
 * Determines which SP starts and which RP is available for a given game,
 * based on pitcher availability from seasonPlayerState and the roster snapshot.
 *
 * Policy (per _bmad-output/planning-artifacts/league-mode-distillate/03-setup-wizard-autogen-fatigue-hub.md §v1 AI rotation/lineup):
 *   SP: cycle through pitchers[] order; skip any with availability < spEligibilityThreshold.
 *       If ALL SPs are below threshold, pick the highest-availability SP.
 *       Cycle is implemented via pitcherStartsThisSeason as tiebreaker (fewest starts first).
 *   RP: pick highest-availability RP with availability >= rpEligibilityThreshold.
 *       If none are eligible, return null (no RP change).
 *
 * This module is also used when the user clicks "Quick sim my next game" — manager-mode
 * prompts auto-resolve identically to the AI policy.
 */
import { getPitcherFatigueConstants } from "@feat/league/ruleset/pitcherFatigueConstants";
import type { SeasonPlayerStateRecord } from "@feat/league/storage/types";

// ---------------------------------------------------------------------------
// Roster snapshot helpers (same narrow types as updatePitcherFatigue)
// ---------------------------------------------------------------------------

interface RosterPitcherEntry {
  id: string;
  pitchingRole?: "SP" | "RP" | "SP/RP";
}

interface RosterSnapshotV1 {
  pitchers?: RosterPitcherEntry[];
}

function resolveRole(playerId: string, snapshot: Record<string, unknown>): "SP" | "RP" {
  const snap = snapshot as RosterSnapshotV1;
  const entry = snap.pitchers?.find((p) => p.id === playerId);
  if (!entry || !entry.pitchingRole) return "RP";
  if (entry.pitchingRole === "SP" || entry.pitchingRole === "SP/RP") return "SP";
  return "RP";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface RotationPolicyInput {
  seasonTeamId: string;
  rosterSnapshot: Record<string, unknown>;
  /** Player state docs for THIS team only (filtered before calling). */
  playerStates: SeasonPlayerStateRecord[];
  rulesetVersion: number;
}

export interface RotationPolicyResult {
  /**
   * playerId of the selected SP. Should never be null for a valid roster (≥1 SP required),
   * but returned as string | null defensively.
   */
  startingPitcherId: string | null;
  /**
   * playerId of the selected RP (highest eligible by availability), or null if no RP
   * meets the eligibility threshold.
   */
  relieverId: string | null;
}

/**
 * Selects the starting pitcher and best available reliever for a team in a season game.
 * Pure function — no DB access.
 */
export function selectPitchers(input: RotationPolicyInput): RotationPolicyResult {
  const { rosterSnapshot, playerStates, rulesetVersion } = input;
  const constants = getPitcherFatigueConstants(rulesetVersion);
  const snap = rosterSnapshot as RosterSnapshotV1;
  const rosterOrder = snap.pitchers?.map((p) => p.id) ?? [];

  // Partition player states into SP and RP, preserving roster order as secondary sort.
  const spStates: SeasonPlayerStateRecord[] = [];
  const rpStates: SeasonPlayerStateRecord[] = [];

  for (const ps of playerStates) {
    const role = resolveRole(ps.playerId, rosterSnapshot);
    if (role === "SP") spStates.push(ps);
    else rpStates.push(ps);
  }

  // Sort SPs: fewest starts first (cycle), then by roster order as tiebreaker.
  spStates.sort((a, b) => {
    if (a.pitcherStartsThisSeason !== b.pitcherStartsThisSeason) {
      return a.pitcherStartsThisSeason - b.pitcherStartsThisSeason;
    }
    const aIdx = rosterOrder.indexOf(a.playerId);
    const bIdx = rosterOrder.indexOf(b.playerId);
    return aIdx - bIdx;
  });

  // Select SP: first eligible by start count; fall back to highest availability.
  let startingPitcherId: string | null = null;
  const eligible = spStates.filter(
    (ps) => ps.pitcherAvailability >= constants.spEligibilityThreshold,
  );
  if (eligible.length > 0) {
    startingPitcherId = eligible[0].playerId;
  } else if (spStates.length > 0) {
    // All below threshold — pick highest availability as fallback.
    const fallback = [...spStates].sort((a, b) => b.pitcherAvailability - a.pitcherAvailability)[0];
    startingPitcherId = fallback.playerId;
  }

  // Select RP: highest availability that meets the threshold.
  const eligibleRPs = rpStates.filter(
    (ps) => ps.pitcherAvailability >= constants.rpEligibilityThreshold,
  );
  eligibleRPs.sort((a, b) => b.pitcherAvailability - a.pitcherAvailability);
  const relieverId = eligibleRPs.length > 0 ? eligibleRPs[0].playerId : null;

  return { startingPitcherId, relieverId };
}
