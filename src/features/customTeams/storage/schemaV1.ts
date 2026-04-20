/**
 * v1 clean schemas for the `teams` and `players` collections.
 *
 * These replace the legacy hybrid schemas as part of the beta storage reset.
 * version is 0 and there are NO migration strategies — the epoch-based reset
 * in db.ts wipes the old ballgame IndexedDB before these schemas are applied,
 * so no migrations are needed.
 */
import type { RxJsonSchema } from "rxdb";

import type { PlayerRecord, TeamRecord } from "./types";

/** Sentinel teamId for players not assigned to any user team (free agents). */
export const FREE_AGENT_TEAM_ID = "team_free_agents";

const teamsSchemaV1: RxJsonSchema<TeamRecord> = {
  version: 1,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 128 },
    schemaVersion: { type: "number", minimum: 0, maximum: 999, multipleOf: 1 },
    createdAt: { type: "string", maxLength: 32 },
    updatedAt: { type: "string", maxLength: 32 },
    name: { type: "string", maxLength: 256 },
    /** Normalized lowercase name — indexed for O(1) name-dedup lookup. */
    nameLowercase: { type: "string", maxLength: 256 },
    abbreviation: { type: "string", maxLength: 8 },
    nickname: { type: "string", maxLength: 256 },
    city: { type: "string", maxLength: 256 },
    slug: { type: "string", maxLength: 256 },
    metadata: { type: "object", additionalProperties: true },
    statsProfile: { type: "string", maxLength: 64 },
    /**
     * FNV-1a content fingerprint (hex) — used only for duplicate detection on import.
     * NOT the primary identity key; `id` remains the primary key.
     */
    fingerprint: { type: "string", maxLength: 16 },
    activeLeagueId: { type: "string", maxLength: 128 },
  },
  required: ["id", "schemaVersion", "createdAt", "updatedAt", "name", "nameLowercase", "metadata"],
  indexes: ["updatedAt", "nameLowercase"],
};

/** v1 collection config for the `teams` collection. Includes v0→v1 migration. */
export const teamsV1CollectionConfig = {
  schema: teamsSchemaV1,
  migrationStrategies: {
    1: (oldDoc: Record<string, unknown>) => ({
      ...oldDoc,
      activeLeagueId: undefined,
    }),
  },
};

const playersSchemaV1: RxJsonSchema<PlayerRecord> = {
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    /**
     * Stable global player ID — the player's cross-team identity.
     * NOT team-scoped or composite. This IS the globalPlayerId.
     */
    id: { type: "string", maxLength: 128 },
    teamId: { type: "string", maxLength: 128 },
    section: { type: "string", enum: ["lineup", "bench", "pitchers"], maxLength: 16 },
    orderIndex: { type: "number", minimum: 0, maximum: 9999, multipleOf: 1 },
    name: { type: "string" },
    role: { type: "string" },
    batting: { type: "object", additionalProperties: true },
    pitching: { type: "object", additionalProperties: true },
    position: { type: "string" },
    handedness: { type: "string" },
    isBenchEligible: { type: "boolean" },
    isPitcherEligible: { type: "boolean" },
    jerseyNumber: { type: ["number", "null"] },
    pitchingRole: { type: "string" },
    /**
     * Persistent FNV-1a content fingerprint stored in the DB.
     * Covers the player's immutable identity fields: name, role, batting, pitching.
     */
    fingerprint: { type: "string", maxLength: 16 },
    createdAt: { type: "string", maxLength: 32 },
    updatedAt: { type: "string", maxLength: 32 },
    schemaVersion: { type: "number", minimum: 0, maximum: 999, multipleOf: 1 },
  },
  required: [
    "id",
    "teamId",
    "section",
    "orderIndex",
    "name",
    "role",
    "createdAt",
    "updatedAt",
    "schemaVersion",
  ],
  // teamId is always non-null; free agents use FREE_AGENT_TEAM_ID sentinel so it can be indexed.
  indexes: ["teamId"],
};

/** v1 collection config for the `players` collection. No migration strategies. */
export const playersV1CollectionConfig = {
  schema: playersSchemaV1,
};
