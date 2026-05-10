/**
 * Unit tests for leagueStore.
 *
 * Uses an in-memory RxDB instance via `makeLeagueStore(getDbFn)` so the
 * IndexedDB singleton is never touched. Pattern follows customTeamStore.test.ts
 * and saveStore.test.ts.
 */
import "fake-indexeddb/auto";

import { _resetLockCacheForTests } from "@feat/customTeams/storage/customTeamStore";
import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { BallgameDb } from "@storage/db";
import { createTestDb } from "@test/helpers/db";

import { makeLeagueStore } from "./leagueStore";

const MINI_TEAM_COUNT = 8;

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

let db: BallgameDb;
let store: ReturnType<typeof makeLeagueStore>;

beforeEach(async () => {
  db = await createTestDb(getRxStorageMemory());
  store = makeLeagueStore(() => Promise.resolve(db));
});

afterEach(async () => {
  _resetLockCacheForTests();
  await db.close();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Inserts a minimal custom team doc so the store can look it up during enrollment. */
async function insertTeam(db: BallgameDb, id: string, name: string): Promise<void> {
  await db.teams.insert({
    id,
    name,
    nameLowercase: name.toLowerCase(),
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: {},
  });
}

/** Builds a minimal CreateSeasonInput with the given team IDs in one league. */
function makeSeasonInput(teamIds: string[]) {
  return {
    name: "Test Season",
    masterSeed: "test_master_seed_01",
    preset: "mini" as const,
    seasonLength: "sprint" as const,
    leagues: [
      {
        id: "lg_test",
        name: "Test League",
        teamIds,
        dhEnabled: false,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getActiveSeason", () => {
  it("returns null when no active season exists", async () => {
    const result = await store.getActiveSeason();
    expect(result).toBeNull();
  });
});

describe("createSeason", () => {
  it("creates a season doc, 8 seasonTeam docs, and ≥30 seasonGame docs", async () => {
    // Insert 8 minimal custom team docs so the snapshot lookup doesn't return null.
    const teamIds: string[] = [];
    for (let i = 0; i < 8; i++) {
      const id = `ct_test${String(i).padStart(3, "0")}`;
      await insertTeam(db, id, `Team ${i}`);
      teamIds.push(id);
    }

    const season = await store.createSeason(makeSeasonInput(teamIds));

    // Season doc
    expect(season.status).toBe("active");
    expect(season.preset).toBe("mini");
    expect(season.seasonLength).toBe("sprint");

    // Confirm the doc was persisted.
    const seasons = await db.seasons.find({ selector: { status: "active" } }).exec();
    expect(seasons).toHaveLength(1);

    // Season team docs
    const seasonTeams = await db.seasonTeams.find({ selector: { seasonId: season.id } }).exec();
    expect(seasonTeams).toHaveLength(8);

    // Season game docs — sprint/mini yields 56 games (≥ 30)
    const seasonGames = await db.seasonGames.find({ selector: { seasonId: season.id } }).exec();
    expect(seasonGames.length).toBeGreaterThanOrEqual(30);

    // All games start as "scheduled"
    const nonScheduled = seasonGames.filter(
      (g) => (g.toJSON() as unknown as { status: string }).status !== "scheduled",
    );
    expect(nonScheduled).toHaveLength(0);
  });

  it("sets status=active so getActiveSeason returns it", async () => {
    const teamIds: string[] = [];
    for (let i = 0; i < 8; i++) {
      const id = `ct_act${String(i).padStart(3, "0")}`;
      await insertTeam(db, id, `Active Team ${i}`);
      teamIds.push(id);
    }

    await store.createSeason(makeSeasonInput(teamIds));
    const active = await store.getActiveSeason();
    expect(active).not.toBeNull();
    expect(active!.status).toBe("active");
  });
});

describe("recordResult", () => {
  it("writes boxscore and marks game as completed", async () => {
    const teamIds: string[] = [];
    for (let i = 0; i < 8; i++) {
      const id = `ct_rr${String(i).padStart(3, "0")}`;
      await insertTeam(db, id, `RR Team ${i}`);
      teamIds.push(id);
    }

    const season = await store.createSeason(makeSeasonInput(teamIds));
    const games = await store.getSeasonGames(season.id, "scheduled");
    expect(games.length).toBeGreaterThan(0);

    const targetGame = games[0];
    await store.recordResult({
      seasonGameId: targetGame.id,
      boxscore: { homeScore: 5, awayScore: 3 },
    });

    const updatedDoc = await db.seasonGames.findOne(targetGame.id).exec();
    expect(updatedDoc).not.toBeNull();
    const updated = updatedDoc!.toJSON() as unknown as { status: string };
    expect(updated.status).toBe("completed");
  });

  it("is idempotent — second call on an already completed game is a no-op", async () => {
    const teamIds: string[] = [];
    for (let i = 0; i < 8; i++) {
      const id = `ct_idem${String(i).padStart(3, "0")}`;
      await insertTeam(db, id, `Idem Team ${i}`);
      teamIds.push(id);
    }

    const season = await store.createSeason(makeSeasonInput(teamIds));
    const [game] = await store.getSeasonGames(season.id, "scheduled");

    // First call
    await store.recordResult({
      seasonGameId: game.id,
      boxscore: { homeScore: 7, awayScore: 2 },
    });

    // Second call with a different score — should be a no-op
    await store.recordResult({
      seasonGameId: game.id,
      boxscore: { homeScore: 1, awayScore: 0 },
    });

    const doc = await db.seasonGames.findOne(game.id).exec();
    const stored = doc!.toJSON() as unknown as { boxscore: { homeScore: number } };
    // Score should still be from the first call
    expect(stored.boxscore.homeScore).toBe(7);
  });

  it("is a no-op for a non-existent game ID", async () => {
    await expect(
      store.recordResult({
        seasonGameId: "sg_doesnotexist",
        boxscore: { homeScore: 1, awayScore: 0 },
      }),
    ).resolves.toBeUndefined();
  });
});

describe("quickStart", () => {
  it("works when quickStart is called as a detached function reference", async () => {
    const { quickStart } = store;
    const result = await quickStart({
      masterSeed: "qs_master_seed_detached",
      dhEnabled: true,
      autogenOptions: {
        count: MINI_TEAM_COUNT,
        theme: "mix",
        parity: "mixed",
      },
    });

    expect(result.status).toBe("active");
    const seasonTeams = await store.getSeasonTeams(result.id);
    expect(seasonTeams).toHaveLength(MINI_TEAM_COUNT);
  });

  it("creates autogen teams in customTeams and creates an active season", async () => {
    const result = await store.quickStart({
      masterSeed: "qs_master_seed_01",
      dhEnabled: false,
      autogenOptions: {
        count: MINI_TEAM_COUNT,
        theme: "classic",
        parity: "balanced",
      },
    });

    // Season should be active
    expect(result.status).toBe("active");

    // 8 custom team docs should exist
    const teamDocs = await db.teams.find().exec();
    expect(teamDocs).toHaveLength(MINI_TEAM_COUNT);

    // All should have autogen.version set
    for (const doc of teamDocs) {
      const team = doc.toJSON() as unknown as { autogen?: { version: number } };
      expect(team.autogen).toBeDefined();
      expect(team.autogen!.version).toBe(1);
    }

    // Season should have 8 enrolled teams
    const seasonTeams = await store.getSeasonTeams(result.id);
    expect(seasonTeams).toHaveLength(MINI_TEAM_COUNT);

    // And ≥30 games
    const games = await store.getSeasonGames(result.id);
    expect(games.length).toBeGreaterThanOrEqual(30);
  });
});

describe("getSeasonTeams / getSeasonGames", () => {
  it("getSeasonTeams returns empty array for unknown seasonId", async () => {
    const teams = await store.getSeasonTeams("s_nonexistent");
    expect(teams).toEqual([]);
  });

  it("getSeasonGames returns empty array for unknown seasonId", async () => {
    const games = await store.getSeasonGames("s_nonexistent");
    expect(games).toEqual([]);
  });

  it("getSeasonGames filters by status", async () => {
    const teamIds: string[] = [];
    for (let i = 0; i < 8; i++) {
      const id = `ct_filt${String(i).padStart(3, "0")}`;
      await insertTeam(db, id, `Filter Team ${i}`);
      teamIds.push(id);
    }

    const season = await store.createSeason(makeSeasonInput(teamIds));
    const [firstGame] = await store.getSeasonGames(season.id, "scheduled");

    // Mark one game completed
    await store.recordResult({
      seasonGameId: firstGame.id,
      boxscore: { homeScore: 3, awayScore: 1 },
    });

    const completed = await store.getSeasonGames(season.id, "completed");
    expect(completed).toHaveLength(1);
    expect(completed[0].id).toBe(firstGame.id);

    const scheduled = await store.getSeasonGames(season.id, "scheduled");
    expect(scheduled.length).toBeGreaterThan(0);
    expect(scheduled.some((g) => g.id === firstGame.id)).toBe(false);
  });
});
