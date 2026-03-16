import { fnv1a } from "@storage/hash";
import type { CustomTeamDoc, TeamPlayer } from "@storage/types";

export const CUSTOM_TEAM_EXPORT_FORMAT_VERSION = 1 as const;
/** Signing key for custom-teams exports — change alongside CUSTOM_TEAM_EXPORT_FORMAT_VERSION. */
export const TEAMS_EXPORT_KEY = "ballgame:teams:v1";

export const PLAYER_EXPORT_FORMAT_VERSION = 1 as const;
/** Signing key for individual-player exports. */
export const PLAYER_EXPORT_KEY = "ballgame:player:v1";

/** `TeamPlayer` carrying the export-only `sig` field before it is stripped for DB storage. */
export type TeamPlayerWithSig = TeamPlayer & { sig?: string };

/**
 * Builds a stable seed-based fingerprint for a team (excludes id so it survives re-import).
 * Covers only team-identity fields (name + abbreviation, case-insensitive) plus the
 * per-team random seed generated at creation time.
 * Roster changes do NOT affect the fingerprint — the same team remains the same
 * fingerprint after trades, roster edits, or any player moves.
 * Used for team-level duplicate detection on import.
 * The `teamSeed ?? ""` fallback ensures legacy bundles without a seed still parse cleanly.
 */
export function buildTeamFingerprint(
  team: Pick<CustomTeamDoc, "name" | "abbreviation" | "teamSeed">,
): string {
  const seed = team.teamSeed ?? "";
  const key = team.name.toLowerCase() + "|" + (team.abbreviation ?? "").toLowerCase();
  return fnv1a(seed + key);
}

/**
 * Computes a seed-based integrity signature for a single player.
 * Covers only the player's immutable identity fields: name, role, and stats
 * (batting for hitters; pitching for pitchers), plus the per-player random seed
 * generated at creation time.
 *
 * Design notes:
 *   - `id` is intentionally excluded: IDs are remapped on import collision and must
 *     not affect duplicate detection — two players with identical stats and name but
 *     different DB IDs are the same person.
 *   - `position`, `handedness`, `jerseyNumber`, `pitchingRole` are intentionally excluded:
 *     these are editable after creation and must not invalidate a previously issued sig.
 *   - For pure hitters `pitching` is `undefined`. `JSON.stringify` omits `undefined` values
 *     consistently on both the export side and the re-import side, so the sig is
 *     deterministic across round-trips with no special normalisation needed.
 *   - `playerSeed ?? ""` fallback ensures legacy bundles without a seed still parse cleanly.
 *
 * The sig serves two purposes:
 *   1. Tamper detection: any post-export mutation of name or stats is detectable on import.
 *   2. Duplicate detection: a player whose sig matches one already in the DB is a likely
 *      duplicate even if imported to a different team or with a remapped ID.
 */
export function buildPlayerSig(
  player: Pick<TeamPlayer, "name" | "role" | "batting" | "pitching" | "playerSeed">,
): string {
  const seed = player.playerSeed ?? "";
  const { name, role, batting, pitching } = player;
  return fnv1a(seed + JSON.stringify({ name, role, batting, pitching }));
}

/** Returns a copy of `player` with its `sig` field stripped (export-only metadata). */
export function stripPlayerSig(player: TeamPlayer): TeamPlayer {
  if (!("sig" in player)) return player;

  const { sig: _, ...rest } = player as TeamPlayer & { sig?: string };
  return rest as TeamPlayer;
}

/** Returns a team doc with all player `sig` fields removed from every roster slot. */
export function stripTeamPlayerSigs(team: CustomTeamDoc): CustomTeamDoc {
  return {
    ...team,
    roster: {
      ...team.roster,
      lineup: team.roster.lineup.map(stripPlayerSig),
      bench: team.roster.bench.map(stripPlayerSig),
      pitchers: team.roster.pitchers.map(stripPlayerSig),
    },
  };
}
