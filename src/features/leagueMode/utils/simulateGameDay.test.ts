import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LeagueSeasonRecord, ScheduledGameRecord } from "../storage/types";

// Mock the stores and simulateGame
vi.mock("../storage/scheduledGameStore", () => ({
  scheduledGameStore: {
    listGamesForDay: vi.fn(),
    listGamesForSeason: vi.fn().mockResolvedValue([]),
    markScheduledGameCompleted: vi.fn(),
  },
}));

vi.mock("../storage/leagueSeasonStore", () => ({
  leagueSeasonStore: {
    advanceGameDay: vi.fn(),
    getLeagueSeason: vi.fn().mockResolvedValue(null),
    markSeasonComplete: vi.fn(),
  },
}));

vi.mock("../storage/leagueStore", () => ({
  leagueStore: {
    getLeague: vi.fn().mockResolvedValue(null),
    archiveLeague: vi.fn(),
  },
}));

vi.mock("@feat/customTeams/storage/customTeamStore", () => ({
  CustomTeamStore: {
    listCustomTeams: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("@feat/careerStats/storage/gameHistoryStore", () => ({
  GameHistoryStore: {
    commitCompletedGame: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("./simulateGame", () => ({
  simulateGame: vi.fn(),
}));

const MOCK_FINAL_STATE = {
  gameInstanceId: "game_inst_1",
  teams: ["team_away", "team_home"],
  score: [3, 5] as [number, number],
  inning: 9,
  inningRuns: [
    [0, 0, 1, 0, 0, 1, 0, 1, 0],
    [1, 0, 0, 0, 2, 0, 1, 1, 0],
  ] as [number[], number[]],
  playLog: [],
  strikeoutLog: [],
  outLog: [],
  pitcherGameLog: [[], []] as [never[], never[]],
  playerOverrides: [{}, {}] as [Record<string, never>, Record<string, never>],
  lineupOrder: [[], []] as [string[], string[]],
};

import { leagueSeasonStore } from "../storage/leagueSeasonStore";
import { scheduledGameStore } from "../storage/scheduledGameStore";
import { simulateGame } from "./simulateGame";
import { simulateGameDay } from "./simulateGameDay";

const makeLeagueSeason = (): LeagueSeasonRecord => ({
  id: "lsn_1",
  leagueId: "lg_1",
  seasonNumber: 1,
  status: "active",
  currentGameDay: 0,
  totalGameDays: 5,
  defaultGamesPerTeam: 10,
  seed: "abc123",
  schemaVersion: 0,
  createdAt: 0,
  updatedAt: 0,
});

const makeGame = (
  id: string,
  status: ScheduledGameRecord["status"] = "scheduled",
): ScheduledGameRecord => ({
  id,
  leagueSeasonId: "lsn_1",
  gameDay: 0,
  awayTeamId: "team_away",
  homeTeamId: "team_home",
  status,
  schemaVersion: 0,
});

describe("simulateGameDay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(simulateGame).mockResolvedValue({
      homeScore: 5,
      awayScore: 3,
      winnerId: "team_home",
      loserId: "team_away",
      isTie: false,
      finalState: MOCK_FINAL_STATE as never,
    });
  });

  it("completes all scheduled games for the day", async () => {
    const games = [makeGame("g1"), makeGame("g2")];
    vi.mocked(scheduledGameStore.listGamesForDay).mockResolvedValue(games);
    vi.mocked(scheduledGameStore.markScheduledGameCompleted).mockResolvedValue(undefined);
    vi.mocked(leagueSeasonStore.advanceGameDay).mockResolvedValue(undefined);

    await simulateGameDay(makeLeagueSeason(), 0);

    expect(scheduledGameStore.markScheduledGameCompleted).toHaveBeenCalledTimes(2);
  });

  it("skips non-scheduled games", async () => {
    const games = [makeGame("g1", "completed"), makeGame("g2", "bye"), makeGame("g3")];
    vi.mocked(scheduledGameStore.listGamesForDay).mockResolvedValue(games);
    vi.mocked(scheduledGameStore.markScheduledGameCompleted).mockResolvedValue(undefined);
    vi.mocked(leagueSeasonStore.advanceGameDay).mockResolvedValue(undefined);

    await simulateGameDay(makeLeagueSeason(), 0);

    expect(scheduledGameStore.markScheduledGameCompleted).toHaveBeenCalledTimes(1);
  });

  it("advances the game day by 1", async () => {
    vi.mocked(scheduledGameStore.listGamesForDay).mockResolvedValue([]);
    vi.mocked(leagueSeasonStore.advanceGameDay).mockResolvedValue(undefined);

    await simulateGameDay(makeLeagueSeason(), 3);

    expect(leagueSeasonStore.advanceGameDay).toHaveBeenCalledWith("lsn_1", 4);
  });

  it("commits career stats to GameHistoryStore for each simulated game", async () => {
    const { GameHistoryStore } = await import("@feat/careerStats/storage/gameHistoryStore");
    const games = [makeGame("g1")];
    vi.mocked(scheduledGameStore.listGamesForDay).mockResolvedValue(games);
    vi.mocked(scheduledGameStore.markScheduledGameCompleted).mockResolvedValue(undefined);
    vi.mocked(leagueSeasonStore.advanceGameDay).mockResolvedValue(undefined);

    await simulateGameDay(makeLeagueSeason(), 0);

    expect(GameHistoryStore.commitCompletedGame).toHaveBeenCalledTimes(1);
    const [gameId, meta] = vi.mocked(GameHistoryStore.commitCompletedGame).mock.calls[0];
    expect(gameId).toBe("game_inst_1");
    expect(meta).toMatchObject({
      homeTeamId: "team_home",
      awayTeamId: "team_away",
      homeScore: 5,
      awayScore: 3,
      leagueSeasonId: "lsn_1",
      scheduledGameId: "g1",
    });
  });

  it("stores inning runs on the ScheduledGameRecord for box score display", async () => {
    const games = [makeGame("g1")];
    vi.mocked(scheduledGameStore.listGamesForDay).mockResolvedValue(games);
    vi.mocked(scheduledGameStore.markScheduledGameCompleted).mockResolvedValue(undefined);
    vi.mocked(leagueSeasonStore.advanceGameDay).mockResolvedValue(undefined);

    await simulateGameDay(makeLeagueSeason(), 0);

    expect(scheduledGameStore.markScheduledGameCompleted).toHaveBeenCalledWith(
      "g1",
      "game_inst_1",
      expect.objectContaining({
        awayInningRuns: MOCK_FINAL_STATE.inningRuns[0],
        homeInningRuns: MOCK_FINAL_STATE.inningRuns[1],
      }),
    );
  });
});
