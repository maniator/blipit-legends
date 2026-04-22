/**
 * RxDB schema for the `seasonGames` collection — one doc per scheduled/played game in a season.
 * version: 0 (initial schema; no migration strategies needed)
 */
import type { RxJsonSchema } from "rxdb";

import type { SeasonGameRecord } from "./types";

const seasonGamesSchema: RxJsonSchema<SeasonGameRecord> = {
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 128 },
    /** FK → SeasonRecord.id — indexed for per-season game queries. */
    seasonId: { type: "string", maxLength: 128 },
    /** 0-based game day within the season schedule — indexed for schedule page. */
    gameDay: { type: "number", minimum: 0, maximum: 9999, multipleOf: 1 },
    /** FK → SeasonTeamRecord.id for the home team. */
    homeSeasonTeamId: { type: "string", maxLength: 128 },
    /** FK → SeasonTeamRecord.id for the away team. */
    awaySeasonTeamId: { type: "string", maxLength: 128 },
    /** Groups games that are part of the same series. */
    seriesId: { type: "string", maxLength: 128 },
    /** Lifecycle status of the game — indexed for filtering by state. */
    status: {
      type: "string",
      enum: ["scheduled", "in_progress", "completed"],
      maxLength: 16,
    },
    /** Full boxscore result once the game is completed; null before completion. */
    boxscore: { type: ["object", "null"], additionalProperties: true },
    /** Deterministic seed derived from masterSeed + game slot for RNG reproducibility. */
    derivedSeed: { type: "string", maxLength: 64 },
    completedAt: { type: ["number", "null"] },
    /** Client/session token that has claimed this game for in-progress simulation. */
    claimedBy: { type: ["string", "null"], maxLength: 64 },
  },
  required: [
    "id",
    "seasonId",
    "gameDay",
    "homeSeasonTeamId",
    "awaySeasonTeamId",
    "seriesId",
    "status",
    "derivedSeed",
  ],
  indexes: ["seasonId", "gameDay", "status"],
};

/** Collection config for the `seasonGames` collection. No migration strategies at v0. */
export const seasonGamesCollectionConfig = {
  schema: seasonGamesSchema,
};
