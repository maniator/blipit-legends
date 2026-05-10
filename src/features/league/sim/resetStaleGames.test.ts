/**
 * Integration tests for resetStaleInProgressGames.
 * Uses in-memory RxDB (fake-indexeddb) for isolation.
 */
import "fake-indexeddb/auto";

import { seasonGamesCollectionConfig } from "@feat/league/storage/seasonGamesSchema";
import { seasonPlayerStateCollectionConfig } from "@feat/league/storage/seasonPlayerStateSchema";
import { seasonsCollectionConfig } from "@feat/league/storage/seasonsSchema";
import { seasonTeamsCollectionConfig } from "@feat/league/storage/seasonTeamsSchema";
import { createRxDatabase } from "rxdb";
import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// We test the reset logic directly against a real RxDB in-memory instance
// rather than importing getDb(), which would open IndexedDB in prod mode.

const makeName = () => `test_reset_${Math.random().toString(36).slice(2, 10)}`;

type TestDb = Awaited<ReturnType<typeof makeTestDb>>;

async function makeTestDb() {
  const db = await createRxDatabase({
    name: makeName(),
    storage: getRxStorageMemory(),
    multiInstance: false,
  });
  await db.addCollections({
    seasons: seasonsCollectionConfig,
    seasonTeams: seasonTeamsCollectionConfig,
    seasonGames: seasonGamesCollectionConfig,
    seasonPlayerState: seasonPlayerStateCollectionConfig,
  });
  return db;
}

// Inline the reset logic pointing at the test db (mirrors resetStaleInProgressGames but db-injectable).
async function resetStale(db: TestDb): Promise<number> {
  const stale = await db.seasonGames.find({ selector: { status: "in_progress" } }).exec();
  if (stale.length === 0) return 0;
  await Promise.all(stale.map((doc) => doc.patch({ status: "scheduled", claimedBy: null })));
  return stale.length;
}

let db: TestDb;

beforeEach(async () => {
  db = await makeTestDb();
});
afterEach(async () => {
  await db.close();
});

const BASE_GAME = {
  seasonId: "s_season01",
  gameDay: 0,
  homeSeasonTeamId: "st_home",
  awaySeasonTeamId: "st_away",
  seriesId: "ser_1",
  derivedSeed: "abc123",
};

describe("resetStaleInProgressGames", () => {
  it("resets in_progress games to scheduled and nulls claimedBy", async () => {
    await db.seasonGames.insert({
      ...BASE_GAME,
      id: "sg_stale1",
      status: "in_progress",
      claimedBy: "dead-session-token",
      boxscore: null,
      completedAt: null,
    });

    const count = await resetStale(db);
    expect(count).toBe(1);

    const doc = await db.seasonGames.findOne("sg_stale1").exec();
    expect(doc?.status).toBe("scheduled");
    expect(doc?.claimedBy).toBeNull();
  });

  it("does not touch games that are already scheduled", async () => {
    await db.seasonGames.insert({
      ...BASE_GAME,
      id: "sg_sched1",
      status: "scheduled",
      claimedBy: null,
      boxscore: null,
      completedAt: null,
    });

    const count = await resetStale(db);
    expect(count).toBe(0);

    const doc = await db.seasonGames.findOne("sg_sched1").exec();
    expect(doc?.status).toBe("scheduled");
  });

  it("does not touch completed games", async () => {
    await db.seasonGames.insert({
      ...BASE_GAME,
      id: "sg_done1",
      status: "completed",
      claimedBy: null,
      boxscore: { homeScore: 3, awayScore: 2 },
      completedAt: Date.now(),
    });

    const count = await resetStale(db);
    expect(count).toBe(0);

    const doc = await db.seasonGames.findOne("sg_done1").exec();
    expect(doc?.status).toBe("completed");
  });

  it("returns the correct count when multiple stale games exist", async () => {
    await db.seasonGames.bulkInsert([
      {
        ...BASE_GAME,
        id: "sg_s1",
        status: "in_progress",
        claimedBy: "tok1",
        boxscore: null,
        completedAt: null,
      },
      {
        ...BASE_GAME,
        id: "sg_s2",
        status: "in_progress",
        claimedBy: "tok2",
        boxscore: null,
        completedAt: null,
      },
      {
        ...BASE_GAME,
        id: "sg_s3",
        status: "scheduled",
        claimedBy: null,
        boxscore: null,
        completedAt: null,
      },
    ]);

    const count = await resetStale(db);
    expect(count).toBe(2);
  });
});
