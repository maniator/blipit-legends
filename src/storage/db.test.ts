import "fake-indexeddb/auto";

import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb } from "@test/helpers/db";

import {
  type BallgameDb,
  eventsCollection,
  getDb,
  playersCollection,
  savesCollection,
  teamsCollection,
  wasDbReset,
} from "./db";
import type { GameSaveSetup } from "./types";

let db: BallgameDb;

beforeEach(async () => {
  db = await createTestDb(getRxStorageMemory());
});

afterEach(async () => {
  await db.close();
});

describe("db collections", () => {
  it("creates saves, events, teams, players, completedGames, batterGameStats, and pitcherGameStats collections", () => {
    expect(db.saves).toBeDefined();
    expect(db.events).toBeDefined();
    expect(db.teams).toBeDefined();
    expect(db.players).toBeDefined();
    expect(db.completedGames).toBeDefined();
    expect(db.batterGameStats).toBeDefined();
    expect(db.pitcherGameStats).toBeDefined();
  });

  it("inserts and retrieves a saves document", async () => {
    await db.saves.insert({
      id: "s1",
      name: "Test Game",
      seed: "abc",
      homeTeamId: "Yankees",
      awayTeamId: "Mets",
      createdAt: 1000,
      updatedAt: 1000,
      progressIdx: 0,
      setup: {} as GameSaveSetup,
      schemaVersion: 1,
    });
    const doc = await db.saves.findOne("s1").exec();
    expect(doc?.name).toBe("Test Game");
    expect(doc?.homeTeamId).toBe("Yankees");
  });

  it("inserts and retrieves an events document", async () => {
    await db.events.insert({
      id: "s1:0",
      saveId: "s1",
      idx: 0,
      at: 0,
      type: "pitch",
      payload: { result: "strike" },
      ts: 1000,
      schemaVersion: 1,
    });
    const doc = await db.events.findOne("s1:0").exec();
    expect(doc?.type).toBe("pitch");
    expect(doc?.saveId).toBe("s1");
    expect(doc?.idx).toBe(0);
  });

  it("indexes events by saveId", async () => {
    for (let i = 0; i < 3; i++) {
      await db.events.insert({
        id: `save_a:${i}`,
        saveId: "save_a",
        idx: i,
        at: i,
        type: "pitch",
        payload: {},
        ts: Date.now(),
        schemaVersion: 1,
      });
    }
    // Insert one for a different save to verify filtering
    await db.events.insert({
      id: "save_b:0",
      saveId: "save_b",
      idx: 0,
      at: 0,
      type: "pitch",
      payload: {},
      ts: Date.now(),
      schemaVersion: 1,
    });
    const results = await db.events.find({ selector: { saveId: "save_a" } }).exec();
    expect(results).toHaveLength(3);
  });
});

describe("getDb schema recovery behavior", () => {
  it("does not treat DB8 as schema-failure reset path", async () => {
    const removeRxDatabaseMock = vi.fn();
    const createRxDatabaseMock = vi.fn().mockRejectedValue({ code: "DB8" });

    vi.resetModules();
    vi.doMock("rxdb", async (importActual) => {
      const actual = await importActual<typeof import("rxdb")>();
      return {
        ...actual,
        createRxDatabase: createRxDatabaseMock,
        removeRxDatabase: removeRxDatabaseMock,
      };
    });
    vi.doMock("rxdb/plugins/storage-dexie", () => ({
      getRxStorageDexie: vi.fn(() => ({})),
    }));

    const dbModule = await import("./db");

    await expect(dbModule.getDb()).rejects.toMatchObject({ code: "DB8" });
    expect(removeRxDatabaseMock).not.toHaveBeenCalled();

    vi.resetModules();
    vi.doUnmock("rxdb");
    vi.doUnmock("rxdb/plugins/storage-dexie");
  });
});

describe("savesCollection / eventsCollection helpers (singleton)", () => {
  it("savesCollection() resolves to the RxDB saves collection", async () => {
    // getDb() uses getRxStorageDexie() — fake-indexeddb polyfills IndexedDB for the test.
    const singletonDb = await getDb();
    const col = await savesCollection();
    expect(col).toBe(singletonDb.saves);
  });

  it("eventsCollection() resolves to the RxDB events collection", async () => {
    const singletonDb = await getDb();
    const col = await eventsCollection();
    expect(col).toBe(singletonDb.events);
  });

  it("teamsCollection() resolves to the RxDB teams collection", async () => {
    const singletonDb = await getDb();
    const col = await teamsCollection();
    expect(col).toBe(singletonDb.teams);
  });

  it("playersCollection() resolves to the RxDB players collection", async () => {
    const singletonDb = await getDb();
    const col = await playersCollection();
    expect(col).toBe(singletonDb.players);
  });
});

describe("players collection", () => {
  it("inserts and retrieves a player document", async () => {
    await db.players.insert({
      id: "team1:lineup:0",
      teamId: "team1",
      section: "lineup",
      orderIndex: 0,
      name: "Alice",
      role: "batter",
      position: "C",
      handedness: "R" as const,
      batting: { contact: 70, power: 60, speed: 50, stamina: 50 },
      createdAt: "2024-01-01T00:00:00.000Z",

      updatedAt: "2024-01-01T00:00:00.000Z",

      schemaVersion: 1,
    });
    const doc = await db.players.findOne("team1:lineup:0").exec();
    expect(doc?.name).toBe("Alice");
    expect(doc?.teamId).toBe("team1");
    expect(doc?.section).toBe("lineup");
    expect(doc?.orderIndex).toBe(0);
  });

  it("queries players by teamId", async () => {
    await db.players.bulkInsert([
      {
        id: "t1:lineup:0",
        teamId: "t1",
        section: "lineup" as const,
        orderIndex: 0,
        name: "Alice",
        role: "batter",
        position: "C",
        handedness: "R" as const,
        batting: { contact: 70, power: 60, speed: 50, stamina: 50 },
        createdAt: "2024-01-01T00:00:00.000Z",

        updatedAt: "2024-01-01T00:00:00.000Z",

        schemaVersion: 1,
      },
      {
        id: "t1:lineup:1",
        teamId: "t1",
        section: "lineup" as const,
        orderIndex: 1,
        name: "Bob",
        role: "batter",
        position: "C",
        handedness: "R" as const,
        batting: { contact: 65, power: 55, speed: 45, stamina: 50 },
        createdAt: "2024-01-01T00:00:00.000Z",

        updatedAt: "2024-01-01T00:00:00.000Z",

        schemaVersion: 1,
      },
      {
        id: "t2:lineup:0",
        teamId: "t2",
        section: "lineup" as const,
        orderIndex: 0,
        name: "Carol",
        role: "batter",
        position: "C",
        handedness: "R" as const,
        batting: { contact: 80, power: 70, speed: 60, stamina: 50 },
        createdAt: "2024-01-01T00:00:00.000Z",

        updatedAt: "2024-01-01T00:00:00.000Z",

        schemaVersion: 1,
      },
    ]);
    const t1Players = await db.players.find({ selector: { teamId: "t1" } }).exec();
    expect(t1Players).toHaveLength(2);
    const t2Players = await db.players.find({ selector: { teamId: "t2" } }).exec();
    expect(t2Players).toHaveLength(1);
  });

  it("queries players by teamId + section", async () => {
    await db.players.bulkInsert([
      {
        id: "tm:lineup:0",
        teamId: "tm",
        section: "lineup" as const,
        orderIndex: 0,
        name: "Lineup Player",
        role: "batter",
        position: "C",
        handedness: "R" as const,
        batting: { contact: 70, power: 60, speed: 50, stamina: 50 },
        createdAt: "2024-01-01T00:00:00.000Z",

        updatedAt: "2024-01-01T00:00:00.000Z",

        schemaVersion: 1,
      },
      {
        id: "tm:bench:0",
        teamId: "tm",
        section: "bench" as const,
        orderIndex: 0,
        name: "Bench Player",
        role: "batter",
        position: "C",
        handedness: "R" as const,
        batting: { contact: 65, power: 55, speed: 45, stamina: 50 },
        createdAt: "2024-01-01T00:00:00.000Z",

        updatedAt: "2024-01-01T00:00:00.000Z",

        schemaVersion: 1,
      },
      {
        id: "tm:pitchers:0",
        teamId: "tm",
        section: "pitchers" as const,
        orderIndex: 0,
        name: "Pitcher",
        role: "pitcher",
        position: "P",
        handedness: "R" as const,
        pitching: { velocity: 70, control: 65, movement: 60, stamina: 60 },
        createdAt: "2024-01-01T00:00:00.000Z",

        updatedAt: "2024-01-01T00:00:00.000Z",

        schemaVersion: 1,
      },
    ]);
    const lineupPlayers = await db.players
      .find({ selector: { teamId: "tm", section: "lineup" } })
      .exec();
    expect(lineupPlayers).toHaveLength(1);
    expect(lineupPlayers[0].name).toBe("Lineup Player");
  });

  it("players from different teams are isolated", async () => {
    await db.players.bulkInsert([
      {
        id: "teamA:lineup:0",
        teamId: "teamA",
        section: "lineup" as const,
        orderIndex: 0,
        name: "A Player",
        role: "batter",
        position: "C",
        handedness: "R" as const,
        batting: { contact: 70, power: 60, speed: 50, stamina: 50 },
        createdAt: "2024-01-01T00:00:00.000Z",

        updatedAt: "2024-01-01T00:00:00.000Z",

        schemaVersion: 1,
      },
      {
        id: "teamB:lineup:0",
        teamId: "teamB",
        section: "lineup" as const,
        orderIndex: 0,
        name: "B Player",
        role: "batter",
        position: "C",
        handedness: "R" as const,
        batting: { contact: 65, power: 55, speed: 45, stamina: 50 },
        createdAt: "2024-01-01T00:00:00.000Z",

        updatedAt: "2024-01-01T00:00:00.000Z",

        schemaVersion: 1,
      },
    ]);
    const teamAPlayers = await db.players.find({ selector: { teamId: "teamA" } }).exec();
    expect(teamAPlayers.map((p) => p.name)).toEqual(["A Player"]);
    const teamBPlayers = await db.players.find({ selector: { teamId: "teamB" } }).exec();
    expect(teamBPlayers.map((p) => p.name)).toEqual(["B Player"]);
  });
});

describe("schema version and reset flag", () => {
  it("saves collection has schema version 0", () => {
    expect(db.saves.schema.version).toBe(0);
  });

  it("teams collection has schema version 0", () => {
    expect(db.teams.schema.version).toBe(0);
  });

  it("players collection has schema version 0", () => {
    expect(db.players.schema.version).toBe(0);
  });

  it("completedGames collection has schema version 0", () => {
    expect(db.completedGames.schema.version).toBe(0);
  });

  it("batterGameStats collection has schema version 0", () => {
    expect(db.batterGameStats.schema.version).toBe(0);
  });

  it("pitcherGameStats collection has schema version 0", () => {
    expect(db.pitcherGameStats.schema.version).toBe(0);
  });

  it("wasDbReset() returns false initially", () => {
    expect(wasDbReset()).toBe(false);
  });
});
