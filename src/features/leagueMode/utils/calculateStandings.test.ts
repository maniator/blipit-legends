import { describe, expect, it } from "vitest";

import type { ScheduledGameRecord } from "../storage/types";
import { calculateStandings } from "./calculateStandings";

const makeGame = (
  overrides: Partial<ScheduledGameRecord> & { id: string },
): ScheduledGameRecord => ({
  leagueSeasonId: "lsn_1",
  gameDay: 0,
  awayTeamId: "team_away",
  homeTeamId: "team_home",
  status: "completed",
  schemaVersion: 0,
  ...overrides,
});

describe("calculateStandings", () => {
  it("returns empty array for empty teamIds", () => {
    expect(calculateStandings([], [])).toEqual([]);
  });

  it("returns zero stats for teams with no completed games", () => {
    const standings = calculateStandings([], ["team_a", "team_b"]);
    expect(standings).toHaveLength(2);
    expect(standings[0].wins).toBe(0);
    expect(standings[0].winPct).toBe(0);
  });

  it("correctly counts wins, losses, runs for home team win", () => {
    const games = [
      makeGame({
        id: "g1",
        awayTeamId: "team_a",
        homeTeamId: "team_b",
        winnerId: "team_b",
        homeScore: 5,
        awayScore: 2,
      }),
    ];
    const standings = calculateStandings(games, ["team_a", "team_b"]);
    const b = standings.find((s) => s.teamId === "team_b")!;
    const a = standings.find((s) => s.teamId === "team_a")!;
    expect(b.wins).toBe(1);
    expect(b.losses).toBe(0);
    expect(b.runsScored).toBe(5);
    expect(b.runsAllowed).toBe(2);
    expect(a.wins).toBe(0);
    expect(a.losses).toBe(1);
    expect(a.runsScored).toBe(2);
    expect(a.runsAllowed).toBe(5);
  });

  it("counts ties correctly", () => {
    const games = [
      makeGame({
        id: "g1",
        awayTeamId: "team_a",
        homeTeamId: "team_b",
        winnerId: "team_b",
        homeScore: 3,
        awayScore: 3,
      }),
    ];
    const standings = calculateStandings(games, ["team_a", "team_b"]);
    const a = standings.find((s) => s.teamId === "team_a")!;
    const b = standings.find((s) => s.teamId === "team_b")!;
    expect(a.ties).toBe(1);
    expect(b.ties).toBe(1);
    expect(a.wins).toBe(0);
    expect(b.wins).toBe(0);
  });

  it("skips games without winnerId or scores", () => {
    const games = [
      makeGame({ id: "g1", status: "scheduled", awayTeamId: "team_a", homeTeamId: "team_b" }),
    ];
    const standings = calculateStandings(games, ["team_a", "team_b"]);
    expect(standings.every((s) => s.gamesPlayed === 0)).toBe(true);
  });

  it("sorts by winPct descending, then runsScored descending", () => {
    const games = [
      makeGame({
        id: "g1",
        awayTeamId: "team_a",
        homeTeamId: "team_b",
        winnerId: "team_b",
        homeScore: 5,
        awayScore: 1,
      }),
      makeGame({
        id: "g2",
        awayTeamId: "team_b",
        homeTeamId: "team_a",
        winnerId: "team_a",
        homeScore: 3,
        awayScore: 2,
      }),
    ];
    const standings = calculateStandings(games, ["team_a", "team_b"]);
    // Both 1W 1L = .500, team_b scored 5+2=7 vs team_a 3+1=4 → team_b first
    expect(standings[0].teamId).toBe("team_b");
    expect(standings[1].teamId).toBe("team_a");
  });
});
