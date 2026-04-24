import { afterEach, describe, expect, it } from "vitest";

import { createDexieDb, deleteDexieDb } from "./dexieDb";

const TEST_DB_NAME = "ballgame-dexie-test";

describe("BallgameDexieDb", () => {
  afterEach(async () => {
    await deleteDexieDb(TEST_DB_NAME);
  });

  it("opens the v1 Dexie schema with all expected tables", async () => {
    const db = createDexieDb(TEST_DB_NAME);

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
    const db = createDexieDb(TEST_DB_NAME);

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
