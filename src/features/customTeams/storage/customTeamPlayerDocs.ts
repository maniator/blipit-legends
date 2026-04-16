import type { BallgameDb } from "@storage/db";
import type { PlayerRecord, TeamPlayer, TeamRoster } from "@storage/types";

import { ROSTER_SCHEMA_VERSION } from "./customTeamSanitizers";

export const PLAYER_SCHEMA_VERSION = 1;

/** Returns all PlayerRecords for a team, sorted by section and orderIndex. */
export async function fetchTeamPlayers(db: BallgameDb, teamId: string): Promise<PlayerRecord[]> {
  const docs = await db.players.find({ selector: { teamId } }).exec();
  return docs.map((d) => d.toJSON() as PlayerRecord);
}

/** Strips storage-only fields from a PlayerRecord, returning a TeamPlayer shape. */
export function toTeamPlayer({
  teamId: _teamId,
  section: _section,
  orderIndex: _orderIndex,
  schemaVersion: _schemaVersion,
  createdAt: _createdAt,
  updatedAt: _updatedAt,
  ...rest
}: PlayerRecord): TeamPlayer {
  return rest as TeamPlayer;
}

/** Assembles a TeamRoster from a list of PlayerRecords for a team. */
export function assembleRoster(players: PlayerRecord[]): TeamRoster {
  // Single-pass grouping instead of 3 separate filter passes (3×O(n) → O(n)).
  const grouped: Record<"lineup" | "bench" | "pitchers", PlayerRecord[]> = {
    lineup: [],
    bench: [],
    pitchers: [],
  };
  for (const p of players) {
    grouped[p.section].push(p);
  }

  const sortedMapped = (arr: PlayerRecord[]) =>
    arr.sort((a, b) => a.orderIndex - b.orderIndex).map(toTeamPlayer);

  return {
    schemaVersion: ROSTER_SCHEMA_VERSION,
    lineup: sortedMapped(grouped.lineup),
    bench: sortedMapped(grouped.bench),
    pitchers: sortedMapped(grouped.pitchers),
  };
}

/** Builds a PlayerRecord from a TeamPlayer for a given team/section/index. */
function toPlayerRecord(
  player: TeamPlayer,
  teamId: string,
  section: "lineup" | "bench" | "pitchers",
  orderIndex: number,
  now: string,
): PlayerRecord {
  const base = {
    id: player.id, // NOT composite — player.id IS the PK
    teamId,
    section,
    orderIndex,
    name: player.name,
    position: player.position,
    handedness: player.handedness,
    isBenchEligible: player.isBenchEligible,
    isPitcherEligible: player.isPitcherEligible,
    jerseyNumber: player.jerseyNumber,
    fingerprint: player.fingerprint,
    createdAt: now,
    updatedAt: now,
    schemaVersion: PLAYER_SCHEMA_VERSION,
  };

  switch (player.role) {
    case "batter":
      return {
        ...base,
        role: "batter",
        batting: player.batting,
      } as PlayerRecord;
    case "pitcher":
      return {
        ...base,
        role: "pitcher",
        pitching: player.pitching,
        pitchingRole: player.pitchingRole,
      } as PlayerRecord;
  }
}

/**
 * Writes all players from a roster into the `players` collection using bulkUpsert.
 * Existing docs with matching IDs are updated; new player IDs are inserted.
 * Returns the Set of player IDs that were written, for use with removeTeamPlayerRecords.
 */
export async function writePlayerRecords(
  db: BallgameDb,
  teamId: string,
  roster: TeamRoster,
): Promise<Set<string>> {
  const now = new Date().toISOString();
  const allRecords: PlayerRecord[] = [
    ...roster.lineup.map((p, i) => toPlayerRecord(p, teamId, "lineup", i, now)),
    ...(roster.bench ?? []).map((p, i) => toPlayerRecord(p, teamId, "bench", i, now)),
    ...roster.pitchers.map((p, i) => toPlayerRecord(p, teamId, "pitchers", i, now)),
  ];
  if (allRecords.length > 0) {
    await db.players.bulkUpsert(allRecords);
  }
  return new Set(allRecords.map((r) => r.id));
}

/**
 * Removes all player records for a given team from the `players` collection.
 * When `exceptIds` is provided, only records whose IDs are NOT in that set are removed.
 */
export async function removeTeamPlayerRecords(
  db: BallgameDb,
  teamId: string,
  exceptIds?: Set<string>,
): Promise<void> {
  const existing = await db.players.find({ selector: { teamId } }).exec();
  const toRemove = exceptIds ? existing.filter((p) => !exceptIds.has(p.id)) : existing;
  if (toRemove.length > 0) {
    // Single bulk operation instead of N individual remove() calls.
    await db.players.bulkRemove(toRemove.map((p) => p.id));
  }
}
