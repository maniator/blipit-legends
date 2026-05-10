/**
 * Unit tests for selectPitchers (AI rotation policy).
 */
import type { SeasonPlayerStateRecord } from "@feat/league/storage/types";
import { describe, expect, it } from "vitest";

import { selectPitchers } from "./aiRotationPolicy";

const makeState = (
  playerId: string,
  overrides: Partial<SeasonPlayerStateRecord> = {},
): SeasonPlayerStateRecord => ({
  id: `sps_${playerId}`,
  seasonId: "s_season01",
  seasonTeamId: "st_home",
  playerId,
  pitcherDaysRest: 4,
  pitcherAvailability: 1.0,
  pitcherStartsThisSeason: 0,
  ...overrides,
});

const ROSTER_SNAP = {
  pitchers: [
    { id: "p_sp1", pitchingRole: "SP" },
    { id: "p_sp2", pitchingRole: "SP" },
    { id: "p_rp1", pitchingRole: "RP" },
    { id: "p_rp2", pitchingRole: "RP" },
  ],
};

const BASE = {
  seasonTeamId: "st_home",
  rosterSnapshot: ROSTER_SNAP,
  rulesetVersion: 1,
};

describe("selectPitchers — SP selection", () => {
  it("picks SP with fewest starts (cycle order) when all are eligible", () => {
    const states = [
      makeState("p_sp1", { pitcherStartsThisSeason: 5, pitcherAvailability: 1.0 }),
      makeState("p_sp2", { pitcherStartsThisSeason: 3, pitcherAvailability: 1.0 }),
    ];
    const result = selectPitchers({ ...BASE, playerStates: states });
    expect(result.startingPitcherId).toBe("p_sp2"); // fewer starts
  });

  it("skips SP with availability below threshold (0.70)", () => {
    const states = [
      makeState("p_sp1", { pitcherAvailability: 0.5, pitcherStartsThisSeason: 1 }),
      makeState("p_sp2", { pitcherAvailability: 1.0, pitcherStartsThisSeason: 2 }),
    ];
    const result = selectPitchers({ ...BASE, playerStates: states });
    expect(result.startingPitcherId).toBe("p_sp2"); // sp1 below threshold
  });

  it("falls back to highest-availability SP when ALL are below threshold", () => {
    const states = [
      makeState("p_sp1", { pitcherAvailability: 0.4, pitcherStartsThisSeason: 0 }),
      makeState("p_sp2", { pitcherAvailability: 0.6, pitcherStartsThisSeason: 0 }),
    ];
    const result = selectPitchers({ ...BASE, playerStates: states });
    expect(result.startingPitcherId).toBe("p_sp2"); // highest availability
  });

  it("returns null for SP if no SPs are in playerStates", () => {
    const states = [makeState("p_rp1", { pitcherAvailability: 1.0 })];
    const result = selectPitchers({ ...BASE, playerStates: states });
    expect(result.startingPitcherId).toBeNull();
  });
});

describe("selectPitchers — RP selection", () => {
  it("picks highest-availability eligible RP", () => {
    const states = [
      makeState("p_rp1", { pitcherAvailability: 0.5 }),
      makeState("p_rp2", { pitcherAvailability: 0.9 }),
    ];
    const result = selectPitchers({ ...BASE, playerStates: states });
    expect(result.relieverId).toBe("p_rp2");
  });

  it("returns null relieverId when no RP meets threshold (0.35)", () => {
    const states = [
      makeState("p_rp1", { pitcherAvailability: 0.1 }),
      makeState("p_rp2", { pitcherAvailability: 0.2 }),
    ];
    const result = selectPitchers({ ...BASE, playerStates: states });
    expect(result.relieverId).toBeNull();
  });

  it("returns null relieverId when no RP is in playerStates", () => {
    const states = [makeState("p_sp1", { pitcherAvailability: 1.0 })];
    const result = selectPitchers({ ...BASE, playerStates: states });
    expect(result.relieverId).toBeNull();
  });
});

describe("selectPitchers — combined", () => {
  it("returns both SP and RP when both are eligible", () => {
    const states = [
      makeState("p_sp1", { pitcherAvailability: 1.0 }),
      makeState("p_rp1", { pitcherAvailability: 0.8 }),
    ];
    const result = selectPitchers({ ...BASE, playerStates: states });
    expect(result.startingPitcherId).toBe("p_sp1");
    expect(result.relieverId).toBe("p_rp1");
  });
});
