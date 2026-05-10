/**
 * Unit tests for deriveStandings (pure standings deriver).
 */
import type { SeasonGameRecord } from "@feat/league/storage/types";
import { describe, expect, it } from "vitest";

import { deriveStandings } from "./deriveStandings";

let _gameIdCounter = 0;

const makeGame = (
  overrides: Partial<SeasonGameRecord> & {
    homeScore: number;
    awayScore: number;
  },
): SeasonGameRecord => ({
  id: `sg_test_${++_gameIdCounter}`,
  seasonId: "s_season01",
  gameDay: 0,
  homeSeasonTeamId: "st_a",
  awaySeasonTeamId: "st_b",
  seriesId: "ser_1",
  status: "completed",
  derivedSeed: "abc",
  completedAt: Date.now(),
  claimedBy: null,
  boxscore: { homeScore: overrides.homeScore, awayScore: overrides.awayScore },
  ...overrides,
});

const TEAMS = ["st_a", "st_b", "st_c"];

describe("deriveStandings", () => {
  it("returns zeroed rows for all teams when no games provided", () => {
    const rows = deriveStandings([], TEAMS);
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.wins).toBe(0);
      expect(row.losses).toBe(0);
      expect(row.ties).toBe(0);
      expect(row.winPct).toBe(0);
      expect(row.runDifferential).toBe(0);
    }
  });

  it("correctly accumulates win/loss/runDiff for a home win", () => {
    const game = makeGame({
      homeSeasonTeamId: "st_a",
      awaySeasonTeamId: "st_b",
      homeScore: 5,
      awayScore: 3,
    });
    const rows = deriveStandings([game], TEAMS);
    const a = rows.find((r) => r.seasonTeamId === "st_a")!;
    const b = rows.find((r) => r.seasonTeamId === "st_b")!;
    expect(a.wins).toBe(1);
    expect(a.losses).toBe(0);
    expect(a.runDifferential).toBe(2);
    expect(b.wins).toBe(0);
    expect(b.losses).toBe(1);
    expect(b.runDifferential).toBe(-2);
  });

  it("correctly handles a tie", () => {
    const game = makeGame({
      homeSeasonTeamId: "st_a",
      awaySeasonTeamId: "st_b",
      homeScore: 3,
      awayScore: 3,
    });
    const rows = deriveStandings([game], TEAMS);
    const a = rows.find((r) => r.seasonTeamId === "st_a")!;
    const b = rows.find((r) => r.seasonTeamId === "st_b")!;
    expect(a.ties).toBe(1);
    expect(b.ties).toBe(1);
    expect(a.wins).toBe(0);
    expect(b.wins).toBe(0);
  });

  it("winPct for a tie is 0.5", () => {
    const game = makeGame({
      homeSeasonTeamId: "st_a",
      awaySeasonTeamId: "st_b",
      homeScore: 2,
      awayScore: 2,
    });
    const rows = deriveStandings([game], TEAMS);
    const a = rows.find((r) => r.seasonTeamId === "st_a")!;
    expect(a.winPct).toBeCloseTo(0.5);
  });

  it("sorts by winPct DESC, then runDiff DESC", () => {
    const games = [
      makeGame({ homeSeasonTeamId: "st_a", awaySeasonTeamId: "st_b", homeScore: 5, awayScore: 1 }),
      makeGame({ homeSeasonTeamId: "st_c", awaySeasonTeamId: "st_b", homeScore: 3, awayScore: 1 }),
    ];
    const rows = deriveStandings(games, TEAMS);
    // st_a won by 4, st_c won by 2, st_b lost both
    expect(rows[0].seasonTeamId).toBe("st_a"); // highest winPct + runDiff
    expect(rows[1].seasonTeamId).toBe("st_c");
    expect(rows[2].seasonTeamId).toBe("st_b");
  });

  it("skips games that are not status=completed", () => {
    const game = makeGame({ homeScore: 5, awayScore: 1 });
    const scheduledGame = { ...game, status: "scheduled" as const, boxscore: null };
    const rows = deriveStandings([scheduledGame], TEAMS);
    expect(rows.every((r) => r.wins === 0)).toBe(true);
  });

  it("skips games with null boxscore", () => {
    const game = makeGame({ homeScore: 5, awayScore: 1 });
    const noBoxscore = { ...game, boxscore: null };
    const rows = deriveStandings([noBoxscore], TEAMS);
    expect(rows.every((r) => r.wins === 0)).toBe(true);
  });

  it("accumulates multiple games for the same team correctly", () => {
    const games = [
      makeGame({ homeSeasonTeamId: "st_a", awaySeasonTeamId: "st_b", homeScore: 3, awayScore: 1 }),
      makeGame({ homeSeasonTeamId: "st_a", awaySeasonTeamId: "st_c", homeScore: 2, awayScore: 4 }),
    ];
    const rows = deriveStandings(games, TEAMS);
    const a = rows.find((r) => r.seasonTeamId === "st_a")!;
    expect(a.wins).toBe(1);
    expect(a.losses).toBe(1);
    expect(a.runDifferential).toBe(0); // +2 then -2
    expect(a.winPct).toBeCloseTo(0.5);
  });
});
