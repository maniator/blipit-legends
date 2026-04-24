import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { type BallgameDexieDb, createDexieDb, deleteDexieDb } from "@storage/dexieDb";
import { fnv1a } from "@storage/hash";
import type { GameSetup, TeamRecord } from "@storage/types";

import { makeDexieSaveStore } from "./dexieSaveStore";

const TEST_DB_NAME = "ballgame-dexie-save-store-test";
const PORTABLE_SAVE_EXPORT_KEY = "ballgame:save:v1";
const LEGACY_RXDB_EXPORT_KEY = "ballgame:rxdb:v1";

const makeSetup = (overrides: Partial<GameSetup> = {}): GameSetup => ({
  homeTeamId: "ct_home",
  awayTeamId: "ct_away",
  seed: "abc123",
  setup: {
    strategy: "balanced",
    managedTeam: null,
    managerMode: false,
    homeTeam: "ct_home",
    awayTeam: "ct_away",
  },
  ...overrides,
});

const makeTeam = (id: string): TeamRecord => ({
  id,
  schemaVersion: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  name: id,
  nameLowercase: id.toLowerCase(),
  metadata: { archived: false },
});

let db: BallgameDexieDb;
let store: ReturnType<typeof makeDexieSaveStore>;

beforeEach(async () => {
  db = createDexieDb(TEST_DB_NAME);
  await db.open();
  store = makeDexieSaveStore(() => db);
});

afterEach(async () => {
  db.close();
  await deleteDexieDb(TEST_DB_NAME);
});

describe("DexieSaveStore", () => {
  it("creates, lists, and updates save headers", async () => {
    const saveId = await store.createSave(makeSetup(), { name: "Opening Day" });

    await store.updateProgress(saveId, 7, {
      scoreSnapshot: { away: 1, home: 2 },
      inningSnapshot: { inning: 4, atBat: 1 },
    });

    const saves = await store.listSaves();
    expect(saves).toHaveLength(1);
    expect(saves[0]).toMatchObject({
      id: saveId,
      name: "Opening Day",
      progressIdx: 7,
      scoreSnapshot: { away: 1, home: 2 },
      inningSnapshot: { inning: 4, atBat: 1 },
      schemaVersion: 1,
    });
  });

  it("enforces the max-save rule by evicting the oldest save and its events", async () => {
    const id1 = await store.createSave(makeSetup({ homeTeamId: "A" }));
    await store.appendEvents(id1, [{ type: "pitch", at: 0, payload: {} }]);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const id2 = await store.createSave(makeSetup({ homeTeamId: "B" }));
    await new Promise((resolve) => setTimeout(resolve, 5));
    const id3 = await store.createSave(makeSetup({ homeTeamId: "C" }));
    await new Promise((resolve) => setTimeout(resolve, 5));
    const id4 = await store.createSave(makeSetup({ homeTeamId: "D" }));

    const saves = await store.listSaves();
    const ids = saves.map((save) => save.id);
    expect(ids).not.toContain(id1);
    expect(ids).toEqual(expect.arrayContaining([id2, id3, id4]));
    expect(await db.events.where("saveId").equals(id1).count()).toBe(0);
  });

  it("deletes a save and its associated event log", async () => {
    const saveId = await store.createSave(makeSetup());
    await store.appendEvents(saveId, [
      { type: "pitch", at: 0, payload: { result: "strike" } },
      { type: "hit", at: 1, payload: { bases: 1 } },
    ]);

    await store.deleteSave(saveId);

    expect(await db.saves.get(saveId)).toBeUndefined();
    expect(await db.events.where("saveId").equals(saveId).count()).toBe(0);
  });

  it("serializes concurrent event appends without index collisions", async () => {
    const saveId = await store.createSave(makeSetup());

    await Promise.all([
      store.appendEvents(saveId, [
        { type: "a", at: 0, payload: {} },
        { type: "b", at: 1, payload: {} },
      ]),
      store.appendEvents(saveId, [
        { type: "c", at: 2, payload: {} },
        { type: "d", at: 3, payload: {} },
      ]),
    ]);

    const events = await db.events.where("saveId").equals(saveId).sortBy("idx");
    expect(events.map((event) => event.idx)).toEqual([0, 1, 2, 3]);
    expect(events.map((event) => event.id)).toEqual([
      `${saveId}:0`,
      `${saveId}:1`,
      `${saveId}:2`,
      `${saveId}:3`,
    ]);
  });

  it("exports and imports a signed save bundle", async () => {
    await db.teams.bulkPut([makeTeam("ct_home"), makeTeam("ct_away")]);
    const saveId = await store.createSave(makeSetup({ seed: "roundtrip" }));
    await store.appendEvents(saveId, [{ type: "hit", at: 1, payload: { bases: 1 } }]);

    const json = await store.exportSave(saveId);

    const targetDb = createDexieDb(`${TEST_DB_NAME}-target`);
    await targetDb.open();
    await targetDb.teams.bulkPut([makeTeam("ct_home"), makeTeam("ct_away")]);
    const targetStore = makeDexieSaveStore(() => targetDb);
    const restored = await targetStore.importSave(json);

    expect(restored.id).toBe(saveId);
    expect(restored.seed).toBe("roundtrip");
    expect(await targetDb.events.where("saveId").equals(saveId).count()).toBe(1);

    targetDb.close();
    await deleteDexieDb(`${TEST_DB_NAME}-target`);
  });

  it("imports a legacy signed save bundle for compatibility", async () => {
    await db.teams.bulkPut([makeTeam("ct_home"), makeTeam("ct_away")]);
    const header = {
      id: "legacy-signed-save",
      name: "Legacy Signed Save",
      seed: "abc",
      homeTeamId: "ct_home",
      awayTeamId: "ct_away",
      createdAt: 0,
      updatedAt: 0,
      progressIdx: -1,
      setup: makeSetup().setup,
      schemaVersion: 1,
    };
    const events: unknown[] = [];
    const sig = fnv1a(LEGACY_RXDB_EXPORT_KEY + JSON.stringify({ header, events }));

    await expect(
      store.importSave(JSON.stringify({ version: 1, header, events, sig })),
    ).resolves.toMatchObject({
      id: "legacy-signed-save",
    });
  });

  it("rejects save import when referenced teams are missing", async () => {
    const header = {
      id: "missing-team-save",
      name: "Missing Team Save",
      seed: "abc",
      homeTeamId: "ct_missing_home",
      awayTeamId: "ct_missing_away",
      createdAt: 0,
      updatedAt: 0,
      progressIdx: -1,
      setup: makeSetup({ homeTeamId: "ct_missing_home", awayTeamId: "ct_missing_away" }).setup,
      schemaVersion: 1,
    };
    const events: unknown[] = [];
    const sig = fnv1a(PORTABLE_SAVE_EXPORT_KEY + JSON.stringify({ header, events }));

    await expect(
      store.importSave(JSON.stringify({ version: 1, header, events, sig })),
    ).rejects.toThrow("not installed on this device");
  });
});
