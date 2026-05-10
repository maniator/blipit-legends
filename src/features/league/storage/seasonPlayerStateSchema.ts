/**
 * RxDB schema for the `seasonPlayerState` collection — tracks pitcher fatigue and availability
 * per player per season team. One doc per (season, seasonTeam, player) triple.
 * Primary key is composite `${seasonId}:${seasonTeamId}:${playerId}`.
 *
 * `seasonTeamId` is included in the PK as a forward-compatibility measure: in v2, the trade
 * engine allows a player to move between teams mid-season, creating two distinct docs for the
 * same player — one for each team they pitched on. In v1 (no trades) this case cannot arise,
 * but aligning the PK now avoids a breaking schema change when v2 ships.
 *
 * version: 0 (initial schema; no migration strategies needed)
 */
import type { RxJsonSchema } from "rxdb";

import type { SeasonPlayerStateRecord } from "./types";

const seasonPlayerStateSchema: RxJsonSchema<SeasonPlayerStateRecord> = {
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    /** Composite primary key: `${seasonId}:${seasonTeamId}:${playerId}` */
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
