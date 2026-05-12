import { afterEach, describe, expect, it } from "vitest";

import { type BallgameDexieDb, createDexieDb, deleteDexieDb } from "./dexieDb";

const TEST_DB_NAME = "ballgame-dexie-test";

describe("BallgameDexieDb", () => {
  let db: BallgameDexieDb | null = null;

  afterEach(async () => {
    // Close the per-test handle before deleting the DB so an open connection
    // can't block Dexie.delete() and make cleanup flaky across environments.
    if (db) {
      db.close();
      db = null;
    }
    await deleteDexieDb(TEST_DB_NAME);
  });

  it("opens the v1 Dexie schema with all expected tables", async () => {
    db = createDexieDb(TEST_DB_NAME);

    await db.open();

    expect(db.tables.map((table) => table.name).sort()).toEqual([
      "batterGameStats",
      "completedGames",
      "events",
      "pitcherGameStats",
      "players",
      "saves",
      "teams",
    ]);
  });

  it("creates the indexes needed by current storage queries", async () => {
    db = createDexieDb(TEST_DB_NAME);

    await db.open();

    expect(db.saves.schema.primKey.keyPath).toBe("id");
    expect(db.saves.schema.idxByName.updatedAt).toBeDefined();

    expect(db.events.schema.primKey.keyPath).toBe("id");
    expect(db.events.schema.idxByName.saveId).toBeDefined();
    expect(db.events.schema.idxByName["[saveId+idx]"]).toBeDefined();

    expect(db.teams.schema.primKey.keyPath).toBe("id");
    expect(db.teams.schema.idxByName.updatedAt).toBeDefined();
    expect(db.teams.schema.idxByName.nameLowercase).toBeDefined();

    expect(db.players.schema.primKey.keyPath).toBe("id");
    expect(db.players.schema.idxByName.teamId).toBeDefined();

    expect(db.completedGames.schema.idxByName.playedAt).toBeDefined();
    expect(db.completedGames.schema.idxByName["[homeTeamId+playedAt]"]).toBeDefined();
    expect(db.completedGames.schema.idxByName["[awayTeamId+playedAt]"]).toBeDefined();

    expect(db.batterGameStats.schema.idxByName.gameId).toBeDefined();
    expect(db.batterGameStats.schema.idxByName["[playerId+createdAt]"]).toBeDefined();
    expect(db.batterGameStats.schema.idxByName["[teamId+createdAt]"]).toBeDefined();

    expect(db.pitcherGameStats.schema.idxByName.gameId).toBeDefined();
    expect(db.pitcherGameStats.schema.idxByName["[playerId+createdAt]"]).toBeDefined();
    expect(db.pitcherGameStats.schema.idxByName["[teamId+createdAt]"]).toBeDefined();
  });
});
