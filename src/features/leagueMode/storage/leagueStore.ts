/**
 * LeagueStore — persists and retrieves league records.
 */
import type { BallgameDb } from "@storage/db";
import { getDb } from "@storage/db";
import { generateLeagueId } from "@storage/generateId";

import type { LeagueRecord, LeagueStatus } from "./types";

/** Schema version written to every new LeagueRecord. */
const LEAGUE_SCHEMA_VERSION = 0;

type GetDb = () => Promise<BallgameDb>;

export function buildLeagueStore(getDbFn: GetDb) {
  return {
    async createLeague(
      data: Omit<LeagueRecord, "id" | "createdAt" | "updatedAt" | "schemaVersion">,
    ): Promise<LeagueRecord> {
      const db = await getDbFn();
      const now = Date.now();
      const doc: LeagueRecord = {
        ...data,
        id: generateLeagueId(),
        schemaVersion: LEAGUE_SCHEMA_VERSION,
        createdAt: now,
        updatedAt: now,
      };
      await db.leagues.insert(doc);
      return doc;
    },

    async getLeague(id: string): Promise<LeagueRecord | null> {
      const db = await getDbFn();
      const doc = await db.leagues.findOne(id).exec();
      return doc ? (doc.toJSON() as unknown as LeagueRecord) : null;
    },

    async listLeagues(status?: LeagueStatus): Promise<LeagueRecord[]> {
      const db = await getDbFn();
      const selector = status !== undefined ? { status } : {};
      const docs = await db.leagues.find({ selector }).exec();
      return docs.map((d) => d.toJSON() as unknown as LeagueRecord);
    },

    async updateLeague(
      id: string,
      patch: Partial<Omit<LeagueRecord, "id" | "createdAt" | "schemaVersion">>,
    ): Promise<LeagueRecord> {
      const db = await getDbFn();
      const doc = await db.leagues.findOne(id).exec();
      if (!doc) throw new Error(`League not found: ${id}`);
      const updated = await doc.patch({ ...patch, updatedAt: Date.now() });
      return updated.toJSON() as unknown as LeagueRecord;
    },

    async archiveLeague(id: string): Promise<void> {
      const db = await getDbFn();
      const doc = await db.leagues.findOne(id).exec();
      if (!doc) throw new Error(`League not found: ${id}`);
      await doc.patch({ status: "archived", updatedAt: Date.now() });
    },
  };
}

export type LeagueStore = ReturnType<typeof buildLeagueStore>;
export const leagueStore = buildLeagueStore(getDb);
