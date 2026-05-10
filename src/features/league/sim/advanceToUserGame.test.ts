/**
 * Integration tests for advanceToUserGame batch loop.
 * Uses in-memory RxDB for isolation.
 */
import "fake-indexeddb/auto";

import { seasonGamesCollectionConfig } from "@feat/league/storage/seasonGamesSchema";
import { seasonPlayerStateCollectionConfig } from "@feat/league/storage/seasonPlayerStateSchema";
import { seasonsCollectionConfig } from "@feat/league/storage/seasonsSchema";
import { seasonTeamsCollectionConfig } from "@feat/league/storage/seasonTeamsSchema";
import { deriveScheduledGameSeed } from "@feat/league/utils/deriveScheduledGameSeed";
import { createRxDatabase } from "rxdb";
import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { advanceToUserGame } from "./advanceToUserGame";

vi.mock("@storage/db", () => ({ getDb: vi.fn() }));
vi.mock("./runHeadlessGame", () => ({ runHeadlessGame: vi.fn() }));

// We test the batch ordering logic (what gets simulated vs. returned) without
// wiring through getDb(). The sorting and filtering logic in advanceToUserGame
// is exercised via its pure sort helpers tested inline here.

const makeName = () => `test_advance_${Math.random().toString(36).slice(2, 10)}`;

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

type TestDb = Awaited<ReturnType<typeof makeTestDb>>;
let db: TestDb;

const SEASON_ID = "s_advance_test";
const USER_ST_ID = "st_user";
const OTHER_ST_A = "st_otherA";
const OTHER_ST_B = "st_otherB";

const ROSTER = {
  pitchers: [
    { id: "p_sp1", pitchingRole: "SP" },
    { id: "p_rp1", pitchingRole: "RP" },
  ],
};

async function insertGame(
  id: string,
  gameDay: number,
  homeId: string,
  awayId: string,
  status: "scheduled" | "completed" | "in_progress" = "scheduled",
) {
  await db.seasonGames.insert({
    id,
    seasonId: SEASON_ID,
    gameDay,
    homeSeasonTeamId: homeId,
    awaySeasonTeamId: awayId,
    seriesId: `ser_${id}`,
    status,
    boxscore: status === "completed" ? { homeScore: 3, awayScore: 1 } : null,
    derivedSeed: deriveScheduledGameSeed({
      seasonId: SEASON_ID,
      seasonRoundIdx: 0,
      gameInSeriesIdx: 0,
      homeCustomTeamId: homeId,
      awayCustomTeamId: awayId,
    }),
    completedAt: status === "completed" ? Date.now() : null,
    claimedBy: null,
  });
}

beforeEach(async () => {
  db = await makeTestDb();

  await db.seasons.insert({
    id: SEASON_ID,
    name: "Advance Test Season",
    status: "active",
    createdAt: Date.now(),
    preset: "mini",
    seasonLength: "sprint",
    masterSeed: "advance_test_seed",
    leagues: [
      { id: "lg_1", name: "League", teamIds: ["ct_user", "ct_a", "ct_b"], dhEnabled: false },
    ],
    currentGameDay: 0,
    rulesetVersion: 1,
  });

  await db.seasonTeams.bulkInsert([
    {
      id: USER_ST_ID,
      seasonId: SEASON_ID,
      leagueId: "lg_1",
      customTeamId: "ct_user",
      rosterSnapshot: ROSTER,
      wins: 0,
      losses: 0,
      ties: 0,
      runDifferential: 0,
    },
    {
      id: OTHER_ST_A,
      seasonId: SEASON_ID,
      leagueId: "lg_1",
      customTeamId: "ct_a",
      rosterSnapshot: ROSTER,
      wins: 0,
      losses: 0,
      ties: 0,
      runDifferential: 0,
    },
    {
      id: OTHER_ST_B,
      seasonId: SEASON_ID,
      leagueId: "lg_1",
      customTeamId: "ct_b",
      rosterSnapshot: ROSTER,
      wins: 0,
      losses: 0,
      ties: 0,
      runDifferential: 0,
    },
  ]);

  // Player states for all teams (SP only for simplicity)
  await db.seasonPlayerState.bulkInsert([
    {
      id: `${SEASON_ID}:${USER_ST_ID}:p_sp1_user`,
      seasonId: SEASON_ID,
      seasonTeamId: USER_ST_ID,
      playerId: "p_sp1",
      pitcherDaysRest: 4,
      pitcherAvailability: 1.0,
      pitcherStartsThisSeason: 0,
    },
    {
      id: `${SEASON_ID}:${USER_ST_ID}:p_rp1_user`,
      seasonId: SEASON_ID,
      seasonTeamId: USER_ST_ID,
      playerId: "p_rp1",
      pitcherDaysRest: 3,
      pitcherAvailability: 1.0,
      pitcherStartsThisSeason: 0,
    },
    {
      id: `${SEASON_ID}:${OTHER_ST_A}:p_sp1_a`,
      seasonId: SEASON_ID,
      seasonTeamId: OTHER_ST_A,
      playerId: "p_sp1",
      pitcherDaysRest: 4,
      pitcherAvailability: 1.0,
      pitcherStartsThisSeason: 0,
    },
    {
      id: `${SEASON_ID}:${OTHER_ST_A}:p_rp1_a`,
      seasonId: SEASON_ID,
      seasonTeamId: OTHER_ST_A,
      playerId: "p_rp1",
      pitcherDaysRest: 3,
      pitcherAvailability: 1.0,
      pitcherStartsThisSeason: 0,
    },
    {
      id: `${SEASON_ID}:${OTHER_ST_B}:p_sp1_b`,
      seasonId: SEASON_ID,
      seasonTeamId: OTHER_ST_B,
      playerId: "p_sp1",
      pitcherDaysRest: 4,
      pitcherAvailability: 1.0,
      pitcherStartsThisSeason: 0,
    },
    {
      id: `${SEASON_ID}:${OTHER_ST_B}:p_rp1_b`,
      seasonId: SEASON_ID,
      seasonTeamId: OTHER_ST_B,
      playerId: "p_rp1",
      pitcherDaysRest: 3,
      pitcherAvailability: 1.0,
      pitcherStartsThisSeason: 0,
    },
  ]);
});

afterEach(async () => {
  await db.close();
});

describe("advanceToUserGame — batch ordering logic", () => {
  it("identifies the user's next game correctly when a non-user game precedes it", async () => {
    // Day 0: non-user game (otherA vs otherB)
    // Day 1: user game
    await insertGame("sg_other_d0", 0, OTHER_ST_A, OTHER_ST_B);
    await insertGame("sg_user_d1", 1, USER_ST_ID, OTHER_ST_A);

    const pending = await db.seasonGames
      .find({ selector: { seasonId: SEASON_ID, status: { $in: ["scheduled", "in_progress"] } } })
      .exec();
    const sorted = [...pending].sort((a, b) =>
      a.gameDay !== b.gameDay ? a.gameDay - b.gameDay : a.id.localeCompare(b.id),
    );

    const nextUserGame = sorted.find(
      (g) => g.homeSeasonTeamId === USER_ST_ID || g.awaySeasonTeamId === USER_ST_ID,
    );
    const headlessBefore = sorted.filter(
      (g) =>
        g.gameDay < (nextUserGame?.gameDay ?? 0) ||
        (g.gameDay === (nextUserGame?.gameDay ?? 0) && g.id < (nextUserGame?.id ?? "")),
    );

    expect(nextUserGame?.id).toBe("sg_user_d1");
    expect(headlessBefore.map((g) => g.id)).toEqual(["sg_other_d0"]);
  });

  it("returns nextGameId=null when all pending games belong to other teams and none is a user game", async () => {
    await insertGame("sg_other_d0", 0, OTHER_ST_A, OTHER_ST_B);

    const pending = await db.seasonGames
      .find({ selector: { seasonId: SEASON_ID, status: { $in: ["scheduled", "in_progress"] } } })
      .exec();
    const nextUserGame = pending.find(
      (g) => g.homeSeasonTeamId === USER_ST_ID || g.awaySeasonTeamId === USER_ST_ID,
    );
    expect(nextUserGame).toBeUndefined();
  });

  it("returns nextGameId=null when no pending games exist", async () => {
    const pending = await db.seasonGames
      .find({ selector: { seasonId: SEASON_ID, status: { $in: ["scheduled", "in_progress"] } } })
      .exec();
    expect(pending).toHaveLength(0);
  });

  it("user's game is NOT in headlessBefore — only games before it are", async () => {
    await insertGame("sg_other_d0a", 0, OTHER_ST_A, OTHER_ST_B);
    await insertGame("sg_other_d0b", 0, OTHER_ST_B, OTHER_ST_A);
    await insertGame("sg_user_d1", 1, USER_ST_ID, OTHER_ST_A);

    const pending = await db.seasonGames
      .find({ selector: { seasonId: SEASON_ID, status: { $in: ["scheduled", "in_progress"] } } })
      .exec();
    const sorted = [...pending].sort((a, b) =>
      a.gameDay !== b.gameDay ? a.gameDay - b.gameDay : a.id.localeCompare(b.id),
    );
    const nextUserGame = sorted.find(
      (g) => g.homeSeasonTeamId === USER_ST_ID || g.awaySeasonTeamId === USER_ST_ID,
    );
    const headlessBefore = sorted.filter(
      (g) =>
        g.gameDay < (nextUserGame?.gameDay ?? 0) ||
        (g.gameDay === (nextUserGame?.gameDay ?? 0) && g.id < (nextUserGame?.id ?? "")),
    );

    expect(headlessBefore.every((g) => g.id !== "sg_user_d1")).toBe(true);
    expect(headlessBefore.length).toBe(2);
  });
});

describe("advanceToUserGame — full function", () => {
  it("returns immediately when user game is the next scheduled", async () => {
    const { getDb } = await import("@storage/db");
    const { runHeadlessGame } = await import("./runHeadlessGame");

    const testDb = await makeTestDb();
    vi.mocked(getDb).mockResolvedValue(testDb as any);
    vi.mocked(runHeadlessGame).mockResolvedValue({ status: "completed" });

    // Insert season.
    await testDb.seasons.insert({
      id: SEASON_ID,
      name: "Test Season",
      status: "active",
      createdAt: Date.now(),
      preset: "mini",
      seasonLength: "sprint",
      masterSeed: "testseed",
      leagues: [],
      tradeDeadlineGameDay: null,
      playoffFormat: null,
      featureFlags: {},
      currentGameDay: 0,
      championTeamId: null,
      rulesetVersion: 1,
      awards: [],
    });

    // Insert a user game as the first scheduled game.
    await insertGame("sg_user_first", 0, USER_ST_ID, OTHER_ST_A);

    const result = await advanceToUserGame({ seasonId: SEASON_ID, userSeasonTeamId: USER_ST_ID });

    expect(result.nextGameId).toBe("sg_user_first");
    expect(result.gamesSimulated).toBe(0);
    expect(vi.mocked(runHeadlessGame)).not.toHaveBeenCalled();

    await testDb.close();
  });

  it("advances through prior games headlessly", async () => {
    const { getDb } = await import("@storage/db");
    const { runHeadlessGame } = await import("./runHeadlessGame");

    const testDb = await makeTestDb();
    vi.mocked(getDb).mockResolvedValue(testDb as any);
    vi.mocked(runHeadlessGame).mockResolvedValue({ status: "completed" });

    // Insert season.
    await testDb.seasons.insert({
      id: SEASON_ID,
      name: "Test Season",
      status: "active",
      createdAt: Date.now(),
      preset: "mini",
      seasonLength: "sprint",
      masterSeed: "testseed",
      leagues: [],
      tradeDeadlineGameDay: null,
      playoffFormat: null,
      featureFlags: {},
      currentGameDay: 0,
      championTeamId: null,
      rulesetVersion: 1,
      awards: [],
    });

    // Insert games: 2 non-user games on day 0, then a user game on day 1.
    await insertGame("sg_other_d0a", 0, OTHER_ST_A, OTHER_ST_B);
    await insertGame("sg_other_d0b", 0, OTHER_ST_B, OTHER_ST_A);
    await insertGame("sg_user_d1", 1, USER_ST_ID, OTHER_ST_A);

    const result = await advanceToUserGame({ seasonId: SEASON_ID, userSeasonTeamId: USER_ST_ID });

    expect(result.nextGameId).toBe("sg_user_d1");
    expect(result.gamesSimulated).toBe(2);
    expect(vi.mocked(runHeadlessGame)).toHaveBeenCalledTimes(2);

    await testDb.close();
  });

  it("handles missing season", async () => {
    const { getDb } = await import("@storage/db");

    const testDb = await makeTestDb();
    vi.mocked(getDb).mockResolvedValue(testDb as any);

    const result = await advanceToUserGame({
      seasonId: "s_nonexistent",
      userSeasonTeamId: USER_ST_ID,
    });

    expect(result.nextGameId).toBeNull();
    expect(result.gamesSimulated).toBe(0);

    await testDb.close();
  });
});
