import { describe, expect, it } from "vitest";

import { simulateGame } from "./simulateGame";

const makeGame = (id = "sgame_1") => ({
  id,
  leagueSeasonId: "lsn_test",
  gameDay: 0,
  awayTeamId: "Away",
  homeTeamId: "Home",
  status: "scheduled" as const,
  schemaVersion: 0,
});

describe("simulateGame", () => {
  it("always ends with a result", async () => {
    const result = await simulateGame(makeGame(), "lsn_test");
    expect(typeof result.homeScore).toBe("number");
    expect(typeof result.awayScore).toBe("number");
    expect(result.winnerId).toBeTruthy();
    expect(result.loserId).toBeTruthy();
  });

  it("is deterministic — same game/season ID produces same result", async () => {
    const result1 = await simulateGame(makeGame(), "lsn_test");
    const result2 = await simulateGame(makeGame(), "lsn_test");
    expect(result1.homeScore).toBe(result2.homeScore);
    expect(result1.awayScore).toBe(result2.awayScore);
    expect(result1.winnerId).toBe(result2.winnerId);
  });

  it("produces different results for different game IDs", async () => {
    const results = await Promise.all([
      simulateGame(makeGame("sgame_1"), "lsn_test"),
      simulateGame(makeGame("sgame_2"), "lsn_test"),
      simulateGame(makeGame("sgame_3"), "lsn_test"),
    ]);
    const scores = results.map((r) => `${r.awayScore}-${r.homeScore}`);
    const uniqueScores = new Set(scores);
    // Very unlikely all three identical
    expect(uniqueScores.size).toBeGreaterThan(1);
  });

  it("sets isTie correctly", async () => {
    const result = await simulateGame(makeGame(), "lsn_test");
    expect(result.isTie).toBe(result.homeScore === result.awayScore);
  });

  it("winnerId is homeTeamId or awayTeamId", async () => {
    const game = makeGame();
    const result = await simulateGame(game, "lsn_test");
    expect([game.homeTeamId, game.awayTeamId]).toContain(result.winnerId);
    expect([game.homeTeamId, game.awayTeamId]).toContain(result.loserId);
  });
});
