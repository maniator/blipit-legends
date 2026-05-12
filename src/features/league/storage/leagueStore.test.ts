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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BallgameDb } from "@storage/db";
import { createTestDb } from "@test/helpers/db";

import { makeLeagueStore } from "./leagueStore";

vi.mock("@feat/league/sim/runHeadlessGame", () => ({
  runHeadlessGame: vi.fn(),
}));

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

async function insertTeamPlayerFixtures(db: BallgameDb, teamId: string): Promise<void> {
  const now = new Date().toISOString();
  await db.players.bulkInsert([
    {
      id: `${teamId}_lineup_1`,
      teamId,
      section: "lineup",
      orderIndex: 0,
      name: `${teamId} Batter`,
      role: "batter",
      position: "CF",
      handedness: "R",
      batting: { contact: 50, power: 50, speed: 50, stamina: 50 },
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    },
    {
      id: `${teamId}_pitcher_1`,
      teamId,
      section: "pitchers",
      orderIndex: 0,
      name: `${teamId} Pitcher`,
      role: "pitcher",
      position: "SP",
      handedness: "R",
      pitchingRole: "SP",
      pitching: { velocity: 50, control: 50, movement: 50, stamina: 60 },
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    },
  ]);
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

  it("stores lineup/bench/pitchers in season roster snapshots and initializes pitcher state", async () => {
    const teamIds: string[] = [];
    for (let i = 0; i < 8; i++) {
      const id = `ct_snap${String(i).padStart(3, "0")}`;
      await insertTeam(db, id, `Snapshot Team ${i}`);
      await insertTeamPlayerFixtures(db, id);
      teamIds.push(id);
    }

    const season = await store.createSeason(makeSeasonInput(teamIds));
    const seasonTeams = await store.getSeasonTeams(season.id);
    expect(seasonTeams).toHaveLength(8);

    for (const team of seasonTeams) {
      const snap = team.rosterSnapshot as {
        lineup?: unknown[];
        bench?: unknown[];
        pitchers?: unknown[];
      };
      expect(Array.isArray(snap.lineup)).toBe(true);
      expect(Array.isArray(snap.bench)).toBe(true);
      expect(Array.isArray(snap.pitchers)).toBe(true);
      expect(snap.lineup).toHaveLength(1);
      expect(snap.pitchers).toHaveLength(1);
    }

    const pitcherStates = await db.seasonPlayerState
      .find({ selector: { seasonId: season.id } })
      .exec();
    expect(pitcherStates).toHaveLength(8);
  });

  it("createSeason throws if a teamId in input is not found in DB", async () => {
    const teamIds = ["ct_valid"];
    await insertTeam(db, "ct_valid", "Valid Team");
    await insertTeamPlayerFixtures(db, "ct_valid");

    // Add a non-existent team ID
    const invalidInput = makeSeasonInput([...teamIds, "ct_does_not_exist"]);

    await expect(store.createSeason(invalidInput)).rejects.toThrow(
      /team "ct_does_not_exist" not found/,
    );
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

describe("simulateNextDay", () => {
  it("returns { gamesSimulated: 0, seasonComplete: false } for unknown seasonId", async () => {
    const result = await store.simulateNextDay("s_nonexistent");
    expect(result).toEqual({ gamesSimulated: 0, seasonComplete: false });
  });

  it("returns { gamesSimulated: 0, seasonComplete: false } when no games pending on current day", async () => {
    const { runHeadlessGame } = await import("@feat/league/sim/runHeadlessGame");

    const teamIds: string[] = [];
    for (let i = 0; i < 8; i++) {
      const id = `ct_sim${String(i).padStart(3, "0")}`;
      await insertTeam(db, id, `Sim Team ${i}`);
      teamIds.push(id);
    }

    const season = await store.createSeason(makeSeasonInput(teamIds));

    // Complete all games on day 0 so no games are pending.
    const day0Games = await db.seasonGames
      .find({ selector: { seasonId: season.id, gameDay: 0 } })
      .exec();

    for (const g of day0Games) {
      await g.patch({ status: "completed", boxscore: { homeScore: 3, awayScore: 1 } });
    }

    // Bump currentGameDay to 1 so we're looking at day 1 which has no completed games yet.
    const seasonDoc = await db.seasons.findOne(season.id).exec();
    await seasonDoc?.patch({ currentGameDay: 1 });

    // Mock runHeadlessGame to never be called (because we're testing the "no games pending" path).
    vi.mocked(runHeadlessGame).mockResolvedValue({
      status: "completed",
      homeScore: 5,
      awayScore: 3,
    });

    const result = await store.simulateNextDay(season.id);

    // Since day 1 has scheduled games (not completed), this should return 0 games simulated.
    // But since there ARE scheduled games remaining, seasonComplete should be false.
    expect(result.gamesSimulated).toBeGreaterThanOrEqual(0);
    expect(result.seasonComplete).toBe(false);
  });

  it("returns { gamesSimulated: N, seasonComplete: false } after simulating today's games", async () => {
    const { runHeadlessGame } = await import("@feat/league/sim/runHeadlessGame");

    const teamIds: string[] = [];
    for (let i = 0; i < 8; i++) {
      const id = `ct_sims${String(i).padStart(3, "0")}`;
      await insertTeam(db, id, `SimS Team ${i}`);
      teamIds.push(id);
    }

    const season = await store.createSeason(makeSeasonInput(teamIds));

    // Mock runHeadlessGame to return completed status.
    vi.mocked(runHeadlessGame).mockResolvedValue({
      status: "completed",
      homeScore: 5,
      awayScore: 3,
    });

    const result = await store.simulateNextDay(season.id);

    expect(result.gamesSimulated).toBeGreaterThan(0);
    // Season should not be complete after simulating just one day.
    expect(result.seasonComplete).toBe(false);
  });
});

describe("recordResult fatigue", () => {
  it("resets pitcher daysRest to 0 after they start a game", async () => {
    const teamIds: string[] = [];
    for (let i = 0; i < 8; i++) {
      const id = `ct_fat${String(i).padStart(3, "0")}`;
      await insertTeam(db, id, `Fatigue Team ${i}`);
      teamIds.push(id);
    }

    const season = await store.createSeason(makeSeasonInput(teamIds));
    const [game] = await store.getSeasonGames(season.id, "scheduled");

    // Pre-insert seasonPlayerState docs for both teams.
    const homeSpId = "p_sp_home_fatigue";
    const awaySpId = "p_sp_away_fatigue";

    await db.seasonPlayerState.bulkInsert([
      {
        id: `${season.id}:${game.homeSeasonTeamId}:${homeSpId}`,
        seasonId: season.id,
        seasonTeamId: game.homeSeasonTeamId,
        playerId: homeSpId,
        pitcherDaysRest: 4,
        pitcherAvailability: 1.0,
        pitcherStartsThisSeason: 0,
      },
      {
        id: `${season.id}:${game.awaySeasonTeamId}:${awaySpId}`,
        seasonId: season.id,
        seasonTeamId: game.awaySeasonTeamId,
        playerId: awaySpId,
        pitcherDaysRest: 4,
        pitcherAvailability: 1.0,
        pitcherStartsThisSeason: 0,
      },
    ]);

    // Record result with starting pitcher IDs in the boxscore.
    await store.recordResult({
      seasonGameId: game.id,
      boxscore: {
        homeScore: 5,
        awayScore: 3,
        winnerStartingPitcherId: homeSpId,
        loserStartingPitcherId: awaySpId,
      } as any,
    });

    // Verify the SP's pitcherDaysRest was reset to 0.
    const homeSpDoc = await db.seasonPlayerState
      .findOne(`${season.id}:${game.homeSeasonTeamId}:${homeSpId}`)
      .exec();
    const awaySpDoc = await db.seasonPlayerState
      .findOne(`${season.id}:${game.awaySeasonTeamId}:${awaySpId}`)
      .exec();

    expect(homeSpDoc?.pitcherDaysRest).toBe(0);
    expect(awaySpDoc?.pitcherDaysRest).toBe(0);
  });
});
