/**
 * RxDB schema for the `seasons` collection — one doc per league season.
 * version: 0 (initial schema; no migration strategies needed)
 */
import type { RxJsonSchema } from "rxdb";

import type { SeasonRecord } from "./types";

const seasonsSchema: RxJsonSchema<SeasonRecord> = {
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 128 },
    name: { type: "string", maxLength: 256 },
    status: { type: "string", enum: ["active", "complete", "abandoned"], maxLength: 16 },
    /** Epoch ms timestamp when the season was created — indexed for sorting. */
    createdAt: {
      type: "number",
      minimum: 0,
      maximum: 9_999_999_999_999,
      multipleOf: 1,
    },
    completedAt: { type: ["number", "null"] },
    preset: { type: "string", enum: ["mini", "standard", "full"], maxLength: 16 },
    seasonLength: { type: "string", enum: ["sprint", "standard", "marathon"], maxLength: 16 },
    masterSeed: { type: "string", maxLength: 64 },
    /** Array of league sub-divisions within this season. */
    leagues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          teamIds: { type: "array", items: { type: "string" } },
          dhEnabled: { type: "boolean" },
        },
        required: ["id", "name", "teamIds", "dhEnabled"],
      },
    },
    tradeDeadlineGameDay: { type: ["number", "null"] },
    playoffFormat: { type: ["string", "null"], maxLength: 16 },
    featureFlags: { type: "object", additionalProperties: true },
    /** 0-based index of the current game day in the schedule. */
    currentGameDay: { type: "number" },
    championTeamId: { type: ["string", "null"], maxLength: 128 },
    /** Monotonic version number of the ruleset used for this season. */
    rulesetVersion: { type: "number" },
  },
  required: [
    "id",
    "name",
    "status",
    "createdAt",
    "masterSeed",
    "preset",
    "seasonLength",
    "leagues",
    "currentGameDay",
    "rulesetVersion",
  ],
  indexes: ["status", "createdAt"],
};

/** Collection config for the `seasons` collection. No migration strategies at v0. */
export const seasonsCollectionConfig = {
  schema: seasonsSchema,
};
