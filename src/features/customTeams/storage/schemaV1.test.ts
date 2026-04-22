/**
 * Schema upgrade-path test for the `teams` collection: v0 → v1.
 *
 * Opens a DB with the v0 schema (no activeLeagueIds / autogen fields),
 * inserts a legacy-shaped doc, then reopens with the v1 schema and
 * migration strategy, and asserts all original fields survive.
 */
import "fake-indexeddb/auto";

import type { RxJsonSchema } from "rxdb";
import { createRxDatabase } from "rxdb";
import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { TeamRecord } from "./types";

// ── v0 schema (no activeLeagueIds / autogen) ─────────────────────────────────
const teamsSchemaV0: RxJsonSchema<
  Omit<TeamRecord, "activeLeagueIds" | "autogen">
> = {
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
    nickname: { type: "string", maxLength: 256 },
    city: { type: "string", maxLength: 256 },
    slug: { type: "string", maxLength: 256 },
    metadata: { type: "object", additionalProperties: true },
    statsProfile: { type: "string", maxLength: 64 },
    fingerprint: { type: "string", maxLength: 16 },
  },
  required: ["id", "schemaVersion", "createdAt", "updatedAt", "name", "nameLowercase", "metadata"],
  indexes: ["updatedAt", "nameLowercase"],
};

// ── v1 schema (with activeLeagueIds + autogen, migration strategy) ───────────
import { teamsV1CollectionConfig } from "./schemaV1";

const DB_NAME_BASE = "test_teams_migration";

describe("teams schema migration: v0 → v1", () => {
  it("all original v0 fields survive after migration to v1", async () => {
    const storage = getRxStorageMemory();
    const dbName = `${DB_NAME_BASE}_${Math.random().toString(36).slice(2, 10)}`;

    // ── Phase 1: create DB with v0 schema and insert a legacy doc ──────────
    const dbV0 = await createRxDatabase({
      name: dbName,
      storage,
      multiInstance: false,
    });
    await dbV0.addCollections({ teams: { schema: teamsSchemaV0 } });

    const legacyDoc = {
      id: "ct_legacy001",
      schemaVersion: 0,
      createdAt: "2024-01-15T10:00:00.000Z",
      updatedAt: "2024-01-15T10:00:00.000Z",
      name: "Legacy Team",
      nameLowercase: "legacy team",
      abbreviation: "LEG",
      nickname: "Legends",
      city: "Springfield",
      metadata: { notes: "old team" },
    };
    await dbV0.teams.insert(legacyDoc);
    await dbV0.close();

    // ── Phase 2: reopen with v1 schema + migration strategy ────────────────
    const dbV1 = await createRxDatabase({
      name: dbName,
      storage,
      multiInstance: false,
    });
    await dbV1.addCollections({ teams: teamsV1CollectionConfig });

    const migrated = await dbV1.teams.findOne("ct_legacy001").exec();
    expect(migrated).not.toBeNull();

    const doc = migrated!.toJSON() as unknown as TeamRecord;

    // All original fields must survive.
    expect(doc.id).toBe("ct_legacy001");
    expect(doc.schemaVersion).toBe(0);
    expect(doc.createdAt).toBe("2024-01-15T10:00:00.000Z");
    expect(doc.updatedAt).toBe("2024-01-15T10:00:00.000Z");
    expect(doc.name).toBe("Legacy Team");
    expect(doc.nameLowercase).toBe("legacy team");
    expect(doc.abbreviation).toBe("LEG");
    expect(doc.nickname).toBe("Legends");
    expect(doc.city).toBe("Springfield");
    expect(doc.metadata).toEqual({ notes: "old team" });

    // New optional fields are absent (undefined) — not injected by migration.
    expect(doc.activeLeagueIds).toBeUndefined();
    expect(doc.autogen).toBeUndefined();

    await dbV1.close();
  });

  it("v1 docs can store activeLeagueIds and autogen", async () => {
    const storage = getRxStorageMemory();
    const dbName = `${DB_NAME_BASE}_new_${Math.random().toString(36).slice(2, 10)}`;

    const db = await createRxDatabase({
      name: dbName,
      storage,
      multiInstance: false,
    });
    await db.addCollections({ teams: teamsV1CollectionConfig });

    await db.teams.insert({
      id: "ct_new001",
      schemaVersion: 1,
      createdAt: "2024-06-01T00:00:00.000Z",
      updatedAt: "2024-06-01T00:00:00.000Z",
      name: "New Team",
      nameLowercase: "new team",
      metadata: {},
      activeLeagueIds: ["league_abc", "league_def"],
      autogen: { version: 1, theme: "powerhouse", paritySeed: "seed123" },
    });

    const doc = (await db.teams.findOne("ct_new001").exec())!.toJSON() as unknown as TeamRecord;
    expect(doc.activeLeagueIds).toEqual(["league_abc", "league_def"]);
    expect(doc.autogen).toEqual({ version: 1, theme: "powerhouse", paritySeed: "seed123" });

    await db.close();
  });
});
