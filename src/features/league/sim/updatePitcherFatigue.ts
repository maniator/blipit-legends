/**
 * Pitcher fatigue state updater — post-game recovery recalculation.
 *
 * Called after each completed season game. Updates pitcherDaysRest and
 * pitcherAvailability for every pitcher on both teams.
 *
 * Recovery curves and eligibility thresholds are version-gated via
 * getPitcherFatigueConstants(rulesetVersion) so in-flight seasons remain
 * deterministic across app updates.
 *
 * Back-to-back-to-back floor: an RP that appeared in both of the previous two
 * consecutive game-days has pitcherAvailability clamped to 0.0. Tracked via
 * pitcherDaysRest === 0 on two consecutive days — no new schema field needed.
 * (v1 — see _bmad-output/planning-artifacts/league-mode-distillate/03-setup-wizard-autogen-fatigue-hub.md)
 */
import { getPitcherFatigueConstants } from "@feat/league/ruleset/pitcherFatigueConstants";
import type { SeasonPlayerStateRecord } from "@feat/league/storage/types";

// ---------------------------------------------------------------------------
// Roster snapshot helpers (typed to avoid reaching into @feat/customTeams)
// ---------------------------------------------------------------------------

/** Minimal pitcher shape extracted from a rosterSnapshot. */
interface RosterPitcherEntry {
  id: string;
  pitchingRole?: "SP" | "RP" | "SP/RP";
}

/** Narrow typed view of a rosterSnapshot sufficient for fatigue updates. */
interface RosterSnapshotV1 {
  pitchers?: RosterPitcherEntry[];
}

/**
 * Resolves a pitcher's effective role from the roster snapshot.
 * 'SP/RP' → 'SP' (SP recovery curve dominates, per spec).
 * Missing role → 'RP' (conservative default).
 */
function resolveRole(playerId: string, rosterSnapshot: Record<string, unknown>): "SP" | "RP" {
  const snap = rosterSnapshot as RosterSnapshotV1;
  const entry = snap.pitchers?.find((p) => p.id === playerId);
  if (!entry || !entry.pitchingRole) return "RP";
  if (entry.pitchingRole === "SP" || entry.pitchingRole === "SP/RP") return "SP";
  return "RP";
}

/**
 * Looks up availability from the role-specific recovery curve.
 * - SP: caps at day 4 (spRecovery[4] = 1.0; anything above 4 also returns 1.0).
 * - RP: 3+ days → 1.0 (per spec); uses rpRecovery for 0, 1, 2.
 */
function lookupRecovery(
  role: "SP" | "RP",
  daysRest: number,
  constants: ReturnType<typeof getPitcherFatigueConstants>,
): number {
  if (role === "SP") {
    const capped = Math.min(daysRest, 4) as 0 | 1 | 2 | 3 | 4;
    return constants.spRecovery[capped] ?? 1.0;
  }
  // RP: 3+ days → 1.0
  if (daysRest >= 3) return 1.0;
  return constants.rpRecovery[daysRest as 0 | 1 | 2] ?? 1.0;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface PitcherFatigueUpdateInput {
  seasonId: string;
  rulesetVersion: number;
  /** seasonTeamId of the winning team. */
  winnerSeasonTeamId: string;
  /** seasonTeamId of the losing team. */
  loserSeasonTeamId: string;
  /** playerId of the starting pitcher for the winning team. */
  winnerStartingPitcherId: string;
  /** playerId of the starting pitcher for the losing team. */
  loserStartingPitcherId: string;
  /** playerId of the relief pitcher for the winning team. Empty string if none. */
  winnerRelieverId?: string;
  /** playerId of the relief pitcher for the losing team. Empty string if none. */
  loserRelieverId?: string;
  /** All SeasonPlayerStateRecord docs for both teams combined. */
  allPlayerStates: SeasonPlayerStateRecord[];
  /**
   * Full rosterSnapshot per seasonTeamId — keyed by seasonTeamId.
   * Used to determine pitchingRole without cross-feature imports.
   */
  rosterSnapshotBySeasonTeamId: Record<string, Record<string, unknown>>;
}

/** Partial patches keyed by player state id — safe to bulkUpsert into RxDB. */
export type PitcherFatiguePatches = Pick<
  SeasonPlayerStateRecord,
  "id" | "pitcherDaysRest" | "pitcherAvailability" | "pitcherStartsThisSeason"
>[];

/**
 * Computes pitcher fatigue patches for all players after a completed game.
 * Returns a list of partial records suitable for RxDB bulkUpsert / patch calls.
 * Pure function — no DB access.
 */
export function computePitcherFatigueUpdates(
  input: PitcherFatigueUpdateInput,
): PitcherFatiguePatches {
  const {
    rulesetVersion,
    winnerStartingPitcherId,
    loserStartingPitcherId,
    winnerRelieverId,
    loserRelieverId,
    allPlayerStates,
    rosterSnapshotBySeasonTeamId,
  } = input;

  const constants = getPitcherFatigueConstants(rulesetVersion);
  // Exclude empty-string sentinel values — null pitcher IDs (no eligible
  // pitcher found) should not trigger fatigue updates for a ghost player.
  const pitched = new Set(
    [
      winnerStartingPitcherId,
      loserStartingPitcherId,
      winnerRelieverId ?? "",
      loserRelieverId ?? "",
    ].filter((id) => id !== ""),
  );

  return allPlayerStates.map((ps) => {
    const snapshot = rosterSnapshotBySeasonTeamId[ps.seasonTeamId] ?? {};
    const role = resolveRole(ps.playerId, snapshot);

    let newDaysRest: number;
    let newAvailability: number;
    let newStartsThisSeason = ps.pitcherStartsThisSeason;

    if (pitched.has(ps.playerId)) {
      // Appeared in this game — reset rest counter.
      // Back-to-back floor: if this pitcher ALSO appeared yesterday
      // (pitcherDaysRest === 0 entering this game), clamp availability to
      // rpBackToBackFloor so they remain available in high-leverage situations
      // but at significantly reduced capacity.
      // Design decision (locked in decisions.md §12 / distillate §03): real bullpen
      // arms do go back-to-back; a 0.0 clamp (full unavailability) is too aggressive
      // and produces anemic bullpens over a sprint season. 0.20 floor keeps the arm
      // below the RP eligibility threshold (0.41) so they won't be *preferred*, but
      // a desperate manager-mode override can still reach them.
      const isBackToBack = ps.pitcherDaysRest === 0;
      newDaysRest = 0;
      newAvailability = isBackToBack
        ? constants.rpBackToBackFloor
        : lookupRecovery(role, 0, constants);
      // Increment start count for SPs only (tracks rotation cycle order).
      if (role === "SP") {
        newStartsThisSeason += 1;
      }
    } else {
      // Did not appear — rest counter increments.
      newDaysRest = ps.pitcherDaysRest + 1;
      newAvailability = lookupRecovery(role, newDaysRest, constants);
    }

    return {
      id: ps.id,
      pitcherDaysRest: newDaysRest,
      pitcherAvailability: newAvailability,
      pitcherStartsThisSeason: newStartsThisSeason,
    };
  });
}
