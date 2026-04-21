import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LeagueSeasonRecord, ScheduledGameRecord } from "../storage/types";

vi.mock("../storage/scheduledGameStore", () => ({
  scheduledGameStore: {
    listGamesForDay: vi.fn(),
    listGamesForSeason: vi.fn().mockResolvedValue([]),
    getScheduledGame: vi.fn(),
  },
}));

vi.mock("../storage/leagueSeasonStore", () => ({
  leagueSeasonStore: {
    advanceGameDay: vi.fn().mockResolvedValue(undefined),
    getLeagueSeason: vi.fn().mockResolvedValue(null),
    markSeasonComplete: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../storage/leagueStore", () => ({
  leagueStore: {
    getLeague: vi.fn().mockResolvedValue(null),
    archiveLeague: vi.fn().mockResolvedValue(undefined),
  },
}));

import { leagueSeasonStore } from "../storage/leagueSeasonStore";
import { scheduledGameStore } from "../storage/scheduledGameStore";
import { advanceGameDayIfComplete } from "./advanceGameDayIfComplete";

const makeSeason = (overrides?: Partial<LeagueSeasonRecord>): LeagueSeasonRecord => ({
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
  ...overrides,
});

const makeGame = (
  id: string,
  status: ScheduledGameRecord["status"],
  gameDay = 0,
): ScheduledGameRecord => ({
  id,
  leagueSeasonId: "lsn_1",
  gameDay,
  awayTeamId: "team_away",
  homeTeamId: "team_home",
  status,
  schemaVersion: 1,
});

describe("advanceGameDayIfComplete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(leagueSeasonStore.advanceGameDay).mockResolvedValue(undefined);
    vi.mocked(leagueSeasonStore.getLeagueSeason).mockResolvedValue(null);
    vi.mocked(scheduledGameStore.listGamesForSeason).mockResolvedValue([]);
  });

  it("advances currentGameDay when all games on the day are completed", async () => {
    vi.mocked(scheduledGameStore.listGamesForDay).mockResolvedValue([
      makeGame("g1", "completed"),
      makeGame("g2", "completed"),
    ]);

    await advanceGameDayIfComplete("lsn_1", 0);

    expect(leagueSeasonStore.advanceGameDay).toHaveBeenCalledWith("lsn_1", 1);
  });

  it("advances currentGameDay when all games are completed or bye", async () => {
    vi.mocked(scheduledGameStore.listGamesForDay).mockResolvedValue([
      makeGame("g1", "completed"),
      makeGame("g2", "bye"),
    ]);

    await advanceGameDayIfComplete("lsn_1", 2);

    expect(leagueSeasonStore.advanceGameDay).toHaveBeenCalledWith("lsn_1", 3);
  });

  it("does NOT advance when scheduled games remain on the day", async () => {
    vi.mocked(scheduledGameStore.listGamesForDay).mockResolvedValue([
      makeGame("g1", "completed"),
      makeGame("g2", "scheduled"),
    ]);

    await advanceGameDayIfComplete("lsn_1", 0);

    expect(leagueSeasonStore.advanceGameDay).not.toHaveBeenCalled();
  });

  it("advances even when the day has no games (vacuously complete)", async () => {
    vi.mocked(scheduledGameStore.listGamesForDay).mockResolvedValue([]);

    await advanceGameDayIfComplete("lsn_1", 0);

    expect(leagueSeasonStore.advanceGameDay).toHaveBeenCalledWith("lsn_1", 1);
  });

  it("finalizes the season when all games are now done", async () => {
    vi.mocked(scheduledGameStore.listGamesForDay).mockResolvedValue([makeGame("g1", "completed")]);

    const completedGame = makeGame("g1", "completed");
    vi.mocked(scheduledGameStore.listGamesForSeason).mockResolvedValue([completedGame]);

    const activeSeason = makeSeason({ currentGameDay: 5, totalGameDays: 5 });
    vi.mocked(leagueSeasonStore.getLeagueSeason).mockResolvedValue(activeSeason);

    const { leagueStore } = await import("../storage/leagueStore");
    vi.mocked(leagueStore.getLeague).mockResolvedValue({
      id: "lg_1",
      name: "Test League",
      teamIds: ["team_away", "team_home"],
      divisionCount: 1,
      status: "active",
      schemaVersion: 0,
      createdAt: 0,
      updatedAt: 0,
    });

    await advanceGameDayIfComplete("lsn_1", 0);

    expect(leagueSeasonStore.markSeasonComplete).toHaveBeenCalled();
    expect(leagueStore.archiveLeague).toHaveBeenCalledWith("lg_1");
  });

  it("does NOT finalize the season when games remain", async () => {
    vi.mocked(scheduledGameStore.listGamesForDay).mockResolvedValue([makeGame("g1", "completed")]);
    vi.mocked(scheduledGameStore.listGamesForSeason).mockResolvedValue([
      makeGame("g1", "completed"),
      makeGame("g2", "scheduled"),
    ]);
    vi.mocked(leagueSeasonStore.getLeagueSeason).mockResolvedValue(makeSeason());

    await advanceGameDayIfComplete("lsn_1", 0);

    expect(leagueSeasonStore.markSeasonComplete).not.toHaveBeenCalled();
  });
});
