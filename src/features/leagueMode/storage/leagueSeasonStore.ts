/**
 * LeagueSeasonStore — persists and retrieves league season records.
 */
import type { BallgameDb } from "@storage/db";
import { getDb } from "@storage/db";
import { generateLeagueSeasonId } from "@storage/generateId";

import type { LeagueSeasonRecord } from "./types";

/** Schema version written to every new LeagueSeasonRecord. */
const LEAGUE_SEASON_SCHEMA_VERSION = 0;

type GetDb = () => Promise<BallgameDb>;

export function buildLeagueSeasonStore(getDbFn: GetDb) {
  return {
    async createLeagueSeason(
      data: Omit<LeagueSeasonRecord, "id" | "createdAt" | "updatedAt" | "schemaVersion">,
    ): Promise<LeagueSeasonRecord> {
      const db = await getDbFn();
      const now = Date.now();
      const doc: LeagueSeasonRecord = {
        ...data,
        id: generateLeagueSeasonId(),
        schemaVersion: LEAGUE_SEASON_SCHEMA_VERSION,
        createdAt: now,
        updatedAt: now,
      };
      await db.leagueSeasons.insert(doc);
      return doc;
    },

    async getLeagueSeason(id: string): Promise<LeagueSeasonRecord | null> {
      const db = await getDbFn();
      const doc = await db.leagueSeasons.findOne(id).exec();
      return doc ? (doc.toJSON() as unknown as LeagueSeasonRecord) : null;
    },

    async listSeasonsForLeague(leagueId: string): Promise<LeagueSeasonRecord[]> {
      const db = await getDbFn();
      const docs = await db.leagueSeasons.find({ selector: { leagueId } }).exec();
      return docs.map((d) => d.toJSON() as unknown as LeagueSeasonRecord);
    },

    async getActiveSeasonForLeague(leagueId: string): Promise<LeagueSeasonRecord | null> {
      const db = await getDbFn();
      const docs = await db.leagueSeasons.find({ selector: { leagueId, status: "active" } }).exec();
      return docs[0] ? (docs[0].toJSON() as unknown as LeagueSeasonRecord) : null;
    },

    async markSeasonActive(leagueSeasonId: string): Promise<void> {
      const db = await getDbFn();
      const doc = await db.leagueSeasons.findOne(leagueSeasonId).exec();
      if (!doc) throw new Error(`LeagueSeason not found: ${leagueSeasonId}`);
      await doc.patch({ status: "active", updatedAt: Date.now() });
    },

    async markSeasonComplete(leagueSeasonId: string, championTeamId: string): Promise<void> {
      const db = await getDbFn();
      const doc = await db.leagueSeasons.findOne(leagueSeasonId).exec();
      if (!doc) throw new Error(`LeagueSeason not found: ${leagueSeasonId}`);
      // Idempotent: no-op if already complete
      if (doc.status === "complete") return;
      await doc.patch({ status: "complete", championTeamId, updatedAt: Date.now() });
    },
  };
}

export type LeagueSeasonStore = ReturnType<typeof buildLeagueSeasonStore>;
export const leagueSeasonStore = buildLeagueSeasonStore(getDb);
