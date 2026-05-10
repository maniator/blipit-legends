/**
 * Unit tests for computePitcherFatigueUpdates.
 */
import type { SeasonPlayerStateRecord } from "@feat/league/storage/types";
import { describe, expect, it } from "vitest";

import { computePitcherFatigueUpdates } from "./updatePitcherFatigue";

const makePlayerState = (overrides: Partial<SeasonPlayerStateRecord>): SeasonPlayerStateRecord => ({
  id: `sps_${overrides.playerId ?? "default"}`,
  seasonId: "s_season01",
  seasonTeamId: "st_home",
  playerId: "p_default",
  pitcherDaysRest: 3,
  pitcherAvailability: 1.0,
  pitcherStartsThisSeason: 0,
  ...overrides,
});

const BASE_INPUT = {
  seasonId: "s_season01",
  rulesetVersion: 1,
  winnerSeasonTeamId: "st_home",
  loserSeasonTeamId: "st_away",
  winnerStartingPitcherId: "p_sp_home",
  loserStartingPitcherId: "p_sp_away",
  rosterSnapshotBySeasonTeamId: {
    st_home: {
      pitchers: [
        { id: "p_sp_home", pitchingRole: "SP" },
        { id: "p_rp_home", pitchingRole: "RP" },
      ],
    },
    st_away: {
      pitchers: [
        { id: "p_sp_away", pitchingRole: "SP" },
        { id: "p_rp_away", pitchingRole: "RP" },
      ],
    },
  },
};

describe("computePitcherFatigueUpdates", () => {
  it("SP who appeared gets pitcherDaysRest=0 and availability=0.1 (spRecovery[0])", () => {
    const states = [makePlayerState({ playerId: "p_sp_home", seasonTeamId: "st_home" })];
    const patches = computePitcherFatigueUpdates({ ...BASE_INPUT, allPlayerStates: states });

    const patch = patches.find((p) => p.id === "sps_p_sp_home");
    expect(patch?.pitcherDaysRest).toBe(0);
    expect(patch?.pitcherAvailability).toBeCloseTo(0.1);
  });

  it("RP who did NOT appear gets pitcherDaysRest incremented", () => {
    const states = [
      makePlayerState({
        id: "sps_p_rp_home",
        playerId: "p_rp_home",
        seasonTeamId: "st_home",
        pitcherDaysRest: 1,
        pitcherAvailability: 0.8,
      }),
    ];
    const patches = computePitcherFatigueUpdates({ ...BASE_INPUT, allPlayerStates: states });

    const patch = patches.find((p) => p.id === "sps_p_rp_home");
    expect(patch?.pitcherDaysRest).toBe(2);
    // rpRecovery[2] = 0.95
    expect(patch?.pitcherAvailability).toBeCloseTo(0.95);
  });

  it("RP with 3+ days rest returns availability 1.0", () => {
    const states = [
      makePlayerState({
        id: "sps_p_rp_away",
        playerId: "p_rp_away",
        seasonTeamId: "st_away",
        pitcherDaysRest: 2,
        pitcherAvailability: 0.95,
      }),
    ];
    const patches = computePitcherFatigueUpdates({ ...BASE_INPUT, allPlayerStates: states });

    const patch = patches.find((p) => p.id === "sps_p_rp_away");
    // daysRest was 2, increments to 3 → 1.0
    expect(patch?.pitcherDaysRest).toBe(3);
    expect(patch?.pitcherAvailability).toBeCloseTo(1.0);
  });

  it("SP with 4+ days rest returns availability 1.0 (cap at spRecovery[4])", () => {
    const states = [
      makePlayerState({
        id: "sps_p_sp_bench",
        playerId: "p_sp_bench",
        seasonTeamId: "st_home",
        pitcherDaysRest: 4,
        pitcherAvailability: 1.0,
      }),
    ];
    const snapshots = {
      st_home: {
        pitchers: [
          { id: "p_sp_home", pitchingRole: "SP" },
          { id: "p_rp_home", pitchingRole: "RP" },
          { id: "p_sp_bench", pitchingRole: "SP" },
        ],
      },
    };
    const patches = computePitcherFatigueUpdates({
      ...BASE_INPUT,
      allPlayerStates: states,
      rosterSnapshotBySeasonTeamId: snapshots,
    });

    const patch = patches.find((p) => p.id === "sps_p_sp_bench");
    expect(patch?.pitcherDaysRest).toBe(5);
    // capped at min(5, 4) = 4 → spRecovery[4] = 1.0
    expect(patch?.pitcherAvailability).toBeCloseTo(1.0);
  });

  it("'SP/RP' role is treated as SP for recovery curve", () => {
    const states = [
      makePlayerState({
        id: "sps_p_tworoles",
        playerId: "p_tworoles",
        seasonTeamId: "st_home",
        pitcherDaysRest: 1,
        pitcherAvailability: 0.2,
      }),
    ];
    const snapshots = {
      st_home: { pitchers: [{ id: "p_tworoles", pitchingRole: "SP/RP" }] },
    };
    const patches = computePitcherFatigueUpdates({
      ...BASE_INPUT,
      allPlayerStates: states,
      rosterSnapshotBySeasonTeamId: snapshots,
    });

    const patch = patches.find((p) => p.id === "sps_p_tworoles");
    expect(patch?.pitcherDaysRest).toBe(2);
    // SP recovery curve: spRecovery[2] = 0.4
    expect(patch?.pitcherAvailability).toBeCloseTo(0.4);
  });

  it("returns one patch per input player state", () => {
    const states = [
      makePlayerState({ playerId: "p_sp_home", seasonTeamId: "st_home" }),
      makePlayerState({ playerId: "p_rp_home", seasonTeamId: "st_home", id: "sps_p_rp_home" }),
    ];
    const patches = computePitcherFatigueUpdates({ ...BASE_INPUT, allPlayerStates: states });
    expect(patches.length).toBe(2);
  });
});
