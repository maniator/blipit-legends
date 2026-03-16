import type { BallgameDb } from "@storage/db";
import type { CustomTeamDoc } from "@storage/types";

import { assembleRoster, fetchPlayerDocs, writePlayerDocs } from "./customTeamPlayerDocs";

/**
 * Populates the roster of a team from the `players` collection.
 * If no player docs exist yet (legacy team), falls back to the embedded roster,
 * backfills the `players` collection, and then clears the embedded arrays so there
 * is a single source of truth going forward.
 */
export async function populateRoster(db: BallgameDb, team: CustomTeamDoc): Promise<CustomTeamDoc> {
  const playerDocs = await fetchPlayerDocs(db, team.id);
  if (playerDocs.length > 0) {
    return { ...team, roster: assembleRoster(playerDocs, team.roster) };
  }
  // Legacy team: no player docs yet — backfill from embedded roster.
  if (
    team.roster.lineup.length > 0 ||
    team.roster.bench.length > 0 ||
    team.roster.pitchers.length > 0
  ) {
    await writePlayerDocs(db, team.id, team.roster);
    // Clear the embedded arrays now that players live in the `players` collection,
    // eliminating the two-sources-of-truth issue for future reads.
    const emptyRoster = {
      schemaVersion: team.roster.schemaVersion,
      lineup: [],
      bench: [],
      pitchers: [],
    };
    const doc = await db.customTeams.findOne(team.id).exec();
    if (doc) {
      await doc.patch({ roster: emptyRoster });
    }
    return { ...team, roster: assembleRoster(await fetchPlayerDocs(db, team.id), team.roster) };
  }
  return team;
}
