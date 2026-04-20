import "fake-indexeddb/auto";

import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { BallgameDb } from "@storage/db";
import { createTestDb } from "@test/helpers/db";

import { buildScheduledGameStore } from "./scheduledGameStore";

let db: BallgameDb;

beforeEach(async () => {
  db = await createTestDb(getRxStorageMemory());
});

afterEach(async () => {
  await db.close();
});

describe("scheduledGameStore", () => {
  it("listGamesForDay returns the correct subset", async () => {
    const store = buildScheduledGameStore(() => Promise.resolve(db));

    await store.bulkCreateScheduledGames([
      {
        id: "sgame_day1_a",
        leagueSeasonId: "lsn_test",
        gameDay: 1,
        awayTeamId: "ct_away1",
        homeTeamId: "ct_home1",
        status: "scheduled",
      },
      {
        id: "sgame_day1_b",
        leagueSeasonId: "lsn_test",
        gameDay: 1,
        awayTeamId: "ct_away2",
        homeTeamId: "ct_home2",
        status: "scheduled",
      },
      {
        id: "sgame_day2_a",
        leagueSeasonId: "lsn_test",
        gameDay: 2,
        awayTeamId: "ct_away3",
        homeTeamId: "ct_home3",
        status: "scheduled",
      },
    ]);

    const day1Games = await store.listGamesForDay("lsn_test", 1);
    expect(day1Games).toHaveLength(2);
    expect(day1Games.every((g) => g.gameDay === 1)).toBe(true);

    const day2Games = await store.listGamesForDay("lsn_test", 2);
    expect(day2Games).toHaveLength(1);
    expect(day2Games[0].id).toBe("sgame_day2_a");
  });

  it("markScheduledGameCompleted is idempotent — calling twice with same completedGameId is safe", async () => {
    const store = buildScheduledGameStore(() => Promise.resolve(db));

    await store.bulkCreateScheduledGames([
      {
        id: "sgame_idem_test",
        leagueSeasonId: "lsn_idem",
        gameDay: 1,
        awayTeamId: "ct_away",
        homeTeamId: "ct_home",
        status: "scheduled",
      },
    ]);

    // First call
    await store.markScheduledGameCompleted("sgame_idem_test", "game_A");
    // Second call — should be a no-op
    await store.markScheduledGameCompleted("sgame_idem_test", "game_A");

    const game = await store.getScheduledGame("sgame_idem_test");
    expect(game?.status).toBe("completed");
    expect(game?.completedGameId).toBe("game_A");
  });

  it("markScheduledGameCompleted throws for a bye game", async () => {
    const store = buildScheduledGameStore(() => Promise.resolve(db));

    await store.bulkCreateScheduledGames([
      {
        id: "sgame_bye_test",
        leagueSeasonId: "lsn_bye",
        gameDay: 1,
        awayTeamId: "ct_away",
        homeTeamId: "ct_home",
        status: "bye",
      },
    ]);

    await expect(store.markScheduledGameCompleted("sgame_bye_test", "game_B")).rejects.toThrow(
      "Cannot complete a bye game",
    );
  });
});
