/**
 * RxDB schema for the `seasonPlayerState` collection — tracks pitcher fatigue and availability
 * per player per season. One doc per player per season; primary key is composite `${seasonId}:${playerId}`.
 * version: 0 (initial schema; no migration strategies needed)
 */
import type { RxJsonSchema } from "rxdb";

import type { SeasonPlayerStateRecord } from "./types";

const seasonPlayerStateSchema: RxJsonSchema<SeasonPlayerStateRecord> = {
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    /** Composite primary key: `${seasonId}:${playerId}` */
    id: { type: "string", maxLength: 256 },
    /** FK → SeasonRecord.id — indexed for per-season queries. */
    seasonId: { type: "string", maxLength: 128 },
    /** FK → SeasonTeamRecord.id — indexed for per-team queries. */
    seasonTeamId: { type: "string", maxLength: 128 },
    /** FK → PlayerRecord.id */
    playerId: { type: "string", maxLength: 128 },
    /** Number of days since the pitcher's last appearance (0 = pitched today). */
    pitcherDaysRest: { type: "number" },
    /**
     * Current availability (0.0–1.0). Drives eligibility check against threshold constants.
     * Decays on appearance and recovers each game day.
     */
    pitcherAvailability: { type: "number" },
    /** Number of starts this pitcher has accumulated in the season. */
    pitcherStartsThisSeason: { type: "number" },
  },
  required: [
    "id",
    "seasonId",
    "seasonTeamId",
    "playerId",
    "pitcherDaysRest",
    "pitcherAvailability",
    "pitcherStartsThisSeason",
  ],
  indexes: ["seasonId", "seasonTeamId"],
};

/** Collection config for the `seasonPlayerState` collection. No migration strategies at v0. */
export const seasonPlayerStateCollectionConfig = {
  schema: seasonPlayerStateSchema,
};
