import "fake-indexeddb/auto";

import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { BallgameDb } from "@storage/db";
import { createTestDb } from "@test/helpers/db";

import { buildLeagueSeasonStore } from "./leagueSeasonStore";

let db: BallgameDb;

beforeEach(async () => {
  db = await createTestDb(getRxStorageMemory());
});

afterEach(async () => {
  await db.close();
});

const createSeason = async (store: ReturnType<typeof buildLeagueSeasonStore>) =>
  store.createLeagueSeason({
    leagueId: "lg_1",
    seasonNumber: 1,
    status: "active",
    currentGameDay: 1,
    totalGameDays: 6,
    defaultGamesPerTeam: 6,
    seed: "testseed",
  });

describe("leagueSeasonStore.advanceGameDay", () => {
  it("advances currentGameDay to a higher value", async () => {
    const store = buildLeagueSeasonStore(() => Promise.resolve(db));
    const season = await createSeason(store);

    await store.advanceGameDay(season.id, 3);

    const updated = await store.getLeagueSeason(season.id);
    expect(updated?.currentGameDay).toBe(3);
  });

  it("is a no-op when newGameDay equals currentGameDay (monotonicity guard)", async () => {
    const store = buildLeagueSeasonStore(() => Promise.resolve(db));
    const season = await createSeason(store);

    // Advance forward first
    await store.advanceGameDay(season.id, 2);
    const before = await store.getLeagueSeason(season.id);
    const updatedAtBefore = before?.updatedAt ?? 0;

    // Try to set to same value — should be a no-op
    await store.advanceGameDay(season.id, 2);

    const after = await store.getLeagueSeason(season.id);
    expect(after?.currentGameDay).toBe(2);
    // updatedAt should not have changed (no write occurred)
    expect(after?.updatedAt).toBe(updatedAtBefore);
  });

  it("is a no-op when newGameDay is less than currentGameDay (monotonicity guard)", async () => {
    const store = buildLeagueSeasonStore(() => Promise.resolve(db));
    const season = await createSeason(store);

    // Advance to day 4
    await store.advanceGameDay(season.id, 4);

    // Attempt to go backwards to day 2 — must be ignored
    await store.advanceGameDay(season.id, 2);

    const result = await store.getLeagueSeason(season.id);
    expect(result?.currentGameDay).toBe(4);
  });
});
