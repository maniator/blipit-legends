import { describe, expect, it } from "vitest";

import { generateSchedule } from "./scheduleGeneration";

describe("generateSchedule", () => {
  it("produces identical output when called multiple times with same inputs", () => {
    const opts = { leagueSeasonId: "ls1", teamIds: ["A", "B", "C", "D"] };
    const first = JSON.stringify(generateSchedule(opts));
    for (let i = 0; i < 99; i++) {
      expect(JSON.stringify(generateSchedule(opts))).toBe(first);
    }
  });

  it("never produces a game where awayTeamId === homeTeamId (for real games)", () => {
    const games = generateSchedule({
      leagueSeasonId: "ls1",
      teamIds: ["A", "B", "C", "D"],
    });
    const real = games.filter((g) => g.status !== "bye");
    real.forEach((g) => expect(g.awayTeamId).not.toBe(g.homeTeamId));
  });

  it("does not book a team in two non-bye games on the same game day", () => {
    const games = generateSchedule({
      leagueSeasonId: "ls1",
      teamIds: ["A", "B", "C", "D", "E", "F"],
    });
    const byDay = new Map<number, Set<string>>();
    for (const g of games) {
      if (g.status === "bye") continue;
      if (!byDay.has(g.gameDay)) byDay.set(g.gameDay, new Set());
      const teams = byDay.get(g.gameDay)!;
      expect(teams.has(g.awayTeamId)).toBe(false);
      expect(teams.has(g.homeTeamId)).toBe(false);
      teams.add(g.awayTeamId);
      teams.add(g.homeTeamId);
    }
  });

  it("gives all teams equal non-bye game counts with 5 teams", () => {
    const teamIds = ["A", "B", "C", "D", "E"];
    const games = generateSchedule({
      leagueSeasonId: "ls1",
      teamIds,
      gamesPerTeam: 30,
    });
    const counts = new Map<string, number>();
    for (const id of teamIds) counts.set(id, 0);
    for (const g of games) {
      if (g.status === "bye") continue;
      counts.set(g.awayTeamId, (counts.get(g.awayTeamId) ?? 0) + 1);
      counts.set(g.homeTeamId, (counts.get(g.homeTeamId) ?? 0) + 1);
    }
    const values = [...counts.values()];
    expect(values.every((v) => v === values[0])).toBe(true);
  });

  it("assigns unique IDs to all records", () => {
    const games = generateSchedule({
      leagueSeasonId: "ls1",
      teamIds: ["A", "B", "C", "D"],
    });
    const ids = games.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("meets the gamesPerTeam target for all teams", () => {
    const teamIds = ["A", "B", "C", "D"];
    const games = generateSchedule({
      leagueSeasonId: "ls1",
      teamIds,
      gamesPerTeam: 30,
    });
    const counts = new Map<string, number>();
    for (const id of teamIds) counts.set(id, 0);
    for (const g of games) {
      if (g.status === "bye") continue;
      counts.set(g.awayTeamId, (counts.get(g.awayTeamId) ?? 0) + 1);
      counts.set(g.homeTeamId, (counts.get(g.homeTeamId) ?? 0) + 1);
    }
    for (const [, count] of counts) {
      expect(count).toBeGreaterThanOrEqual(30);
    }
  });

  it("groups consecutive game days for the same matchup pair when seriesLength=3", () => {
    const games = generateSchedule({
      leagueSeasonId: "ls1",
      teamIds: ["A", "B"],
      seriesLength: 3,
      gamesPerTeam: 3,
    });
    const real = games.filter((g) => g.status !== "bye");
    // With 2 teams and seriesLength=3, should produce 3 consecutive game days
    const days = real.map((g) => g.gameDay).sort((a, b) => a - b);
    expect(days).toEqual([1, 2, 3]);
  });

  it("gives every team at least one bye and all bye records have status=bye (5 teams)", () => {
    const teamIds = ["A", "B", "C", "D", "E"];
    const games = generateSchedule({
      leagueSeasonId: "ls1",
      teamIds,
      gamesPerTeam: 10,
    });
    const byes = games.filter((g) => g.status === "bye");
    expect(byes.length).toBeGreaterThan(0);
    byes.forEach((g) => expect(g.status).toBe("bye"));
    // Every team should have at least one bye
    for (const id of teamIds) {
      expect(byes.some((g) => g.homeTeamId === id || g.awayTeamId === id)).toBe(true);
    }
  });
});
