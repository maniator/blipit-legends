/**
 * ScheduledGameStore — persists and retrieves scheduled game records for league seasons.
 */
import type { BallgameDb } from "@storage/db";
import { getDb } from "@storage/db";

import type { ScheduledGameRecord } from "./types";

/** Schema version written to every new ScheduledGameRecord. */
const SCHEDULED_GAME_SCHEMA_VERSION = 1;

type GetDb = () => Promise<BallgameDb>;

export function buildScheduledGameStore(getDbFn: GetDb) {
  return {
    async bulkCreateScheduledGames(
      games: Array<Omit<ScheduledGameRecord, "schemaVersion">>,
    ): Promise<void> {
      const db = await getDbFn();
      const docs: ScheduledGameRecord[] = games.map((g) => ({
        ...g,
        schemaVersion: SCHEDULED_GAME_SCHEMA_VERSION,
      }));
      await db.scheduledGames.bulkInsert(docs);
    },

    async getScheduledGame(id: string): Promise<ScheduledGameRecord | null> {
      const db = await getDbFn();
      const doc = await db.scheduledGames.findOne(id).exec();
      return doc ? (doc.toJSON() as unknown as ScheduledGameRecord) : null;
    },

    async listGamesForSeason(leagueSeasonId: string): Promise<ScheduledGameRecord[]> {
      const db = await getDbFn();
      const docs = await db.scheduledGames.find({ selector: { leagueSeasonId } }).exec();
      return docs.map((d) => d.toJSON() as unknown as ScheduledGameRecord);
    },

    async listGamesForDay(leagueSeasonId: string, gameDay: number): Promise<ScheduledGameRecord[]> {
      const db = await getDbFn();
      const docs = await db.scheduledGames.find({ selector: { leagueSeasonId, gameDay } }).exec();
      return docs.map((d) => d.toJSON() as unknown as ScheduledGameRecord);
    },

    async markScheduledGameCompleted(
      scheduledGameId: string,
      completedGameId: string,
      result?: {
        winnerId: string;
        homeScore: number;
        awayScore: number;
        awayInningRuns?: number[];
        homeInningRuns?: number[];
      },
    ): Promise<void> {
      const db = await getDbFn();
      const doc = await db.scheduledGames.findOne(scheduledGameId).exec();
      if (!doc) throw new Error(`ScheduledGame not found: ${scheduledGameId}`);
      // Idempotent: already completed, nothing to do
      if (doc.status === "completed") return;
      // Guard: byes cannot be completed
      if (doc.status === "bye") {
        throw new Error(`Cannot complete a bye game: ${scheduledGameId}`);
      }
      if (result) {
        await doc.patch({
          status: "completed",
          completedGameId,
          winnerId: result.winnerId,
          homeScore: result.homeScore,
          awayScore: result.awayScore,
          ...(result.awayInningRuns !== undefined && { awayInningRuns: result.awayInningRuns }),
          ...(result.homeInningRuns !== undefined && { homeInningRuns: result.homeInningRuns }),
        });
      } else {
        await doc.patch({ status: "completed", completedGameId });
      }
    },
  };
}

export type ScheduledGameStore = ReturnType<typeof buildScheduledGameStore>;
export const scheduledGameStore = buildScheduledGameStore(getDb);
