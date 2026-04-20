/**
 * Migration tests for league-mode schema changes.
 *
 * Tests that v0→v1 migrations on `completedGames` and `teams` collections
 * run without error and preserve existing document data.
 */
import "fake-indexeddb/auto";

import { addRxPlugin, createRxDatabase } from "rxdb";
import { RxDBMigrationSchemaPlugin } from "rxdb/plugins/migration-schema";
import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { afterEach, describe, expect, it } from "vitest";

addRxPlugin(RxDBMigrationSchemaPlugin);

// ── helpers ───────────────────────────────────────────────────────────────────

const makeDbName = () => `test_migration_${Math.random().toString(36).slice(2, 14)}`;

// ── completedGames v0 → v1 ───────────────────────────────────────────────────

describe("completedGames schema migration: v0 → v1", () => {
  const dbName = makeDbName();
  const storage = getRxStorageMemory();

  afterEach(async () => {
    // Nothing to close — memory storage is per-instance
  });

  it("migrates a v0 completedGames doc to v1 without error", async () => {
    // Step 1: Create DB at v0 (no leagueSeasonId / scheduledGameId)
    const dbV0 = await createRxDatabase({
      name: dbName,
      storage,
      multiInstance: false,
    });
    await dbV0.addCollections({
      completedGames: {
        schema: {
          version: 0,
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
        },
      },
    });

    // Insert a v0 doc (no leagueSeasonId / scheduledGameId fields)
    await dbV0.collections.completedGames.insert({
      id: "game_test_001",
      playedAt: 1_700_000_000_000,
      seed: "abc123",
      rngState: 42,
      homeTeamId: "ct_home",
      awayTeamId: "ct_away",
      homeScore: 3,
      awayScore: 1,
      innings: 9,
      schemaVersion: 0,
    });

    await dbV0.close();

    // Step 2: Reopen with v1 schema + migration strategy
    const dbV1 = await createRxDatabase({
      name: dbName,
      storage,
      multiInstance: false,
    });
    await dbV1.addCollections({
      completedGames: {
        schema: {
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
        },
        migrationStrategies: {
          1: (oldDoc: Record<string, unknown>) => ({
            ...oldDoc,
            leagueSeasonId: undefined,
            scheduledGameId: undefined,
          }),
        },
      },
    });

    // Step 3: Verify the doc survived migration
    const doc = await dbV1.collections.completedGames.findOne("game_test_001").exec();
    expect(doc).not.toBeNull();
    expect(doc?.id).toBe("game_test_001");
    expect(doc?.homeScore).toBe(3);
    expect(doc?.awayScore).toBe(1);
    // leagueSeasonId and scheduledGameId should be absent or undefined (optional fields)
    const json = doc?.toJSON() as Record<string, unknown>;
    expect(json["leagueSeasonId"] === undefined || json["leagueSeasonId"] === null).toBe(true);

    await dbV1.close();
  });
});

// ── teams v0 → v1 ─────────────────────────────────────────────────────────────

describe("teams schema migration: v0 → v1", () => {
  const dbName = makeDbName();
  const storage = getRxStorageMemory();

  it("migrates a v0 teams doc to v1 without error", async () => {
    // Step 1: Create DB at v0 (no activeLeagueId)
    const dbV0 = await createRxDatabase({
      name: dbName,
      storage,
      multiInstance: false,
    });
    await dbV0.addCollections({
      teams: {
        schema: {
          version: 0,
          primaryKey: "id",
          type: "object",
          properties: {
            id: { type: "string", maxLength: 128 },
            schemaVersion: { type: "number", minimum: 0, maximum: 999, multipleOf: 1 },
            createdAt: { type: "string", maxLength: 32 },
            updatedAt: { type: "string", maxLength: 32 },
            name: { type: "string", maxLength: 256 },
            nameLowercase: { type: "string", maxLength: 256 },
            abbreviation: { type: "string", maxLength: 8 },
            metadata: { type: "object", additionalProperties: true },
          },
          required: [
            "id",
            "schemaVersion",
            "createdAt",
            "updatedAt",
            "name",
            "nameLowercase",
            "metadata",
          ],
          indexes: ["updatedAt", "nameLowercase"],
        },
      },
    });

    // Insert a v0 team doc
    await dbV0.collections.teams.insert({
      id: "ct_test_team_001",
      schemaVersion: 0,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      name: "Test Rockets",
      nameLowercase: "test rockets",
      metadata: {},
    });

    await dbV0.close();

    // Step 2: Reopen with v1 schema + migration strategy
    const dbV1 = await createRxDatabase({
      name: dbName,
      storage,
      multiInstance: false,
    });
    await dbV1.addCollections({
      teams: {
        schema: {
          version: 1,
          primaryKey: "id",
          type: "object",
          properties: {
            id: { type: "string", maxLength: 128 },
            schemaVersion: { type: "number", minimum: 0, maximum: 999, multipleOf: 1 },
            createdAt: { type: "string", maxLength: 32 },
            updatedAt: { type: "string", maxLength: 32 },
            name: { type: "string", maxLength: 256 },
            nameLowercase: { type: "string", maxLength: 256 },
            abbreviation: { type: "string", maxLength: 8 },
            metadata: { type: "object", additionalProperties: true },
            activeLeagueId: { type: "string", maxLength: 128 },
          },
          required: [
            "id",
            "schemaVersion",
            "createdAt",
            "updatedAt",
            "name",
            "nameLowercase",
            "metadata",
          ],
          indexes: ["updatedAt", "nameLowercase"],
        },
        migrationStrategies: {
          1: (oldDoc: Record<string, unknown>) => ({
            ...oldDoc,
            activeLeagueId: undefined,
          }),
        },
      },
    });

    // Step 3: Verify the doc survived migration
    const doc = await dbV1.collections.teams.findOne("ct_test_team_001").exec();
    expect(doc).not.toBeNull();
    expect(doc?.name).toBe("Test Rockets");
    expect(doc?.nameLowercase).toBe("test rockets");
    // activeLeagueId should be absent or undefined (optional field)
    const json = doc?.toJSON() as Record<string, unknown>;
    expect(json["activeLeagueId"] === undefined || json["activeLeagueId"] === null).toBe(true);

    await dbV1.close();
  });
});
