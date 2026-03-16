import type { BallgameDb } from "@storage/db";
import { fnv1a } from "@storage/hash";
import type { PlayerDoc, TeamPlayer, TeamRoster } from "@storage/types";

export const PLAYER_SCHEMA_VERSION = 1;

/** Converts a sanitized TeamPlayer into a PlayerDoc for a given team/section/index. */
export function toPlayerDoc(
  player: TeamPlayer,
  teamId: string,
  section: "lineup" | "bench" | "pitchers",
  orderIndex: number,
): PlayerDoc {
  // Backfill globalPlayerId for players imported from legacy bundles (created before
  // globalPlayerId was added to the schema). The v4 players schema requires this field;
  // without the backfill, bulkUpsert throws a validation error and the whole import fails.
  // Use playerSeed first (gives the canonical stable identity), fall back to player.id
  // (always present in TeamPlayer) so every player gets a unique value even if both
  // playerSeed and globalPlayerId are absent.
  const globalPlayerId = player.globalPlayerId ?? `pl_${fnv1a(player.playerSeed ?? player.id)}`;
  return {
    ...player,
    globalPlayerId,
    // Use a team-scoped composite primary key to prevent cross-team collisions
    // when two different teams contain a player with the same original ID.
    id: `${teamId}:${player.id}`,
    playerId: player.id,
    teamId,
    section,
    orderIndex,
    schemaVersion: PLAYER_SCHEMA_VERSION,
  };
}

/** Returns all PlayerDocs for a team. Sorting by section and orderIndex is handled by assembleRoster. */
export async function fetchPlayerDocs(db: BallgameDb, teamId: string): Promise<PlayerDoc[]> {
  const docs = await db.players.find({ selector: { teamId } }).exec();
  return docs.map((d) => d.toJSON() as unknown as PlayerDoc);
}

/** Assembles a TeamRoster from a list of PlayerDocs for a team. */
export function assembleRoster(playerDocs: PlayerDoc[], existingRoster: TeamRoster): TeamRoster {
  const toTeamPlayer = ({
    teamId: _teamId,
    section: _section,
    orderIndex: _orderIndex,
    schemaVersion: _schemaVersion,
    playerId,
    id: compositeId,
    ...rest
  }: PlayerDoc): TeamPlayer => ({
    ...rest,
    // Reconstruct the original player ID: `playerId` is set on v2 docs;
    // fall back to `id` for legacy docs that were not migrated yet.
    id: playerId ?? compositeId,
  });
  const lineup = playerDocs
    .filter((p) => p.section === "lineup")
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map(toTeamPlayer);
  const bench = playerDocs
    .filter((p) => p.section === "bench")
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map(toTeamPlayer);
  const pitchers = playerDocs
    .filter((p) => p.section === "pitchers")
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map(toTeamPlayer);
  return {
    schemaVersion: existingRoster.schemaVersion,
    lineup,
    bench,
    pitchers,
  };
}

/**
 * Writes all players from a roster into the `players` collection using bulkUpsert.
 * Existing docs with matching IDs are updated; new player IDs are inserted.
 * Returns the Set of composite doc IDs that were written, for use with removePlayerDocs.
 */
export async function writePlayerDocs(
  db: BallgameDb,
  teamId: string,
  roster: TeamRoster,
): Promise<Set<string>> {
  const allDocs = [
    ...roster.lineup.map((p, i) => toPlayerDoc(p, teamId, "lineup", i)),
    ...roster.bench.map((p, i) => toPlayerDoc(p, teamId, "bench", i)),
    ...roster.pitchers.map((p, i) => toPlayerDoc(p, teamId, "pitchers", i)),
  ];
  if (allDocs.length > 0) {
    await db.players.bulkUpsert(allDocs);
  }
  return new Set(allDocs.map((d) => d.id));
}

/**
 * Removes all player docs for a given team from the `players` collection.
 * When `exceptIds` is provided, only docs whose IDs are NOT in that set are removed.
 */
export async function removePlayerDocs(
  db: BallgameDb,
  teamId: string,
  exceptIds?: Set<string>,
): Promise<void> {
  const existing = await db.players.find({ selector: { teamId } }).exec();
  const toRemove = exceptIds ? existing.filter((p) => !exceptIds.has(p.id)) : existing;
  await Promise.all(toRemove.map((p) => p.remove()));
}
