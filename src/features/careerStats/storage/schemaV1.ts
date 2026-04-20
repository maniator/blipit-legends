/**
 * v1 clean schemas for the `completedGames`, `batterGameStats`, and `pitcherGameStats`
 * collections.
 *
 * version is 0 and there are NO migration strategies — the epoch-based reset
 * in db.ts wipes the old ballgame IndexedDB before these schemas are applied.
 *
 * The data shapes of CompletedGameRecord / BatterGameStatRecord / PitcherGameStatRecord
 * are unchanged from the previous persisted schemas; only collection wiring,
 * versioning strategy, and migration baggage changed.
 */
import type { RxJsonSchema } from "rxdb";

import type { BatterGameStatRecord, CompletedGameRecord, PitcherGameStatRecord } from "./types";

const completedGamesSchemaV1: RxJsonSchema<CompletedGameRecord> = {
  version: 1,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 128 },
    playedAt: { type: "number", minimum: 0, maximum: 9_999_999_999_999, multipleOf: 1 },
    seed: { type: "string" },
    rngState: { type: ["number", "null"] },
    homeTeamId: { type: "string", maxLength: 128 },
    awayTeamId: { type: "string", maxLength: 128 },
    homeScore: { type: "number", minimum: 0, maximum: 9999, multipleOf: 1 },
    awayScore: { type: "number", minimum: 0, maximum: 9999, multipleOf: 1 },
    innings: { type: "number", minimum: 1, maximum: 999, multipleOf: 1 },
    committedBySaveId: { type: "string" },
    leagueSeasonId: { type: "string", maxLength: 128 },
    scheduledGameId: { type: "string", maxLength: 128 },
    schemaVersion: { type: "number", minimum: 0, maximum: 999, multipleOf: 1 },
  },
  required: [
    "id",
    "playedAt",
    "seed",
    "rngState",
    "homeTeamId",
    "awayTeamId",
    "homeScore",
    "awayScore",
    "innings",
    "schemaVersion",
  ],
  indexes: ["playedAt", ["homeTeamId", "playedAt"], ["awayTeamId", "playedAt"]],
};

/** v1 collection config for the `completedGames` collection. Includes v0→v1 migration. */
export const completedGamesV1CollectionConfig = {
  schema: completedGamesSchemaV1,
  migrationStrategies: {
    1: (oldDoc: Record<string, unknown>) => ({
      ...oldDoc,
      leagueSeasonId: undefined,
      scheduledGameId: undefined,
    }),
  },
};

const batterGameStatsSchemaV1: RxJsonSchema<BatterGameStatRecord> = {
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 256 },
    gameId: { type: "string", maxLength: 128 },
    teamId: { type: "string", maxLength: 128 },
    opponentTeamId: { type: "string", maxLength: 128 },
    playerId: { type: "string", maxLength: 256 },
    nameAtGameTime: { type: "string" },
    role: { type: "string", enum: ["batter", "pitcher"], maxLength: 8 },
    batting: { type: "object", additionalProperties: true },
    createdAt: { type: "number", minimum: 0, maximum: 9_999_999_999_999, multipleOf: 1 },
    schemaVersion: { type: "number", minimum: 0, maximum: 999, multipleOf: 1 },
  },
  required: [
    "id",
    "gameId",
    "teamId",
    "opponentTeamId",
    "playerId",
    "nameAtGameTime",
    "role",
    "batting",
    "createdAt",
    "schemaVersion",
  ],
  indexes: ["gameId", ["playerId", "createdAt"], ["teamId", "createdAt"]],
};

/** v1 collection config for the `batterGameStats` collection. No migration strategies. */
export const batterGameStatsV1CollectionConfig = {
  schema: batterGameStatsSchemaV1,
};

const pitcherGameStatsSchemaV1: RxJsonSchema<PitcherGameStatRecord> = {
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 256 },
    gameId: { type: "string", maxLength: 128 },
    teamId: { type: "string", maxLength: 128 },
    opponentTeamId: { type: "string", maxLength: 128 },
    playerId: { type: "string", maxLength: 256 },
    nameAtGameTime: { type: "string" },
    outsPitched: { type: "number", minimum: 0, maximum: 99999, multipleOf: 1 },
    battersFaced: { type: "number", minimum: 0, maximum: 99999, multipleOf: 1 },
    pitchesThrown: { type: "number", minimum: 0, maximum: 99999, multipleOf: 1 },
    hitsAllowed: { type: "number", minimum: 0, maximum: 99999, multipleOf: 1 },
    walksAllowed: { type: "number", minimum: 0, maximum: 99999, multipleOf: 1 },
    strikeoutsRecorded: { type: "number", minimum: 0, maximum: 99999, multipleOf: 1 },
    homersAllowed: { type: "number", minimum: 0, maximum: 99999, multipleOf: 1 },
    runsAllowed: { type: "number", minimum: 0, maximum: 99999, multipleOf: 1 },
    earnedRuns: { type: "number", minimum: 0, maximum: 99999, multipleOf: 1 },
    saves: { type: "number", minimum: 0, maximum: 9999, multipleOf: 1 },
    holds: { type: "number", minimum: 0, maximum: 9999, multipleOf: 1 },
    blownSaves: { type: "number", minimum: 0, maximum: 9999, multipleOf: 1 },
    createdAt: { type: "number", minimum: 0, maximum: 9_999_999_999_999, multipleOf: 1 },
    schemaVersion: { type: "number", minimum: 0, maximum: 999, multipleOf: 1 },
  },
  required: [
    "id",
    "gameId",
    "teamId",
    "opponentTeamId",
    "playerId",
    "nameAtGameTime",
    "outsPitched",
    "battersFaced",
    "pitchesThrown",
    "hitsAllowed",
    "walksAllowed",
    "strikeoutsRecorded",
    "homersAllowed",
    "runsAllowed",
    "earnedRuns",
    "saves",
    "holds",
    "blownSaves",
    "createdAt",
    "schemaVersion",
  ],
  indexes: ["gameId", ["playerId", "createdAt"], ["teamId", "createdAt"]],
};

/** v1 collection config for the `pitcherGameStats` collection. No migration strategies. */
export const pitcherGameStatsV1CollectionConfig = {
  schema: pitcherGameStatsSchemaV1,
};
