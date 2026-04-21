import { describe, expect, it } from "vitest";

import type { LeagueSeasonRecord, ScheduledGameRecord } from "../storage/types";
import { isSeasonComplete } from "./isSeasonComplete";

const makeSeason = (overrides: Partial<LeagueSeasonRecord> = {}): LeagueSeasonRecord => ({
  id: "lsn_1",
  leagueId: "lg_1",
  seasonNumber: 1,
  status: "active",
  currentGameDay: 0,
  totalGameDays: 5,
  defaultGamesPerTeam: 10,
  seed: "test_seed",
  schemaVersion: 0,
  createdAt: 0,
  updatedAt: 0,
  ...overrides,
});

const makeGame = (id: string, status: ScheduledGameRecord["status"]): ScheduledGameRecord => ({
  id,
  leagueSeasonId: "lsn_1",
  gameDay: 0,
  awayTeamId: "team_away",
  homeTeamId: "team_home",
  status,
  schemaVersion: 0,
});

describe("isSeasonComplete", () => {
  it("returns true when all non-bye games are completed", () => {
    const games = [makeGame("g1", "completed"), makeGame("g2", "completed"), makeGame("g3", "bye")];
    expect(isSeasonComplete(makeSeason(), games)).toBe(true);
  });

  it("returns false when some non-bye games are still scheduled", () => {
    const games = [makeGame("g1", "completed"), makeGame("g2", "scheduled"), makeGame("g3", "bye")];
    expect(isSeasonComplete(makeSeason(), games)).toBe(false);
  });

  it("returns false when some non-bye games are scheduled (no byes)", () => {
    const games = [makeGame("g1", "completed"), makeGame("g2", "scheduled")];
    expect(isSeasonComplete(makeSeason(), games)).toBe(false);
  });

  it("returns true with bye-only games when day limit reached and no scheduled games", () => {
    const games = [makeGame("g1", "bye"), makeGame("g2", "bye")];
    const season = makeSeason({ currentGameDay: 5, totalGameDays: 5 });
    expect(isSeasonComplete(season, games)).toBe(true);
  });

  it("returns false with bye-only games when day limit not yet reached", () => {
    const games = [makeGame("g1", "bye"), makeGame("g2", "bye")];
    const season = makeSeason({ currentGameDay: 3, totalGameDays: 5 });
    expect(isSeasonComplete(season, games)).toBe(false);
  });

  it("returns true when day limit reached and no remaining scheduled games (all completed)", () => {
    const games = [makeGame("g1", "completed"), makeGame("g2", "completed")];
    const season = makeSeason({ currentGameDay: 5, totalGameDays: 5 });
    expect(isSeasonComplete(season, games)).toBe(true);
  });

  it("returns false when day limit reached but scheduled games remain", () => {
    const games = [makeGame("g1", "completed"), makeGame("g2", "scheduled")];
    const season = makeSeason({ currentGameDay: 5, totalGameDays: 5 });
    expect(isSeasonComplete(season, games)).toBe(false);
  });

  it("returns false when games list is empty and day limit not reached", () => {
    const season = makeSeason({ currentGameDay: 2, totalGameDays: 5 });
    expect(isSeasonComplete(season, [])).toBe(false);
  });

  it("returns true when games list is empty and day limit reached", () => {
    const season = makeSeason({ currentGameDay: 5, totalGameDays: 5 });
    expect(isSeasonComplete(season, [])).toBe(true);
  });
});
