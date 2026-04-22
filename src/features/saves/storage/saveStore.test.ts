import { makeSaveStore } from "@feat/saves/storage/saveStore";
import { Hit } from "@shared/constants/hitTypes";
import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BallgameDb } from "@storage/db";
import { fnv1a } from "@storage/hash";
import type { GameSetup } from "@storage/types";
import { createTestDb } from "@test/helpers/db";
import { makeState } from "@test/testHelpers";

const makeSetup = (overrides: Partial<GameSetup> = {}): GameSetup => ({
  homeTeamId: "Yankees",
  awayTeamId: "Mets",
  seed: "abc123",
  setup: {
    strategy: "balanced",
    managedTeam: null,
    managerMode: false,
    homeTeam: "Yankees",
    awayTeam: "Mets",
  },
  ...overrides,
});

/** Custom-format setup used by round-trip tests that call importRxdbSave. */
const makeCustomFormatSetup = (overrides: Partial<GameSetup> = {}): GameSetup => ({
  homeTeamId: "ct_rt_home",
  awayTeamId: "ct_rt_away",
  seed: "abc123",
  setup: {
    strategy: "balanced",
    managedTeam: null,
    managerMode: false,
    homeTeam: "ct_rt_home",
    awayTeam: "ct_rt_away",
  },
  ...overrides,
});

/** Inserts a minimal TeamRecord into the given DB instance. */
async function insertMinimalTeam(targetDb: BallgameDb, id: string): Promise<void> {
  await targetDb.teams.insert({
    id,
    schemaVersion: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    name: "Test Team",
    nameLowercase: "test team",
    metadata: { archived: false },
  });
}

let db: BallgameDb;
let store: ReturnType<typeof makeSaveStore>;

beforeEach(async () => {
  db = await createTestDb(getRxStorageMemory());
  store = makeSaveStore(() => Promise.resolve(db));
});

afterEach(async () => {
  await db.close();
});

describe("SaveStore.createSave", () => {
  it("returns a string saveId", async () => {
    const id = await store.createSave(makeSetup());
    expect(typeof id).toBe("string");
    expect(id).toBeTruthy();
  });

  it("persists a save header document", async () => {
    const id = await store.createSave(makeSetup({ homeTeamId: "Cubs", awayTeamId: "Sox" }));
    const doc = await db.saves.findOne(id).exec();
    expect(doc?.homeTeamId).toBe("Cubs");
    expect(doc?.awayTeamId).toBe("Sox");
    expect(doc?.progressIdx).toBe(-1);
    expect(doc?.schemaVersion).toBe(1);
  });

  it("uses provided name when given", async () => {
    const id = await store.createSave(makeSetup(), { name: "My Custom Game" });
    const doc = await db.saves.findOne(id).exec();
    expect(doc?.name).toBe("My Custom Game");
  });

  it("auto-generates a name from team ids when no name given", async () => {
    const id = await store.createSave(makeSetup({ homeTeamId: "Dodgers", awayTeamId: "Giants" }));
    const doc = await db.saves.findOne(id).exec();
    expect(doc?.name).toContain("Dodgers");
    expect(doc?.name).toContain("Giants");
  });

  it("stores seed", async () => {
    const id = await store.createSave(makeSetup({ seed: "xyz" }));
    const doc = await db.saves.findOne(id).exec();
    expect(doc?.seed).toBe("xyz");
  });

  it("enforces max-3-saves rule by evicting the oldest save", async () => {
    const id1 = await store.createSave(makeSetup({ homeTeamId: "A" }));
    await new Promise((r) => setTimeout(r, 5));
    const id2 = await store.createSave(makeSetup({ homeTeamId: "B" }));
    await new Promise((r) => setTimeout(r, 5));
    const id3 = await store.createSave(makeSetup({ homeTeamId: "C" }));
    await new Promise((r) => setTimeout(r, 5));

    // All three fit under the limit; no eviction yet.
    let saves = await store.listSaves();
    expect(saves).toHaveLength(3);

    // Adding a 4th should evict id1 (oldest by updatedAt).
    const id4 = await store.createSave(makeSetup({ homeTeamId: "D" }));
    saves = await store.listSaves();
    expect(saves).toHaveLength(3);
    const ids = saves.map((s) => s.id);
    expect(ids).not.toContain(id1);
    expect(ids).toContain(id2);
    expect(ids).toContain(id3);
    expect(ids).toContain(id4);
  });
});

describe("SaveStore.appendEvents", () => {
  it("inserts events with deterministic ids", async () => {
    const saveId = await store.createSave(makeSetup());
    await store.appendEvents(saveId, [
      { type: "pitch", at: 0, payload: { result: "strike" } },
      { type: "pitch", at: 1, payload: { result: "ball" } },
    ]);
    const ev0 = await db.events.findOne(`${saveId}:0`).exec();
    const ev1 = await db.events.findOne(`${saveId}:1`).exec();
    expect(ev0?.type).toBe("pitch");
    expect(ev0?.idx).toBe(0);
    expect(ev1?.idx).toBe(1);
  });

  it("appends events after existing ones (increments idx)", async () => {
    const saveId = await store.createSave(makeSetup());
    await store.appendEvents(saveId, [{ type: "a", at: 0, payload: {} }]);
    await store.appendEvents(saveId, [{ type: "b", at: 1, payload: {} }]);
    const ev1 = await db.events.findOne(`${saveId}:1`).exec();
    expect(ev1?.type).toBe("b");
    expect(ev1?.idx).toBe(1);
  });

  it("is a no-op for empty array", async () => {
    const saveId = await store.createSave(makeSetup());
    await expect(store.appendEvents(saveId, [])).resolves.toBeUndefined();
    const count = await db.events.count({ selector: { saveId } }).exec();
    expect(count).toBe(0);
  });

  it("stores at, payload, and schemaVersion on each event", async () => {
    const saveId = await store.createSave(makeSetup());
    await store.appendEvents(saveId, [{ type: "hit", at: 42, payload: { kind: "single" } }]);
    const ev = await db.events.findOne(`${saveId}:0`).exec();
    expect(ev?.at).toBe(42);
    expect(ev?.payload).toEqual({ kind: "single" });
    expect(ev?.schemaVersion).toBe(1);
  });

  it("bulk-inserts multiple events in one call", async () => {
    const saveId = await store.createSave(makeSetup());
    const batch = Array.from({ length: 10 }, (_, i) => ({
      type: "pitch",
      at: i,
      payload: { i },
    }));
    await store.appendEvents(saveId, batch);
    const count = await db.events.count({ selector: { saveId } }).exec();
    expect(count).toBe(10);
  });

  it("serializes concurrent appends — no index collisions", async () => {
    const saveId = await store.createSave(makeSetup());
    // Fire two appends concurrently without awaiting the first.
    const p1 = store.appendEvents(saveId, [
      { type: "a", at: 0, payload: {} },
      { type: "b", at: 0, payload: {} },
    ]);
    const p2 = store.appendEvents(saveId, [
      { type: "c", at: 1, payload: {} },
      { type: "d", at: 1, payload: {} },
    ]);
    await Promise.all([p1, p2]);
    const count = await db.events.count({ selector: { saveId } }).exec();
    // All 4 events must be stored with unique indices 0–3.
    expect(count).toBe(4);
    for (let i = 0; i < 4; i++) {
      const ev = await db.events.findOne(`${saveId}:${i}`).exec();
      expect(ev).not.toBeNull();
    }
  });
});

describe("SaveStore.updateProgress", () => {
  it("updates progressIdx and updatedAt", async () => {
    const saveId = await store.createSave(makeSetup());
    const before = Date.now();
    await store.updateProgress(saveId, 5);
    const doc = await db.saves.findOne(saveId).exec();
    expect(doc?.progressIdx).toBe(5);
    expect(doc?.updatedAt).toBeGreaterThanOrEqual(before);
  });

  it("stores scoreSnapshot when provided", async () => {
    const saveId = await store.createSave(makeSetup());
    await store.updateProgress(saveId, 3, {
      scoreSnapshot: { home: 2, away: 1 },
    });
    const doc = await db.saves.findOne(saveId).exec();
    expect(doc?.scoreSnapshot).toEqual({ home: 2, away: 1 });
  });

  it("stores inningSnapshot when provided", async () => {
    const saveId = await store.createSave(makeSetup());
    await store.updateProgress(saveId, 3, {
      inningSnapshot: { inning: 4, atBat: 1 },
    });
    const doc = await db.saves.findOne(saveId).exec();
    expect(doc?.inningSnapshot).toEqual({ inning: 4, atBat: 1 });
  });

  it("stores stateSnapshot when provided", async () => {
    const saveId = await store.createSave(makeSetup());
    await store.updateProgress(saveId, 5, {
      stateSnapshot: { state: makeState({ inning: 3 }), rngState: 99 },
    });
    const doc = await db.saves.findOne(saveId).exec();
    expect(doc?.stateSnapshot?.state.inning).toBe(3);
    expect(doc?.stateSnapshot?.rngState).toBe(99);
  });

  it("stores refreshed setup when provided (overwrite path persists decisionValues / strategy / managerMode)", async () => {
    const saveId = await store.createSave(makeSetup());
    const refreshedSetup = {
      strategy: "aggressive" as const,
      managedTeam: 0 as const,
      managerMode: true,
      homeTeam: "Yankees",
      awayTeam: "Mets",
      decisionValues: {
        stealMinOfferPct: 80,
        aiStealThreshold: 70,
        stealEnabled: true,
        buntEnabled: false,
        ibbEnabled: true,
        pinchHitterEnabled: true,
        defensiveShiftEnabled: true,
        aiPitchingChangeAggressiveness: 90,
      },
    };
    await store.updateProgress(saveId, 7, { setup: refreshedSetup });
    const doc = await db.saves.findOne(saveId).exec();
    expect(doc?.setup).toEqual(refreshedSetup);
    expect(doc?.progressIdx).toBe(7);
  });

  it("silently resolves for an unknown saveId (save deleted between game start and game over)", async () => {
    await expect(store.updateProgress("nonexistent", 0)).resolves.toBeUndefined();
  });
});

describe("SaveStore.deleteSave", () => {
  it("removes the save header", async () => {
    const saveId = await store.createSave(makeSetup());
    await store.deleteSave(saveId);
    const doc = await db.saves.findOne(saveId).exec();
    expect(doc).toBeNull();
  });

  it("removes all associated events", async () => {
    const saveId = await store.createSave(makeSetup());
    await store.appendEvents(saveId, [
      { type: "hit", at: 0, payload: {} },
      { type: "strike", at: 1, payload: {} },
    ]);
    await store.deleteSave(saveId);
    const events = await db.events.find({ selector: { saveId } }).exec();
    expect(events).toHaveLength(0);
  });

  it("is a no-op for an unknown saveId (does not throw)", async () => {
    await expect(store.deleteSave("nonexistent")).resolves.toBeUndefined();
  });
});

describe("SaveStore.listSaves", () => {
  it("returns an empty array when no saves exist", async () => {
    const saves = await store.listSaves();
    expect(saves).toEqual([]);
  });

  it("returns all created saves", async () => {
    await store.createSave(makeSetup({ homeTeamId: "A", awayTeamId: "B" }));
    await store.createSave(makeSetup({ homeTeamId: "C", awayTeamId: "D" }));
    const saves = await store.listSaves();
    expect(saves).toHaveLength(2);
  });

  it("returns saves ordered by updatedAt descending", async () => {
    const id1 = await store.createSave(makeSetup());
    await store.updateProgress(id1, 10);
    // Brief pause so id2's updatedAt is strictly later
    await new Promise((r) => setTimeout(r, 5));
    const id2 = await store.createSave(makeSetup());
    await store.updateProgress(id2, 20);
    const saves = await store.listSaves();
    expect(saves[0].id).toBe(id2);
  });

  it("returned docs include required fields", async () => {
    await store.createSave(makeSetup({ seed: "s1" }));
    const [doc] = await store.listSaves();
    expect(doc.seed).toBe("s1");
    expect(typeof doc.createdAt).toBe("number");
    expect(typeof doc.updatedAt).toBe("number");
    expect(doc.schemaVersion).toBe(1);
  });
});

describe("SaveStore.exportRxdbSave / importRxdbSave", () => {
  it("exportRxdbSave produces valid JSON with version, header, events, sig", async () => {
    const saveId = await store.createSave(makeSetup());
    await store.appendEvents(saveId, [
      { type: "hit", at: 1, payload: { hitType: "single" } },
      { type: "strike", at: 2, payload: { swung: true } },
    ]);
    const json = await store.exportRxdbSave(saveId);
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(1);
    expect(parsed.header.id).toBe(saveId);
    expect(parsed.events).toHaveLength(2);
    expect(typeof parsed.sig).toBe("string");
    expect(parsed.sig).toHaveLength(8);
  });

  it("exportRxdbSave throws for unknown saveId", async () => {
    await expect(store.exportRxdbSave("nonexistent")).rejects.toThrow("Save not found");
  });

  it("importRxdbSave round-trips export/import correctly", async () => {
    const saveId = await store.createSave(makeCustomFormatSetup({ seed: "roundtrip" }));
    await store.appendEvents(saveId, [{ type: "hit", at: 0, payload: {} }]);
    const json = await store.exportRxdbSave(saveId);
    // Import into a fresh db
    await db.close(); // close primary DB before opening db2 (stays within OSS 16-collection limit)
    const db2 = await createTestDb(getRxStorageMemory());
    // Insert the teams so importRxdbSave does not reject them as missing.
    await insertMinimalTeam(db2, "ct_rt_home");
    await insertMinimalTeam(db2, "ct_rt_away");
    const store2 = (await import("@feat/saves/storage/saveStore")).makeSaveStore(() =>
      Promise.resolve(db2),
    );
    const restoredSave = await store2.importRxdbSave(json);
    expect(restoredSave.id).toBe(saveId);
    const saves = await store2.listSaves();
    expect(saves).toHaveLength(1);
    expect(saves[0].seed).toBe("roundtrip");
    const events = await db2.events.find({ selector: { saveId } }).exec();
    expect(events).toHaveLength(1);
    await db2.close();
  });

  it("importRxdbSave throws on invalid JSON", async () => {
    await expect(store.importRxdbSave("not json")).rejects.toThrow("Invalid JSON");
  });

  it("importRxdbSave rejects empty object with a clean error (no undefined/null/NaN)", async () => {
    const err = await store.importRxdbSave("{}").catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).not.toMatch(/undefined|null|NaN/);
    expect((err as Error).message).toContain("Invalid");
    expect((err as Error).message).toContain("format");
  });

  it("importRxdbSave throws on unsupported version", async () => {
    const saveId = await store.createSave(makeSetup());
    const json = await store.exportRxdbSave(saveId);
    const envelope = JSON.parse(json);
    envelope.version = 99;
    await expect(store.importRxdbSave(JSON.stringify(envelope))).rejects.toThrow(
      "Unsupported save version",
    );
  });

  it("importRxdbSave throws on signature mismatch (tampered file)", async () => {
    const saveId = await store.createSave(makeSetup({ homeTeamId: "Original" }));
    const json = await store.exportRxdbSave(saveId);
    const envelope = JSON.parse(json);
    envelope.header.homeTeamId = "Tampered";
    await expect(store.importRxdbSave(JSON.stringify(envelope))).rejects.toThrow(
      "signature mismatch",
    );
  });

  it("importRxdbSave handles saves with no events", async () => {
    const saveId = await store.createSave(makeCustomFormatSetup());
    const json = await store.exportRxdbSave(saveId);
    await db.close(); // close primary DB before opening db2 (stays within OSS 16-collection limit)
    const db2 = await createTestDb(getRxStorageMemory());
    await insertMinimalTeam(db2, "ct_rt_home");
    await insertMinimalTeam(db2, "ct_rt_away");
    const store2 = (await import("@feat/saves/storage/saveStore")).makeSaveStore(() =>
      Promise.resolve(db2),
    );
    const restoredSave = await store2.importRxdbSave(json);
    expect(restoredSave.id).toBe(saveId);
    await db2.close();
  });

  it("importRxdbSave preserves ct_* team IDs unchanged (v1 canonical format)", async () => {
    // In v1, ct_* is the canonical format — IDs are preserved as-is without any prefix normalization.
    const RXDB_EXPORT_KEY_LOCAL = "ballgame:rxdb:v1";
    const header: Record<string, unknown> = {
      id: "test-norm-save-id",
      name: "ct_norm_away vs ct_norm_home",
      seed: "abc",
      homeTeamId: "ct_norm_home",
      awayTeamId: "ct_norm_away",
      createdAt: 0,
      updatedAt: 0,
      progressIdx: -1,
      schemaVersion: 1,
      setup: {
        strategy: "balanced",
        managedTeam: null,
        managerMode: false,
        homeTeam: "ct_norm_home",
        awayTeam: "ct_norm_away",
      },
    };
    const events: unknown[] = [];
    const sig = fnv1a(RXDB_EXPORT_KEY_LOCAL + JSON.stringify({ header, events }));
    const bundle = JSON.stringify({ version: 1, header, events, sig });

    await db.close(); // close primary DB before opening db2 (stays within OSS 16-collection limit)
    const db2 = await createTestDb(getRxStorageMemory());
    await insertMinimalTeam(db2, "ct_norm_home");
    await insertMinimalTeam(db2, "ct_norm_away");
    const store2 = (await import("@feat/saves/storage/saveStore")).makeSaveStore(() =>
      Promise.resolve(db2),
    );
    const restored = await store2.importRxdbSave(bundle);

    // ct_* IDs are the canonical v1 format — preserved as-is.
    expect(restored.homeTeamId).toBe("ct_norm_home");
    expect(restored.awayTeamId).toBe("ct_norm_away");
    expect(restored.setup.homeTeam).toBe("ct_norm_home");
    expect(restored.setup.awayTeam).toBe("ct_norm_away");
    await db2.close();
  });

  it("importRxdbSave preserves v1 ct_* team IDs on round-trip", async () => {
    // Verify that ct_* IDs round-trip cleanly through export/import.
    const saveId = await store.createSave(makeCustomFormatSetup({ seed: "roundtrip2" }));
    await insertMinimalTeam(db, "ct_rt_home");
    await insertMinimalTeam(db, "ct_rt_away");
    const json = await store.exportRxdbSave(saveId);

    await db.close(); // close primary DB before opening db2 (stays within OSS 16-collection limit)
    const db2 = await createTestDb(getRxStorageMemory());
    await insertMinimalTeam(db2, "ct_rt_home");
    await insertMinimalTeam(db2, "ct_rt_away");
    const store2 = (await import("@feat/saves/storage/saveStore")).makeSaveStore(() =>
      Promise.resolve(db2),
    );
    const restored = await store2.importRxdbSave(json);
    expect(restored.homeTeamId).toBe("ct_rt_home");
    expect(restored.awayTeamId).toBe("ct_rt_away");
    await db2.close();
  });
});

describe("SaveStore.appendEvents — counter initialisation from existing events", () => {
  it("fresh store instance picks up existing event idx from DB and continues from there", async () => {
    // First store writes two events with idx 0 and 1.
    const saveId = await store.createSave(makeSetup());
    await store.appendEvents(saveId, [
      { type: "pitch", at: 0, payload: {} },
      { type: "pitch", at: 1, payload: {} },
    ]);

    // Create a fresh store instance pointing at the same DB.
    // Its nextIdxMap is empty, so the first appendEvents call must
    // query the DB to find the highest existing idx (1) and continue from 2.
    const freshStore = makeSaveStore(() => Promise.resolve(db));
    await freshStore.appendEvents(saveId, [{ type: "hit", at: 2, payload: { runs: 1 } }]);

    // All three events should now exist with correct sequential ids.
    const events = await db.events.find({ selector: { saveId }, sort: [{ idx: "asc" }] }).exec();
    expect(events).toHaveLength(3);
    expect(events[2].id).toBe(`${saveId}:2`);
    expect(events[2].type).toBe("hit");
    expect(events[2].idx).toBe(2);
  });

  it("fresh store with no existing events initializes counter at 0", async () => {
    const saveId = await store.createSave(makeSetup());

    // No events yet — fresh store should start at idx 0.
    const freshStore = makeSaveStore(() => Promise.resolve(db));
    await freshStore.appendEvents(saveId, [{ type: "pitch", at: 0, payload: {} }]);

    const events = await db.events.find({ selector: { saveId } }).exec();
    expect(events).toHaveLength(1);
    expect(events[0].idx).toBe(0);
  });
});

describe("SaveStore — sac-fly outLog entries in stateSnapshot export/import", () => {
  it("round-trips outLog entries with isSacFly and rbi through export/import", async () => {
    const saveId = await store.createSave(makeCustomFormatSetup({ seed: "sacflysave" }));
    const stateWithSacFly = makeState({
      outLog: [{ team: 0, batterNum: 2, playerId: "p2", isSacFly: true, rbi: 1 }],
    });
    await store.updateProgress(saveId, 6, {
      stateSnapshot: { state: stateWithSacFly, rngState: 42 },
    });
    const json = await store.exportRxdbSave(saveId);

    await db.close(); // close primary DB before opening db2 (stays within OSS 16-collection limit)
    const db2 = await createTestDb(getRxStorageMemory());
    await insertMinimalTeam(db2, "ct_rt_home");
    await insertMinimalTeam(db2, "ct_rt_away");
    const store2 = makeSaveStore(() => Promise.resolve(db2));
    await store2.importRxdbSave(json);
    const saves = await store2.listSaves();
    const outLog = saves[0].stateSnapshot?.state.outLog ?? [];
    expect(outLog).toHaveLength(1);
    expect(outLog[0].team).toBe(0);
    expect(outLog[0].batterNum).toBe(2);
    expect(outLog[0].isSacFly).toBe(true);
    expect(outLog[0].rbi).toBe(1);
    await db2.close();
  });

  it("round-trips outLog entries without isSacFly (legacy saves)", async () => {
    const saveId = await store.createSave(makeCustomFormatSetup({ seed: "legacyout" }));
    const legacyState = makeState({
      outLog: [{ team: 0, batterNum: 1, playerId: "p1" }],
    });
    await store.updateProgress(saveId, 2, {
      stateSnapshot: { state: legacyState, rngState: null },
    });
    const json = await store.exportRxdbSave(saveId);

    await db.close(); // close primary DB before opening db2 (stays within OSS 16-collection limit)
    const db2 = await createTestDb(getRxStorageMemory());
    await insertMinimalTeam(db2, "ct_rt_home");
    await insertMinimalTeam(db2, "ct_rt_away");
    const store2 = makeSaveStore(() => Promise.resolve(db2));
    await store2.importRxdbSave(json);
    const saves = await store2.listSaves();
    const outLog = saves[0].stateSnapshot?.state.outLog ?? [];
    expect(outLog).toHaveLength(1);
    expect(outLog[0].isSacFly).toBeUndefined();
    await db2.close();
  });
});

describe("SaveStore — RBI in stateSnapshot export/import compatibility", () => {
  it("round-trips a stateSnapshot containing playLog entries with rbi", async () => {
    const saveId = await store.createSave(makeCustomFormatSetup({ seed: "rbisave" }));
    const stateWithRbi = makeState({
      playLog: [
        {
          inning: 1,
          half: 0,
          batterNum: 1,
          playerId: "p1",
          team: 0,
          event: Hit.Single,
          runs: 1,
          rbi: 1,
        },
      ],
    });
    await store.updateProgress(saveId, 5, {
      stateSnapshot: { state: stateWithRbi, rngState: 42 },
    });
    const json = await store.exportRxdbSave(saveId);

    await db.close(); // close primary DB before opening db2 (stays within OSS 16-collection limit)
    const db2 = await createTestDb(getRxStorageMemory());
    await insertMinimalTeam(db2, "ct_rt_home");
    await insertMinimalTeam(db2, "ct_rt_away");
    const store2 = makeSaveStore(() => Promise.resolve(db2));
    await store2.importRxdbSave(json);
    const saves = await store2.listSaves();
    const playLog = saves[0].stateSnapshot?.state.playLog ?? [];
    expect(playLog).toHaveLength(1);
    expect(playLog[0].rbi).toBe(1);
    await db2.close();
  });

  it("round-trips a stateSnapshot containing playLog entries without rbi (older save)", async () => {
    const saveId = await store.createSave(makeCustomFormatSetup({ seed: "oldsave" }));
    const oldState = makeState({
      playLog: [
        // Simulate old data: no rbi field
        { inning: 1, half: 0, batterNum: 1, playerId: "p1", team: 0, event: Hit.Single, runs: 1 },
      ],
    });
    await store.updateProgress(saveId, 3, {
      stateSnapshot: { state: oldState, rngState: null },
    });
    const json = await store.exportRxdbSave(saveId);

    await db.close(); // close primary DB before opening db2 (stays within OSS 16-collection limit)
    const db2 = await createTestDb(getRxStorageMemory());
    await insertMinimalTeam(db2, "ct_rt_home");
    await insertMinimalTeam(db2, "ct_rt_away");
    const store2 = makeSaveStore(() => Promise.resolve(db2));
    await store2.importRxdbSave(json);
    const saves = await store2.listSaves();
    // The rbi field may be absent — import must not fail
    expect(saves[0].stateSnapshot?.state.playLog).toHaveLength(1);
    await db2.close();
  });
});

// ---------------------------------------------------------------------------
// SaveStore — manager decision state in stateSnapshot export/import
// ---------------------------------------------------------------------------

describe("SaveStore — manager decision state in stateSnapshot export/import", () => {
  it("round-trips pendingDecision defensive_shift through export/import", async () => {
    const saveId = await store.createSave(makeCustomFormatSetup({ seed: "decshift" }));
    const stateWithDecision = makeState({
      pendingDecision: { kind: "defensive_shift" },
      managerMode: true,
    } as Parameters<typeof makeState>[0]);
    await store.updateProgress(saveId, 7, {
      stateSnapshot: { state: stateWithDecision, rngState: 10 },
    });
    const json = await store.exportRxdbSave(saveId);

    await db.close(); // close primary DB before opening db2 (stays within OSS 16-collection limit)
    const db2 = await createTestDb(getRxStorageMemory());
    await insertMinimalTeam(db2, "ct_rt_home");
    await insertMinimalTeam(db2, "ct_rt_away");
    const store2 = makeSaveStore(() => Promise.resolve(db2));
    await store2.importRxdbSave(json);
    const saves = await store2.listSaves();
    expect(saves[0].stateSnapshot?.state.pendingDecision).toEqual({ kind: "defensive_shift" });
    await db2.close();
  });

  it("round-trips onePitchModifier through export/import", async () => {
    const saveId = await store.createSave(makeCustomFormatSetup({ seed: "onemod" }));
    const stateWithMod = makeState({ onePitchModifier: "swing" });
    await store.updateProgress(saveId, 3, {
      stateSnapshot: { state: stateWithMod, rngState: 5 },
    });
    const json = await store.exportRxdbSave(saveId);

    await db.close(); // close primary DB before opening db2 (stays within OSS 16-collection limit)
    const db2 = await createTestDb(getRxStorageMemory());
    await insertMinimalTeam(db2, "ct_rt_home");
    await insertMinimalTeam(db2, "ct_rt_away");
    const store2 = makeSaveStore(() => Promise.resolve(db2));
    await store2.importRxdbSave(json);
    const saves = await store2.listSaves();
    expect(saves[0].stateSnapshot?.state.onePitchModifier).toBe("swing");
    await db2.close();
  });

  it("round-trips pitcherBattersFaced (fatigue progress) through export/import", async () => {
    const saveId = await store.createSave(makeCustomFormatSetup({ seed: "fatigue" }));
    const stateWithFatigue = makeState({ pitcherBattersFaced: [15, 6] });
    await store.updateProgress(saveId, 9, {
      stateSnapshot: { state: stateWithFatigue, rngState: 20 },
    });
    const json = await store.exportRxdbSave(saveId);

    await db.close(); // close primary DB before opening db2 (stays within OSS 16-collection limit)
    const db2 = await createTestDb(getRxStorageMemory());
    await insertMinimalTeam(db2, "ct_rt_home");
    await insertMinimalTeam(db2, "ct_rt_away");
    const store2 = makeSaveStore(() => Promise.resolve(db2));
    await store2.importRxdbSave(json);
    const saves = await store2.listSaves();
    expect(saves[0].stateSnapshot?.state.pitcherBattersFaced).toEqual([15, 6]);
    await db2.close();
  });

  it("round-trips decisionLog through export/import", async () => {
    const saveId = await store.createSave(makeCustomFormatSetup({ seed: "declog" }));
    const stateWithLog = makeState({ decisionLog: ["AI: steal 2nd", "AI: bunt"] });
    await store.updateProgress(saveId, 4, {
      stateSnapshot: { state: stateWithLog, rngState: 1 },
    });
    const json = await store.exportRxdbSave(saveId);

    await db.close(); // close primary DB before opening db2 (stays within OSS 16-collection limit)
    const db2 = await createTestDb(getRxStorageMemory());
    await insertMinimalTeam(db2, "ct_rt_home");
    await insertMinimalTeam(db2, "ct_rt_away");
    const store2 = makeSaveStore(() => Promise.resolve(db2));
    await store2.importRxdbSave(json);
    const saves = await store2.listSaves();
    expect(saves[0].stateSnapshot?.state.decisionLog).toEqual(["AI: steal 2nd", "AI: bunt"]);
    await db2.close();
  });

  it("round-trips defensiveShift flag through export/import", async () => {
    const saveId = await store.createSave(makeCustomFormatSetup({ seed: "defshift" }));
    const stateWithShift = makeState({ defensiveShift: true, defensiveShiftOffered: true });
    await store.updateProgress(saveId, 5, {
      stateSnapshot: { state: stateWithShift, rngState: 3 },
    });
    const json = await store.exportRxdbSave(saveId);

    await db.close(); // close primary DB before opening db2 (stays within OSS 16-collection limit)
    const db2 = await createTestDb(getRxStorageMemory());
    await insertMinimalTeam(db2, "ct_rt_home");
    await insertMinimalTeam(db2, "ct_rt_away");
    const store2 = makeSaveStore(() => Promise.resolve(db2));
    await store2.importRxdbSave(json);
    const saves = await store2.listSaves();
    expect(saves[0].stateSnapshot?.state.defensiveShift).toBe(true);
    expect(saves[0].stateSnapshot?.state.defensiveShiftOffered).toBe(true);
    await db2.close();
  });
});

// ---------------------------------------------------------------------------
// SaveStore — event ordering and persistence invariants
// ---------------------------------------------------------------------------

describe("SaveStore — event idx monotonicity", () => {
  it("idx values are contiguous from 0 when events are appended in one call", async () => {
    const saveId = await store.createSave(makeSetup());
    await store.appendEvents(saveId, [
      { type: "a", at: 0, payload: {} },
      { type: "b", at: 1, payload: {} },
      { type: "c", at: 2, payload: {} },
    ]);
    const events = await db.events.find({ selector: { saveId }, sort: [{ idx: "asc" }] }).exec();
    expect(events).toHaveLength(3);
    for (let i = 0; i < events.length; i++) {
      expect(events[i].idx).toBe(i);
    }
  });

  it("idx continues monotonically across multiple sequential appends", async () => {
    const saveId = await store.createSave(makeSetup());
    await store.appendEvents(saveId, [{ type: "a", at: 0, payload: {} }]);
    await store.appendEvents(saveId, [{ type: "b", at: 1, payload: {} }]);
    await store.appendEvents(saveId, [{ type: "c", at: 2, payload: {} }]);
    const events = await db.events.find({ selector: { saveId }, sort: [{ idx: "asc" }] }).exec();
    expect(events).toHaveLength(3);
    expect(events.map((e) => e.idx)).toEqual([0, 1, 2]);
  });
});

describe("SaveStore — no duplicate event IDs", () => {
  it("event IDs are unique across multiple appends to the same save", async () => {
    const saveId = await store.createSave(makeSetup());
    await store.appendEvents(saveId, [{ type: "a", at: 0, payload: {} }]);
    await store.appendEvents(saveId, [{ type: "b", at: 1, payload: {} }]);
    await store.appendEvents(saveId, [{ type: "c", at: 2, payload: {} }]);
    const events = await db.events.find({ selector: { saveId } }).exec();
    const ids = events.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("event IDs for two different saves do not collide", async () => {
    const id1 = await store.createSave(makeSetup({ homeTeamId: "A" }));
    const id2 = await store.createSave(makeSetup({ homeTeamId: "B" }));
    await store.appendEvents(id1, [{ type: "x", at: 0, payload: {} }]);
    await store.appendEvents(id2, [{ type: "x", at: 0, payload: {} }]);
    const all = await db.events.find().exec();
    const ids = all.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("SaveStore — progressIdx bounds", () => {
  it("progressIdx after updateProgress does not exceed the highest event idx", async () => {
    const saveId = await store.createSave(makeSetup());
    await store.appendEvents(saveId, [
      { type: "a", at: 0, payload: {} },
      { type: "b", at: 1, payload: {} },
    ]);
    await store.updateProgress(saveId, 1);
    const doc = await db.saves.findOne(saveId).exec();
    const events = await db.events
      .find({ selector: { saveId }, sort: [{ idx: "desc" }], limit: 1 })
      .exec();
    const maxIdx = events[0]?.idx ?? -1;
    expect(doc?.progressIdx).toBeLessThanOrEqual(maxIdx);
  });

  it("progressIdx starts at -1 (not-started sentinel) after createSave", async () => {
    const saveId = await store.createSave(makeSetup());
    const doc = await db.saves.findOne(saveId).exec();
    expect(doc?.progressIdx).toBe(-1);
  });
});

describe("SaveStore — updatedAt advances on updateProgress", () => {
  it("updatedAt is strictly greater after each updateProgress call", async () => {
    const nowSpy = vi.spyOn(Date, "now");
    try {
      nowSpy.mockReturnValue(1_000);
      const saveId = await store.createSave(makeSetup());
      const doc1 = await db.saves.findOne(saveId).exec();
      const t1 = doc1!.updatedAt;

      nowSpy.mockReturnValue(1_100);
      await store.updateProgress(saveId, 5);

      const doc2 = await db.saves.findOne(saveId).exec();
      expect(doc2!.updatedAt).toBeGreaterThan(t1);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("updatedAt advances on a second updateProgress call", async () => {
    const nowSpy = vi.spyOn(Date, "now");
    try {
      nowSpy.mockReturnValue(1_000);
      const saveId = await store.createSave(makeSetup());

      nowSpy.mockReturnValue(1_100);
      await store.updateProgress(saveId, 5);
      const doc1 = await db.saves.findOne(saveId).exec();
      const t1 = doc1!.updatedAt;

      nowSpy.mockReturnValue(1_200);
      await store.updateProgress(saveId, 10);

      const doc2 = await db.saves.findOne(saveId).exec();
      expect(doc2!.updatedAt).toBeGreaterThan(t1);
    } finally {
      nowSpy.mockRestore();
    }
  });
});

describe("importRxdbSave — missing custom team rejection", () => {
  const RXDB_EXPORT_KEY = "ballgame:rxdb:v1";

  const makeCustomSave = (homeTeamId: string, awayTeamId = "ct_default_away"): { json: string } => {
    const header = {
      id: `save_${Date.now()}_test`,
      name: "Test Save",
      seed: "abc",
      homeTeamId,
      awayTeamId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      progressIdx: -1,
      setup: {
        strategy: "balanced",
        managedTeam: null,
        managerMode: false,
        homeTeam: "Custom Home",
        awayTeam: "Away Team",
      },
      schemaVersion: 1,
    };
    const events: never[] = [];
    const sig = fnv1a(RXDB_EXPORT_KEY + JSON.stringify({ header, events }));
    return { json: JSON.stringify({ version: 1, header, events, sig }) };
  };

  it("throws when homeTeamId references a missing custom team", async () => {
    // Insert the away team so only the home team is missing (1 team error, not 2).
    await insertMinimalTeam(db, "ct_default_away");
    const { json } = makeCustomSave("ct_missing_abc");
    await expect(store.importRxdbSave(json)).rejects.toThrow(
      "Cannot import save: 1 custom team used by this save is not installed on this device. Import the missing team first via the Teams page, then retry the save import.",
    );
  });

  it("error message counts both teams when both are missing", async () => {
    const { json } = makeCustomSave("ct_missing_xyz", "ct_also_missing");
    await expect(store.importRxdbSave(json)).rejects.toThrow(
      "Cannot import save: 2 custom teams used by this save are not installed on this device. Import the missing teams first via the Teams page, then retry the save import.",
    );
  });

  it("succeeds when the custom team exists in the DB", async () => {
    const homeTeamId = "ct_existing_team";
    const awayTeamId = "ct_existing_away";
    for (const teamId of [homeTeamId, awayTeamId]) {
      await db.teams.insert({
        id: teamId,
        schemaVersion: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        name: "My Team",
        nameLowercase: "my team",
        metadata: { archived: false },
      });
    }
    const { json } = makeCustomSave(homeTeamId, awayTeamId);
    await expect(store.importRxdbSave(json)).resolves.not.toThrow();
  });

  it("throws with a controlled error when team ID fields are non-string", async () => {
    const { json } = makeCustomSave("ct_fixture_away_00", "ct_fixture_home_00");
    const envelope = JSON.parse(json) as Record<string, unknown> & {
      header: Record<string, unknown>;
    };
    // Overwrite with a non-string value to simulate a crafted/legacy save.
    envelope.header.homeTeamId = null;
    envelope.sig = fnv1a(RXDB_EXPORT_KEY + JSON.stringify({ header: envelope.header, events: [] }));
    await expect(store.importRxdbSave(JSON.stringify(envelope))).rejects.toThrow(
      "Invalid save data: missing or non-string team identifiers",
    );
  });

  it("counts only unique missing teams (self-matchup does not double-count)", async () => {
    // homeTeamId === awayTeamId: only 1 unique team ID, so error says "1 custom team"
    const teamId = "ct_self_matchup";
    const { json } = makeCustomSave(teamId, teamId);
    await expect(store.importRxdbSave(json)).rejects.toThrow(
      "Cannot import save: 1 custom team used by this save is not installed on this device.",
    );
  });
});
