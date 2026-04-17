import { describe, expect, it } from "vitest";

import { makeState } from "@test/testHelpers";

import { resolveBatterPlayerId } from "./resolveBatterPlayerId";

describe("resolveBatterPlayerId", () => {
  it("returns lineupOrder ID when present", () => {
    const state = makeState({
      teams: ["Away Team", "Home Team"],
      lineupOrder: [["away_custom_b2"], []],
    });

    expect(resolveBatterPlayerId(state, 0, 0)).toBe("away_custom_b2");
  });

  it("falls back to generated roster batter ID when lineup is missing", () => {
    const state = makeState({
      teams: ["Away Team", "Home Team"],
      lineupOrder: [[], []],
    });

    expect(resolveBatterPlayerId(state, 0, 3)).toBe("away_team_b3");
  });

  it("falls back to slug format when generated batter is missing/out-of-range", () => {
    const state = makeState({
      teams: ["  New.York   --- Mets!!  ", "Home Team"],
      lineupOrder: [[], []],
    });

    expect(resolveBatterPlayerId(state, 0, 99)).toBe("new_york_mets_b99");
  });
});
