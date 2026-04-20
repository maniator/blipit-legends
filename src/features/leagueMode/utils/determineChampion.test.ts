import { describe, expect, it } from "vitest";

import type { TeamStanding } from "./calculateStandings";
import { determineChampion } from "./determineChampion";

const makeStanding = (teamId: string, wins: number, losses: number): TeamStanding => {
  const gamesPlayed = wins + losses;
  return {
    teamId,
    wins,
    losses,
    ties: 0,
    gamesPlayed,
    winPct: gamesPlayed === 0 ? 0 : wins / gamesPlayed,
    runsScored: 0,
    runsAllowed: 0,
    runDifferential: 0,
  };
};

describe("determineChampion", () => {
  it("returns null for empty standings", () => {
    expect(determineChampion([])).toBeNull();
  });

  it("returns the teamId of the first entry in a single-team standings", () => {
    const standings = [makeStanding("team_a", 10, 2)];
    expect(determineChampion(standings)).toBe("team_a");
  });

  it("returns the teamId of the first entry (highest winPct) in normal standings", () => {
    const standings = [
      makeStanding("team_a", 10, 2), // .833
      makeStanding("team_b", 8, 4), // .667
      makeStanding("team_c", 5, 7), // .417
    ];
    expect(determineChampion(standings)).toBe("team_a");
  });

  it("respects sort stability for tied winPct — returns the first entry as-is", () => {
    // When two teams have identical winPct, pre-sorted standings determine
    // the winner by sort-stability (calculateStandings applies tie-break rules).
    // determineChampion always returns standings[0] regardless.
    const standings = [
      makeStanding("team_b", 5, 5), // .500 — first due to external tiebreak
      makeStanding("team_a", 5, 5), // .500
    ];
    expect(determineChampion(standings)).toBe("team_b");
  });

  it("works with a single team at zero wins", () => {
    const standings = [makeStanding("team_a", 0, 10)];
    expect(determineChampion(standings)).toBe("team_a");
  });
});
