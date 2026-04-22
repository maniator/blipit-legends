/**
 * RxDB schema for the `seasonTeams` collection — one doc per team enrolled in a season.
 * Captures a roster snapshot at enrollment time so in-season play uses the locked roster.
 * version: 0 (initial schema; no migration strategies needed)
 */
import type { RxJsonSchema } from "rxdb";

import type { SeasonTeamRecord } from "./types";

const seasonTeamsSchema: RxJsonSchema<SeasonTeamRecord> = {
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 128 },
    /** FK → SeasonRecord.id — indexed for efficient per-season queries. */
    seasonId: { type: "string", maxLength: 128 },
    /** FK → leagues[].id within the season — indexed for league-level standings. */
    leagueId: { type: "string", maxLength: 128 },
    /** FK → TeamRecord.id — indexed so we can look up which seasons a team is in. */
    customTeamId: { type: "string", maxLength: 128 },
    /** Full roster snapshot captured at season enrollment. */
    rosterSnapshot: { type: "object", additionalProperties: true },
    wins: { type: "number" },
    losses: { type: "number" },
    ties: { type: "number" },
    runDifferential: { type: "number" },
  },
  required: [
    "id",
    "seasonId",
    "leagueId",
    "customTeamId",
    "rosterSnapshot",
    "wins",
    "losses",
    "ties",
    "runDifferential",
  ],
  indexes: ["seasonId", "leagueId", "customTeamId"],
};

/** Collection config for the `seasonTeams` collection. No migration strategies at v0. */
export const seasonTeamsCollectionConfig = {
  schema: seasonTeamsSchema,
};
