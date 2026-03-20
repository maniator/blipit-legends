import { fnv1a } from "@storage/hash";
import type { TeamPlayer, TeamRecord, TeamWithRoster } from "@storage/types";

export const CUSTOM_TEAM_EXPORT_FORMAT_VERSION = 1 as const;
/** Signing key for custom-teams exports — change alongside CUSTOM_TEAM_EXPORT_FORMAT_VERSION. */
export const TEAMS_EXPORT_KEY = "ballgame:teams:v1";

export const PLAYER_EXPORT_FORMAT_VERSION = 1 as const;
/** Signing key for individual-player exports. */
export const PLAYER_EXPORT_KEY = "ballgame:player:v1";

/** `TeamPlayer` carrying the export-only `sig` field before it is stripped for DB storage. */
export type TeamPlayerWithSig = TeamPlayer & { sig?: string };

/**
 * Builds a stable id-based fingerprint for a team.
 * Covers team-identity fields (name + abbreviation, case-insensitive) plus the
 * team's stable `id` as the entropy source.
 * Roster changes do NOT affect the fingerprint — the same team remains the same
 * fingerprint after trades, roster edits, or any player moves.
 * Used for team-level duplicate detection on import.
 */
export function buildTeamFingerprint(
  team: Pick<TeamRecord, "id" | "name" | "abbreviation">,
): string {
  const key = team.name.toLowerCase() + "|" + (team.abbreviation ?? "").toLowerCase();
  return fnv1a(team.id + key);
}

/**
 * Computes a content-based signature for a single player.
 * Covers only name, role, and stats (batting for hitters; pitching for pitchers).
 * The player `id` is intentionally excluded so that duplicate detection and
 * bundle integrity are both content-driven.
 *
 * Design notes:
 *   - `position`, `handedness`, `jerseyNumber`, `pitchingRole` are intentionally excluded:
 *     these are editable after creation and must not invalidate a previously issued sig.
 *   - For pure hitters `pitching` is `undefined`. `JSON.stringify` omits `undefined` values
 *     consistently on both the export side and the re-import side, so the sig is
 *     deterministic across round-trips with no special normalisation needed.
 *
 * The sig serves two purposes:
 *   1. Integrity checksum: detects accidental corruption or truncation of exported bundles
 *      on round-trip. This is NOT cryptographic.
 *   2. Duplicate detection: a player whose sig matches one already in the DB is a likely
 *      duplicate even if imported with a different ID.
 */
export function buildPlayerSig(
  player: Pick<TeamPlayer, "name" | "role" | "batting" | "pitching">,
): string {
  const { name, role, batting, pitching } = player;
  return fnv1a(JSON.stringify({ name, role, batting, pitching }));
}

/** Returns a copy of `player` with its `sig` field stripped (export-only metadata). */
export function stripPlayerSig(player: TeamPlayer): TeamPlayer {
  if (!("sig" in player)) return player;

  const { sig: _, ...rest } = player as TeamPlayer & { sig?: string };
  return rest as TeamPlayer;
}

/** Returns a team doc with all player `sig` fields removed from every roster slot. */
export function stripTeamPlayerSigs(team: TeamWithRoster): TeamWithRoster {
  return {
    ...team,
    roster: {
      ...team.roster,
      lineup: team.roster.lineup.map(stripPlayerSig),
      bench: (team.roster.bench ?? []).map(stripPlayerSig),
      pitchers: team.roster.pitchers.map(stripPlayerSig),
    },
  };
}
