/**
 * Schemas for the `leagues`, `leagueSeasons`, and `scheduledGames` collections.
 */
import type { RxJsonSchema } from "rxdb";

import type { LeagueRecord, LeagueSeasonRecord, ScheduledGameRecord } from "./types";

const leaguesSchemaV1: RxJsonSchema<LeagueRecord> = {
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 128 },
    name: { type: "string", maxLength: 256 },
    teamIds: { type: "array", items: { type: "string", maxLength: 128 } },
    divisionCount: { type: "number", minimum: 0, maximum: 9999, multipleOf: 1 },
    tradeDeadlineGameDay: { type: "number", minimum: 0, maximum: 9999, multipleOf: 1 },
    activeLeagueSeasonId: { type: "string", maxLength: 128 },
    status: { type: "string", maxLength: 32 },
    schemaVersion: { type: "number", minimum: 0, maximum: 999, multipleOf: 1 },
    createdAt: { type: "number", minimum: 0, maximum: 9_999_999_999_999, multipleOf: 1 },
    updatedAt: { type: "number", minimum: 0, maximum: 9_999_999_999_999, multipleOf: 1 },
  },
  required: [
    "id",
    "name",
    "teamIds",
    "divisionCount",
    "status",
    "schemaVersion",
    "createdAt",
    "updatedAt",
  ],
  indexes: ["status"],
};

/** Collection config for the `leagues` collection. */
export const leaguesV1CollectionConfig = {
  schema: leaguesSchemaV1,
};

const leagueSeasonsSchemaV1: RxJsonSchema<LeagueSeasonRecord> = {
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 128 },
    leagueId: { type: "string", maxLength: 128 },
    seasonNumber: { type: "number", minimum: 0, maximum: 9999, multipleOf: 1 },
    status: { type: "string", maxLength: 32 },
    currentGameDay: { type: "number", minimum: 0, maximum: 9999, multipleOf: 1 },
    totalGameDays: { type: "number", minimum: 0, maximum: 9999, multipleOf: 1 },
    defaultGamesPerTeam: { type: "number", minimum: 0, maximum: 9999, multipleOf: 1 },
    seed: { type: "string", maxLength: 128 },
    championTeamId: { type: "string", maxLength: 128 },
    schemaVersion: { type: "number", minimum: 0, maximum: 999, multipleOf: 1 },
    createdAt: { type: "number", minimum: 0, maximum: 9_999_999_999_999, multipleOf: 1 },
    updatedAt: { type: "number", minimum: 0, maximum: 9_999_999_999_999, multipleOf: 1 },
  },
  required: [
    "id",
    "leagueId",
    "seasonNumber",
    "status",
    "currentGameDay",
    "totalGameDays",
    "defaultGamesPerTeam",
    "seed",
    "schemaVersion",
    "createdAt",
    "updatedAt",
  ],
  indexes: ["leagueId", ["leagueId", "seasonNumber"]],
};

/** Collection config for the `leagueSeasons` collection. */
export const leagueSeasonsV1CollectionConfig = {
  schema: leagueSeasonsSchemaV1,
};

const scheduledGamesSchemaV1: RxJsonSchema<ScheduledGameRecord> = {
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 128 },
    leagueSeasonId: { type: "string", maxLength: 128 },
    gameDay: { type: "number", minimum: 0, maximum: 9999, multipleOf: 1 },
    awayTeamId: { type: "string", maxLength: 128 },
    homeTeamId: { type: "string", maxLength: 128 },
    status: { type: "string", maxLength: 32 },
    completedGameId: { type: "string", maxLength: 128 },
    winnerId: { type: "string", maxLength: 128 },
    homeScore: { type: "number", minimum: 0, maximum: 9999, multipleOf: 1 },
    awayScore: { type: "number", minimum: 0, maximum: 9999, multipleOf: 1 },
    schemaVersion: { type: "number", minimum: 0, maximum: 999, multipleOf: 1 },
  },
  required: [
    "id",
    "leagueSeasonId",
    "gameDay",
    "awayTeamId",
    "homeTeamId",
    "status",
    "schemaVersion",
  ],
  indexes: ["leagueSeasonId", ["leagueSeasonId", "gameDay"], ["leagueSeasonId", "status"]],
};

/** Collection config for the `scheduledGames` collection. */
export const scheduledGamesV1CollectionConfig = {
  schema: scheduledGamesSchemaV1,
};
