import { Hit } from "@shared/constants/hitTypes";
import * as rngModule from "@shared/utils/rng";
import { afterEach, describe, expect, it, vi } from "vitest";

import { makeLogs, makeState, mockRandom } from "@test/testHelpers";

import { handleBallInPlay, hitBall } from "./hitBall";
import type { ModPreset, TeamCustomPlayerOverrides } from "./playerTypes";

afterEach(() => vi.restoreAllMocks());

const noop = () => {};

describe("hitBall", () => {
  it("single logs hit callout and places batter on 1st", () => {
    mockRandom(0);
    const { logs, log } = makeLogs();
    const next = hitBall(Hit.Single, makeState({ score: [0, 0], atBat: 0 }), log);
    expect(next.baseLayout[0]).toBe(1);
    expect(logs.some((l) => l.includes("base hit"))).toBe(true);
  });

  it("pop-out: randomNumber >= popOutThreshold causes out", () => {
    vi.spyOn(rngModule, "random").mockReturnValueOnce(0.999).mockReturnValueOnce(0.5);
    const { logs, log } = makeLogs();
    const next = hitBall(Hit.Single, makeState({ outs: 0 }), log);
    expect(next.outs).toBe(1);
    expect(logs.some((l) => l.includes("out"))).toBe(true);
  });

  it("homerun is never popped out", () => {
    mockRandom(0.999);
    const { log } = makeLogs();
    const next = hitBall(Hit.Homerun, makeState({ score: [0, 0], atBat: 0 }), log);
    expect(next.score[0]).toBe(1);
    expect(next.gameOver).toBe(false);
  });

  it("runsScored updates score correctly", () => {
    mockRandom(0);
    const { log } = makeLogs();
    const next = hitBall(
      Hit.Single,
      makeState({ baseLayout: [0, 0, 1], score: [2, 0], atBat: 0 }),
      log,
    );
    expect(next.score[0]).toBe(3);
  });
});

describe("hitBall — play log recording", () => {
  it("records a hit entry with correct batter number and event", () => {
    vi.spyOn(rngModule, "random").mockReturnValue(0);
    const next = hitBall(Hit.Double, makeState({ batterIndex: [3, 0], atBat: 0, inning: 2 }), noop);
    expect(next.playLog).toHaveLength(1);
    const entry = next.playLog[0];
    expect(entry.batterNum).toBe(4);
    expect(entry.event).toBe(Hit.Double);
    expect(entry.inning).toBe(2);
    expect(entry.half).toBe(0);
    expect(entry.team).toBe(0);
  });

  it("does NOT record an entry for a pop-out", () => {
    vi.spyOn(rngModule, "random").mockReturnValue(0.99);
    const next = hitBall(Hit.Single, makeState({ atBat: 0 }), noop);
    expect(next.playLog).toHaveLength(0);
  });

  it("walk is recorded in play log", () => {
    vi.spyOn(rngModule, "random").mockReturnValue(0);
    const next = hitBall(Hit.Walk, makeState({ batterIndex: [0, 0], atBat: 1, inning: 3 }), noop);
    expect(next.playLog).toHaveLength(1);
    expect(next.playLog[0].event).toBe(Hit.Walk);
    expect(next.playLog[0].half).toBe(1);
  });

  it("rotates batting order after a hit", () => {
    vi.spyOn(rngModule, "random").mockReturnValue(0);
    const next = hitBall(Hit.Single, makeState({ batterIndex: [6, 0] }), noop);
    expect(next.batterIndex[0]).toBe(7);
  });
});

describe("hitBall — RBI tracking", () => {
  it("single with no runners scores 0 RBI", () => {
    vi.spyOn(rngModule, "random").mockReturnValue(0);
    const next = hitBall(Hit.Single, makeState({ baseLayout: [0, 0, 0], atBat: 0 }), noop);
    expect(next.playLog[0].rbi).toBe(0);
  });

  it("single with runner on 3rd scores 1 RBI", () => {
    vi.spyOn(rngModule, "random").mockReturnValue(0);
    const next = hitBall(Hit.Single, makeState({ baseLayout: [0, 0, 1], atBat: 0 }), noop);
    expect(next.playLog[0].rbi).toBe(1);
  });

  it("double with runners on 2nd and 3rd scores 2 RBI", () => {
    vi.spyOn(rngModule, "random").mockReturnValue(0);
    const next = hitBall(Hit.Double, makeState({ baseLayout: [0, 1, 1], atBat: 0 }), noop);
    expect(next.playLog[0].rbi).toBe(2);
  });

  it("triple with bases loaded scores 3 RBI", () => {
    vi.spyOn(rngModule, "random").mockReturnValue(0);
    const next = hitBall(Hit.Triple, makeState({ baseLayout: [1, 1, 1], atBat: 0 }), noop);
    expect(next.playLog[0].rbi).toBe(3);
  });

  it("solo home run scores 1 RBI (batter only)", () => {
    vi.spyOn(rngModule, "random").mockReturnValue(0);
    const next = hitBall(Hit.Homerun, makeState({ baseLayout: [0, 0, 0], atBat: 0 }), noop);
    expect(next.playLog[0].rbi).toBe(1);
  });

  it("grand slam scores 4 RBI", () => {
    vi.spyOn(rngModule, "random").mockReturnValue(0);
    const next = hitBall(Hit.Homerun, makeState({ baseLayout: [1, 1, 1], atBat: 0 }), noop);
    expect(next.playLog[0].rbi).toBe(4);
  });

  it("bases-loaded walk scores 1 RBI", () => {
    vi.spyOn(rngModule, "random").mockReturnValue(0);
    const next = hitBall(Hit.Walk, makeState({ baseLayout: [1, 1, 1], atBat: 0 }), noop);
    expect(next.playLog[0].rbi).toBe(1);
  });

  it("walk with bases not loaded scores 0 RBI", () => {
    vi.spyOn(rngModule, "random").mockReturnValue(0);
    const next = hitBall(Hit.Walk, makeState({ baseLayout: [1, 0, 0], atBat: 0 }), noop);
    expect(next.playLog[0].rbi).toBe(0);
  });
});

describe("hitBall — handleGrounder (ground ball out paths)", () => {
  it("double play: runner on 1st, < 2 outs, DP roll < 65 → 2 outs recorded", () => {
    vi.spyOn(rngModule, "random")
      .mockReturnValueOnce(0.999) // main roll >= 750 → pop-out zone
      .mockReturnValueOnce(0.2) // ground ball check: 20 < 40 → handleGrounder
      .mockReturnValueOnce(0.5); // DP check: 50 < 65 → double play
    const { logs, log } = makeLogs();
    const next = hitBall(Hit.Single, makeState({ baseLayout: [1, 0, 0], outs: 0 }), log);
    expect(next.outs).toBe(2);
    expect(logs.some((l) => l.includes("double play"))).toBe(true);
  });

  it("fielder's choice: runner on 1st, DP roll >= 65 → 1 out, batter safe at 1st", () => {
    vi.spyOn(rngModule, "random")
      .mockReturnValueOnce(0.999) // main roll → pop-out zone
      .mockReturnValueOnce(0.2) // ground ball check → handleGrounder
      .mockReturnValueOnce(0.7); // DP check: 70 >= 65 → fielder's choice
    const { logs, log } = makeLogs();
    const next = hitBall(Hit.Single, makeState({ baseLayout: [1, 0, 0], outs: 0 }), log);
    expect(next.outs).toBe(1);
    expect(next.baseLayout[0]).toBe(1);
    expect(logs.some((l) => l.includes("fielder's choice"))).toBe(true);
  });

  it("simple ground out: no runner on 1st → out at first", () => {
    vi.spyOn(rngModule, "random")
      .mockReturnValueOnce(0.999) // main roll → pop-out zone
      .mockReturnValueOnce(0.2); // ground ball check → handleGrounder (no runner, simple out)
    const { logs, log } = makeLogs();
    const next = hitBall(Hit.Single, makeState({ baseLayout: [0, 0, 0], outs: 1 }), log);
    expect(next.outs).toBe(2);
    expect(logs.some((l) => l.includes("out at first"))).toBe(true);
  });

  it("power strategy: pop-out zone with roll < 15 → homerun override", () => {
    vi.spyOn(rngModule, "random")
      .mockReturnValueOnce(0.999) // main roll → pop-out zone (power threshold = 600)
      .mockReturnValueOnce(0.1); // power homerun check: 10 < 15 → homerun
    const { logs, log } = makeLogs();
    const next = hitBall(Hit.Single, makeState({ score: [0, 0], atBat: 0 }), log, "power");
    expect(next.score[0]).toBe(1);
    expect(logs.some((l) => l.includes("Home Run"))).toBe(true);
  });
});

describe("hitBall — inningRuns tracking", () => {
  it("records runs scored by team in the correct inning slot", () => {
    vi.spyOn(rngModule, "random").mockReturnValue(0);
    const next = hitBall(
      Hit.Single,
      makeState({ baseLayout: [0, 0, 1], atBat: 0, inning: 3 }),
      noop,
    );
    expect(next.inningRuns[0][2]).toBe(1);
  });

  it("does not mutate other inning slots", () => {
    vi.spyOn(rngModule, "random").mockReturnValue(0);
    const next = hitBall(
      Hit.Single,
      makeState({ baseLayout: [0, 0, 1], atBat: 0, inning: 5 }),
      noop,
    );
    expect(next.inningRuns[0][0]).toBeUndefined();
    expect(next.inningRuns[1][4]).toBeUndefined();
  });

  it("accumulates runs across multiple hits in the same inning", () => {
    vi.spyOn(rngModule, "random").mockReturnValue(0);
    const mid = hitBall(
      Hit.Single,
      makeState({ baseLayout: [0, 0, 1], atBat: 0, inning: 2 }),
      noop,
    );
    const final = hitBall(
      Hit.Single,
      { ...mid, baseLayout: [0, 0, 1] as [number, number, number] },
      noop,
    );
    expect(final.inningRuns[0][1]).toBe(2);
  });
});

describe("stat mods in hitBall", () => {
  it("high contactMod increases hit rate (higher pop-out threshold)", () => {
    // With contactMod=+20, threshold = 750 * 1.2 = 900; roll of 800 should be a hit
    // With contactMod=0, threshold = 750; roll of 800 should be an out
    const stateNoMod = makeState({ rosterPitchers: [[], []] as [string[], string[]] });
    const stateHighContact = makeState({
      playerOverrides: [{ b1: { contactMod: 20 as ModPreset } }, {}] as [
        TeamCustomPlayerOverrides,
        TeamCustomPlayerOverrides,
      ],
      lineupOrder: [["b1"], []] as [string[], string[]],
      rosterPitchers: [[], []] as [string[], string[]],
    });

    // Roll 800/1000: above 750 (no mod) → out; below 900 (contact mod) → hit
    // For no-mod out path: main roll=0.8 → 800, then grounder check=0.6 → 60>=40 → pop-out
    vi.spyOn(rngModule, "random").mockReturnValueOnce(0.8).mockReturnValueOnce(0.6);
    const resultNoMod = hitBall(Hit.Single, stateNoMod, () => {});
    expect(resultNoMod.outs).toBeGreaterThan(stateNoMod.outs);

    vi.spyOn(rngModule, "random").mockReturnValue(0.8);
    const resultHighContact = hitBall(Hit.Single, stateHighContact, () => {});
    expect(resultHighContact.baseLayout[0]).toBe(1);
  });

  it("high movementMod decreases hit rate (lower pop-out threshold)", () => {
    const stateNoPitcherMod = makeState({
      rosterPitchers: [[], ["pitcher1"]] as [string[], string[]],
      activePitcherIdx: [0, 0] as [number, number],
      playerOverrides: [{}, {}] as [TeamCustomPlayerOverrides, TeamCustomPlayerOverrides],
      atBat: 0,
    });
    const stateHighMovement = makeState({
      rosterPitchers: [[], ["pitcher1"]] as [string[], string[]],
      activePitcherIdx: [0, 0] as [number, number],
      playerOverrides: [{}, { pitcher1: { movementMod: 20 as ModPreset } }] as [
        TeamCustomPlayerOverrides,
        TeamCustomPlayerOverrides,
      ],
      atBat: 0,
    });

    // With movementMod=+20, threshold = 750 * 0.8 = 600
    // Roll 700/1000: below 750 (no mod) → hit; above 600 (movement mod) → out
    vi.spyOn(rngModule, "random").mockReturnValue(0.7);
    const resultNoPitcherMod = hitBall(Hit.Single, stateNoPitcherMod, () => {});
    expect(resultNoPitcherMod.baseLayout[0]).toBe(1); // hit

    // For movement mod out path: main roll=0.7 → 700>=600, then grounder check=0.6 → pop-out
    vi.spyOn(rngModule, "random").mockReturnValueOnce(0.7).mockReturnValueOnce(0.6);
    const resultHighMovement = hitBall(Hit.Single, stateHighMovement, () => {});
    expect(resultHighMovement.outs).toBeGreaterThan(stateHighMovement.outs);
  });

  it("pitcher fatigue raises pop-out threshold (tired pitcher → more hits)", () => {
    // Fresh pitcher (0 pitches thrown): fatigueFactor = 1.0, threshold = 750
    // Tired pitcher (100 pitches thrown): fatigueFactor = 1.0 + 0.009*(100-75) = 1.225,
    //   threshold ≈ Math.round(750*1.225) = 919
    // Roll 800/1000:
    //   fresh pitcher:  800 >= 750 → OUT
    //   tired pitcher:  800 < 919  → HIT
    const freshState = makeState({
      rosterPitchers: [[], []] as [string[], string[]],
      pitcherPitchCount: [0, 0] as [number, number],
      pitcherBattersFaced: [0, 0] as [number, number],
    });
    const tiredState = makeState({
      rosterPitchers: [[], []] as [string[], string[]],
      pitcherPitchCount: [0, 100] as [number, number], // pitching team is 1 (atBat=0)
      pitcherBattersFaced: [0, 0] as [number, number],
    });

    // Fresh: roll=0.8 → 800 >= 750 → out (then grounder check=0.6 → pop-out)
    vi.spyOn(rngModule, "random").mockReturnValueOnce(0.8).mockReturnValueOnce(0.6);
    const freshResult = hitBall(Hit.Single, freshState, () => {});
    expect(freshResult.outs).toBe(1);

    // Tired: roll=0.8 → 800 < 919 → hit
    vi.spyOn(rngModule, "random").mockReturnValue(0.8);
    const tiredResult = hitBall(Hit.Single, tiredState, () => {});
    expect(tiredResult.baseLayout[0]).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// baseRunnerIds correctness in grounder paths
// ---------------------------------------------------------------------------

describe("hitBall — baseRunnerIds in grounder paths", () => {
  it("fielder's choice: batter's playerId placed on 1st in baseRunnerIds", () => {
    vi.spyOn(rngModule, "random")
      .mockReturnValueOnce(0.999) // main roll → pop-out zone
      .mockReturnValueOnce(0.2) // ground ball check → handleGrounder
      .mockReturnValueOnce(0.7); // DP check: 70 >= 65 → fielder's choice
    const state = makeState({
      baseLayout: [1, 0, 0],
      outs: 0,
      lineupOrder: [["batter_fc", "b2", "b3", "b4", "b5", "b6", "b7", "b8", "b9"], []],
      batterIndex: [0, 0],
      baseRunnerIds: ["old_runner", null, null],
    });
    const next = hitBall(Hit.Single, state, () => {});
    // Batter (batter_fc) should now be on 1st; old runner was forced out
    expect(next.baseLayout[0]).toBe(1);
    expect(next.baseRunnerIds[0]).toBe("batter_fc");
  });

  it("double play: baseRunnerIds[0] is cleared (runner forced out, batter out)", () => {
    vi.spyOn(rngModule, "random")
      .mockReturnValueOnce(0.999) // main roll → pop-out zone
      .mockReturnValueOnce(0.2) // ground ball check → handleGrounder
      .mockReturnValueOnce(0.5); // DP check: 50 < 65 → double play
    const state = makeState({
      baseLayout: [1, 0, 0],
      outs: 0,
      baseRunnerIds: ["dp_runner", null, null],
    });
    const next = hitBall(Hit.Single, state, () => {});
    expect(next.outs).toBe(2);
    expect(next.baseRunnerIds[0]).toBeNull();
  });

  it("simple ground out: baseRunnerIds unchanged (no base changes)", () => {
    vi.spyOn(rngModule, "random")
      .mockReturnValueOnce(0.999) // main roll → pop-out zone
      .mockReturnValueOnce(0.2); // ground ball check → handleGrounder (no runner on 1st)
    const state = makeState({
      baseLayout: [0, 1, 0],
      outs: 0,
      baseRunnerIds: [null, "runner_2nd", null],
    });
    const next = hitBall(Hit.Single, state, () => {});
    // 2nd base runner unaffected; batter is out
    expect(next.baseRunnerIds[1]).toBe("runner_2nd");
  });
});

describe("handleBallInPlay — strategy effects", () => {
  it("power strategy lowers HR threshold on deep_fly (more HRs at roll=700)", () => {
    // Default hrThreshold=720: roll=700 → triple. Power: hrThreshold=690 → HR.
    const state = makeState({ score: [0, 0] });

    vi.spyOn(rngModule, "random").mockReturnValue(0.7); // roll=700
    const { logs: balancedLogs } = makeLogs();
    handleBallInPlay("deep_fly", state, balancedLogs.push.bind(balancedLogs));
    const isTriple = balancedLogs.some((l) => l.includes("triple"));

    vi.spyOn(rngModule, "random").mockReturnValue(0.7); // roll=700 again
    const { logs: powerLogs } = makeLogs();
    handleBallInPlay("deep_fly", state, powerLogs.push.bind(powerLogs), { strategy: "power" });
    const isHR = powerLogs.some((l) => l.includes("home run") || l.includes("GONE"));

    expect(isTriple).toBe(true);
    expect(isHR).toBe(true);
  });

  it("aggressive strategy scores runner from 2nd more often on single (higher advance mod)", () => {
    // aggressive: stratMod(advance)=1.3 → scoreChance=round(60*1.3)=78 vs balanced=60.
    // With roll forced below 60 → both score; roll between 60-78 → only aggressive scores.
    // Use roll=0.65 → getRandomInt(100)=65. Balanced: 65 ≥ 60 → no score. Aggressive: 65 < 78 → score.
    const state = makeState({ baseLayout: [0, 1, 0], score: [0, 0] });

    // two random calls: main outcome roll (must be single), then scoreChance roll
    vi.spyOn(rngModule, "random")
      .mockReturnValueOnce(0.3) // outcome roll → 300 → line_drive single
      .mockReturnValueOnce(0.65); // scoreChance roll
    const { logs: balancedLogs, log: balLog } = makeLogs();
    handleBallInPlay("line_drive", state, balLog);
    const balancedScored = balancedLogs.some((l) => l.includes("scores"));

    vi.spyOn(rngModule, "random")
      .mockReturnValueOnce(0.3) // outcome roll → 300 → line_drive single
      .mockReturnValueOnce(0.65); // scoreChance roll
    const { logs: aggressiveLogs, log: aggLog } = makeLogs();
    handleBallInPlay("line_drive", state, aggLog, { strategy: "aggressive" });
    const aggressiveScored = aggressiveLogs.some((l) => l.includes("scores"));

    expect(balancedScored).toBe(false);
    expect(aggressiveScored).toBe(true);
  });
});

describe("batter plate appearance tracking in hitBall", () => {
  it("increments PA count for the batter on Hit.Single (confirmed hit)", () => {
    mockRandom(0);
    const state = makeState({ lineupOrder: [["batter-1", "batter-2"], []], atBat: 0 });
    const next = hitBall(Hit.Single, state, noop);
    expect(next.batterPlateAppearances[0]["batter-1"]).toBe(1);
  });

  it("increments PA count for the batter on Hit.Walk (no pop-out check)", () => {
    mockRandom(0);
    const state = makeState({ lineupOrder: [["batter-1", "batter-2"], []], atBat: 0 });
    const next = hitBall(Hit.Walk, state, noop);
    expect(next.batterPlateAppearances[0]["batter-1"]).toBe(1);
  });

  it("increments PA count for the batter on Hit.Homerun (no pop-out check)", () => {
    mockRandom(0);
    const state = makeState({ lineupOrder: [["batter-1", "batter-2"], []], atBat: 0 });
    const next = hitBall(Hit.Homerun, state, noop);
    expect(next.batterPlateAppearances[0]["batter-1"]).toBe(1);
  });

  it("does not increment the opposing team's PA map", () => {
    mockRandom(0);
    const state = makeState({
      lineupOrder: [["batter-1"], ["opp-1"]],
      atBat: 0,
    });
    const next = hitBall(Hit.Walk, state, noop);
    expect(next.batterPlateAppearances[0]["batter-1"]).toBe(1);
    expect(next.batterPlateAppearances[1]).toEqual({});
  });

  it("accumulates PA count correctly when batter already has prior plate appearances", () => {
    mockRandom(0);
    const state = makeState({
      lineupOrder: [["batter-1"], []],
      atBat: 0,
      batterPlateAppearances: [{ "batter-1": 3 }, {}],
    });
    const next = hitBall(Hit.Walk, state, noop);
    expect(next.batterPlateAppearances[0]["batter-1"]).toBe(4);
  });
});
