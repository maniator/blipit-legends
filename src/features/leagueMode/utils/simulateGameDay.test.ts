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

vi.mock("./simulateGame", () => ({
  simulateGame: vi.fn().mockResolvedValue({
    homeScore: 5,
    awayScore: 3,
    winnerId: "team_home",
    loserId: "team_away",
    isTie: false,
  }),
}));

import { leagueSeasonStore } from "../storage/leagueSeasonStore";
import { scheduledGameStore } from "../storage/scheduledGameStore";
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
  schemaVersion: 1,
});

describe("simulateGameDay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
