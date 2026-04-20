/**
 * Tests for src/Context/reducer.ts
 */

import { Hit } from "@shared/constants/hitTypes";
import * as rngModule from "@shared/utils/rng";
import { afterEach, describe, expect, it, vi } from "vitest";

import { makeReducer, makeState } from "@test/testHelpers";

import { advanceRunners } from "./advanceRunners";
import type { DecisionType } from "./decisionTypes";
import type { State } from "./gameStateTypes";
import { DEFAULT_MANAGER_DECISION_VALUES } from "./managerDecisionValues";
import type { ModPreset, TeamCustomPlayerOverrides } from "./playerTypes";
import { canProcessActionAfterGameOver, detectDecision } from "./reducer";

afterEach(() => vi.restoreAllMocks());

const dispatchAction = (state: State, type: string, payload?: any) => {
  const { reducer, logs } = makeReducer();
  const next = reducer(state, { type, payload });
  return { state: next, logs };
};

const mockRandom = (value: number) => vi.spyOn(rngModule, "random").mockReturnValue(value);

/** Lineup with 9 named players — p1…p9 for away, ph1…ph9 for home. */
const NINE_AWAY: [string[], string[]] = [
  ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9"],
  [],
];
const NINE_HOME: [string[], string[]] = [
  [],
  ["ph1", "ph2", "ph3", "ph4", "ph5", "ph6", "ph7", "ph8", "ph9"],
];

// triple scoring (bug fix)
describe("hit - triple runner scoring", () => {
  it("runner on 3rd scores on triple", () => {
    // line_drive + roll 900 → triple (850–929 range).
    mockRandom(0.9);
    const { state, logs } = dispatchAction(
      makeState({ baseLayout: [0, 0, 1], score: [0, 0] }),
      "hit",
      { battedBallType: "line_drive", strategy: "balanced" },
    );
    expect(state.score[0]).toBe(1);
    expect(state.baseLayout[2]).toBe(1);
    expect(state.baseLayout[0]).toBe(0);
    expect(logs.some((l) => l.includes("run"))).toBe(true);
  });
  it("two runners both score on triple", () => {
    mockRandom(0.9);
    const { state, logs } = dispatchAction(
      makeState({ baseLayout: [1, 1, 0], score: [0, 0] }),
      "hit",
      { battedBallType: "line_drive", strategy: "balanced" },
    );
    expect(state.score[0]).toBe(2);
    expect(state.baseLayout[2]).toBe(1);
    expect(state.baseLayout[0]).toBe(0);
    expect(logs.some((l) => l.includes("2 runs"))).toBe(true);
  });
  it("bases loaded triple scores 3", () => {
    mockRandom(0.9);
    const { state } = dispatchAction(makeState({ baseLayout: [1, 1, 1], score: [0, 0] }), "hit", {
      battedBallType: "line_drive",
      strategy: "balanced",
    });
    expect(state.score[0]).toBe(3);
    expect(state.baseLayout[2]).toBe(1);
    expect(state.baseLayout[0]).toBe(0);
  });
  it("empty bases triple: batter on 3rd, 0 runs", () => {
    mockRandom(0.9);
    const { state } = dispatchAction(makeState({ baseLayout: [0, 0, 0] }), "hit", {
      battedBallType: "line_drive",
      strategy: "balanced",
    });
    expect(state.score[0]).toBe(0);
    expect(state.baseLayout[2]).toBe(1);
  });
});

// double
describe("hit - double", () => {
  it("runner on 3rd scores", () => {
    // line_drive + roll 700 → double (650–849 range).
    mockRandom(0.7);
    const { state } = dispatchAction(makeState({ baseLayout: [0, 0, 1] }), "hit", {
      battedBallType: "line_drive",
      strategy: "balanced",
    });
    expect(state.score[0]).toBe(1);
    expect(state.baseLayout[1]).toBe(1);
  });
  it("runners on 2nd and 3rd both score", () => {
    mockRandom(0.7);
    const { state } = dispatchAction(makeState({ baseLayout: [0, 1, 1] }), "hit", {
      battedBallType: "line_drive",
      strategy: "balanced",
    });
    expect(state.score[0]).toBe(2);
    expect(state.baseLayout[1]).toBe(1);
    expect(state.baseLayout[2]).toBe(0);
  });
  it("runner on 1st goes to 3rd", () => {
    // line_drive + roll 700 → double; runner on 1st: scoreChance≈30%, roll 0.5→50 >= 30 → no score.
    vi.spyOn(rngModule, "random")
      .mockReturnValueOnce(0.7) // outcome roll: 700 → double
      .mockReturnValue(0.5); // subsequent rolls: 50 >= 30 → runner stays on base
    const { state } = dispatchAction(makeState({ baseLayout: [1, 0, 0] }), "hit", {
      battedBallType: "line_drive",
      strategy: "balanced",
    });
    expect(state.score[0]).toBe(0);
    expect(state.baseLayout[2]).toBe(1);
    expect(state.baseLayout[1]).toBe(1);
  });
});

// single
describe("hit - single", () => {
  it("runner on 3rd scores", () => {
    // line_drive + roll 300 → single (150–649 range).
    mockRandom(0.3);
    const { state } = dispatchAction(makeState({ baseLayout: [0, 0, 1] }), "hit", {
      battedBallType: "line_drive",
      strategy: "balanced",
    });
    expect(state.score[0]).toBe(1);
    expect(state.baseLayout[0]).toBe(1);
  });
  it("runner on 2nd goes to 3rd", () => {
    // line_drive + roll 300 → single; runner on 2nd: scoreChance≈60%, roll 0.8→80 >= 60 → no score.
    vi.spyOn(rngModule, "random")
      .mockReturnValueOnce(0.3) // outcome roll: 300 → single
      .mockReturnValue(0.8); // subsequent rolls: 80 >= 60 → runner stays on 2nd → advances to 3rd
    const { state } = dispatchAction(makeState({ baseLayout: [0, 1, 0] }), "hit", {
      battedBallType: "line_drive",
      strategy: "balanced",
    });
    expect(state.baseLayout[2]).toBe(1);
    expect(state.baseLayout[1]).toBe(0);
  });
  it("runner on 1st goes to 2nd", () => {
    // line_drive + roll 300 → single; stretch check: chance≈28%, roll 0.8→80 >= 28 → no stretch.
    vi.spyOn(rngModule, "random")
      .mockReturnValueOnce(0.3) // outcome roll: 300 → single
      .mockReturnValue(0.8); // subsequent rolls: 80 >= 28 → no stretch to 3rd
    const { state } = dispatchAction(makeState({ baseLayout: [1, 0, 0] }), "hit", {
      battedBallType: "line_drive",
      strategy: "balanced",
    });
    expect(state.baseLayout[1]).toBe(1);
    expect(state.baseLayout[0]).toBe(1);
  });
});

// home run
describe("hit - home run", () => {
  it("grand slam scores 4", () => {
    // deep_fly + roll 800 → HR (770–999 range).
    mockRandom(0.8);
    const { state } = dispatchAction(makeState({ baseLayout: [1, 1, 1] }), "hit", {
      battedBallType: "deep_fly",
      strategy: "balanced",
    });
    expect(state.score[0]).toBe(4);
    expect(state.baseLayout).toEqual([0, 0, 0]);
  });
  it("solo HR scores 1", () => {
    mockRandom(0.8);
    const { state } = dispatchAction(makeState({ score: [3, 2] }), "hit", {
      battedBallType: "deep_fly",
      strategy: "balanced",
    });
    expect(state.score[0]).toBe(4);
  });
});

// walk — tested via intentional_walk (walks never go through the "hit" contact path)
describe("hit - walk", () => {
  it("bases empty: batter to 1st, no runs", () => {
    mockRandom(0);
    const { state } = dispatchAction(makeState(), "intentional_walk");
    expect(state.baseLayout[0]).toBe(1);
    expect(state.score[0]).toBe(0);
  });
  it("runner on 1st: force to 2nd", () => {
    mockRandom(0);
    const { state } = dispatchAction(makeState({ baseLayout: [1, 0, 0] }), "intentional_walk");
    expect(state.baseLayout[0]).toBe(1);
    expect(state.baseLayout[1]).toBe(1);
    expect(state.score[0]).toBe(0);
  });
  it("runner on 3rd only: stays, no force", () => {
    mockRandom(0);
    const { state } = dispatchAction(makeState({ baseLayout: [0, 0, 1] }), "intentional_walk");
    expect(state.baseLayout[0]).toBe(1);
    expect(state.baseLayout[2]).toBe(1);
    expect(state.score[0]).toBe(0);
  });
  it("bases loaded: run scores", () => {
    mockRandom(0);
    const { state } = dispatchAction(makeState({ baseLayout: [1, 1, 1] }), "intentional_walk");
    expect(state.score[0]).toBe(1);
    expect(state.baseLayout).toEqual([1, 1, 1]);
  });
  it("walk is NEVER turned into a pop-out even when random is high (regression)", () => {
    // intentional_walk calls hitBall(Hit.Walk) which explicitly bypasses the pop-out check.
    vi.spyOn(rngModule, "random").mockReturnValue(0.9);
    const { state, logs } = dispatchAction(
      makeState({ baseLayout: [0, 0, 0] }),
      "intentional_walk",
    );
    // Batter must be on 1st — NOT an out
    expect(state.baseLayout[0]).toBe(1);
    expect(state.outs).toBe(0);
    expect(logs.some((l) => /pop out/i.test(l))).toBe(false);
  });
  it("ball 4 walk with high random: runner reaches base (regression)", () => {
    // Simulate: first random call (wait→ball path) → 0.9 (high → ball), then hitBall
    // gets another high random → old code would have produced a pop-out
    vi.spyOn(rngModule, "random").mockReturnValue(0.9);
    const { state, logs } = dispatchAction(makeState({ balls: 3 }), "wait", {
      strategy: "balanced",
    });
    expect(logs.some((l) => l.toLowerCase().includes("ball four"))).toBe(true);
    expect(state.baseLayout[0]).toBe(1);
    expect(state.outs).toBe(0);
  });
});

// foul ball
// Foul-ball detailed behavior is fully covered in handlers/sim.test.ts.
// This single integration test proves the root reducer routes foul to the sim handler.
describe("foul ball — root delegation proof", () => {
  it("root reducer routes foul to sim handler: 2-strike foul stays at 2, pitchKey increments", () => {
    const { state } = dispatchAction(makeState({ strikes: 2, pitchKey: 5 }), "foul");
    expect(state.strikes).toBe(2);
    expect(state.pitchKey).toBe(6);
  });
});

// strike
describe("strike", () => {
  it("swing and miss increments strikes", () => {
    const { state, logs } = dispatchAction(makeState({ strikes: 0 }), "strike", { swung: true });
    expect(state.strikes).toBe(1);
    expect(logs.some((l) => l.includes("miss"))).toBe(true);
  });
  it("called strike logs correctly", () => {
    const { state, logs } = dispatchAction(makeState({ strikes: 1 }), "strike", { swung: false });
    expect(state.strikes).toBe(2);
    expect(logs.some((l) => l.toLowerCase().includes("called"))).toBe(true);
  });
  it("third strike is an out", () => {
    const { state } = dispatchAction(makeState({ strikes: 2, outs: 0 }), "strike", { swung: true });
    expect(state.outs).toBe(1);
    expect(state.strikes).toBe(0);
  });
  it("strike increments pitchKey", () => {
    expect(
      dispatchAction(makeState({ pitchKey: 3 }), "strike", { swung: true }).state.pitchKey,
    ).toBe(4);
  });
  it("strike clears hitType", () => {
    expect(
      dispatchAction(makeState({ hitType: Hit.Double }), "strike", { swung: true }).state.hitType,
    ).toBeUndefined();
  });
});

// ball/wait
describe("ball", () => {
  it("ball 4 becomes a walk", () => {
    vi.spyOn(rngModule, "random").mockReturnValueOnce(0.9).mockReturnValue(0);
    const { state, logs } = dispatchAction(makeState({ balls: 3 }), "wait", {
      strategy: "balanced",
    });
    expect(logs.some((l) => l.toLowerCase().includes("ball four"))).toBe(true);
    expect(state.baseLayout[0]).toBe(1);
  });
  it("ball increments pitchKey", () => {
    vi.spyOn(rngModule, "random").mockReturnValue(0.9);
    const { state } = dispatchAction(makeState({ balls: 0, pitchKey: 2 }), "wait", {
      strategy: "balanced",
    });
    expect(state.pitchKey).toBeGreaterThan(2);
  });
});

// steal attempt (bug fix)
describe("steal_attempt", () => {
  it("successful steal from 1st: runner moves to 2nd, 1st cleared", () => {
    const { state, logs } = dispatchAction(makeState({ baseLayout: [1, 0, 0] }), "steal_attempt", {
      base: 0,
      successPct: 100,
    });
    expect(state.baseLayout[0]).toBe(0);
    expect(state.baseLayout[1]).toBe(1);
    expect(logs.some((l) => l.toLowerCase().includes("safe"))).toBe(true);
  });
  it("successful steal from 2nd: runner moves to 3rd, 2nd cleared", () => {
    const { state } = dispatchAction(makeState({ baseLayout: [0, 1, 0] }), "steal_attempt", {
      base: 1,
      successPct: 100,
    });
    expect(state.baseLayout[1]).toBe(0);
    expect(state.baseLayout[2]).toBe(1);
  });
  it("caught stealing: runner removed, out recorded", () => {
    const { state, logs } = dispatchAction(
      makeState({ baseLayout: [1, 0, 0], outs: 0 }),
      "steal_attempt",
      { base: 0, successPct: 0 },
    );
    expect(state.baseLayout[0]).toBe(0);
    expect(state.outs).toBe(1);
    expect(logs.some((l) => l.toLowerCase().includes("caught"))).toBe(true);
  });
  it("caught stealing does NOT leave runner on base", () => {
    const { state } = dispatchAction(
      makeState({ baseLayout: [0, 1, 0], outs: 1 }),
      "steal_attempt",
      { base: 1, successPct: 0 },
    );
    expect(state.baseLayout[1]).toBe(0);
    expect(state.baseLayout[2]).toBe(0);
  });
  it("steal increments pitchKey", () => {
    const { state } = dispatchAction(
      makeState({ baseLayout: [1, 0, 0], pitchKey: 7 }),
      "steal_attempt",
      { base: 0, successPct: 100 },
    );
    expect(state.pitchKey).toBe(8);
  });
});

// bunt attempt (bug fix: runner on 3rd scores)
describe("bunt_attempt", () => {
  it("sac bunt: runner on 3rd scores", () => {
    vi.spyOn(rngModule, "random").mockReturnValue(0.5); // roll=50 -> sac
    const { state, logs } = dispatchAction(
      makeState({ baseLayout: [1, 0, 1], outs: 0, score: [0, 0] }),
      "bunt_attempt",
      { strategy: "balanced" },
    );
    expect(state.score[0]).toBe(1);
    expect(state.baseLayout[2]).toBe(0);
    expect(logs.some((l) => l.toLowerCase().includes("run"))).toBe(true);
  });
  it("sac bunt: runner on 1st advances to 2nd", () => {
    vi.spyOn(rngModule, "random").mockReturnValue(0.5);
    const { state } = dispatchAction(
      makeState({ baseLayout: [1, 0, 0], outs: 0 }),
      "bunt_attempt",
      { strategy: "balanced" },
    );
    expect(state.baseLayout[0]).toBe(0);
    expect(state.baseLayout[1]).toBe(1);
    expect(state.outs).toBe(1);
  });
  it("sac bunt: runner on 2nd advances to 3rd", () => {
    vi.spyOn(rngModule, "random").mockReturnValue(0.5);
    const { state } = dispatchAction(
      makeState({ baseLayout: [0, 1, 0], outs: 1 }),
      "bunt_attempt",
      { strategy: "balanced" },
    );
    expect(state.baseLayout[1]).toBe(0);
    expect(state.baseLayout[2]).toBe(1);
    expect(state.outs).toBe(2);
  });
  it("sac bunt with runners on 1st and 3rd: 3rd scores, 1st to 2nd", () => {
    vi.spyOn(rngModule, "random").mockReturnValue(0.5);
    const { state } = dispatchAction(
      makeState({ baseLayout: [1, 0, 1], score: [2, 1] }),
      "bunt_attempt",
      { strategy: "balanced" },
    );
    expect(state.score[0]).toBe(3);
    expect(state.baseLayout[2]).toBe(0);
    expect(state.baseLayout[1]).toBe(1);
    expect(state.outs).toBe(1);
  });
  it("bunt pop-up: out, runners stay", () => {
    vi.spyOn(rngModule, "random").mockReturnValue(0.85); // roll=85 >= 80 -> pop-up
    const { state, logs } = dispatchAction(
      makeState({ baseLayout: [1, 0, 0], outs: 0 }),
      "bunt_attempt",
      { strategy: "balanced" },
    );
    expect(state.outs).toBe(1);
    expect(state.baseLayout[0]).toBe(1);
    expect(logs.some((l) => l.toLowerCase().includes("popped"))).toBe(true);
  });
});

// half-inning transition
describe("playerOut - half-inning transition", () => {
  it("3rd out flips atBat from 0 to 1", () => {
    const { state } = dispatchAction(
      makeState({ outs: 2, atBat: 0, inning: 1, strikes: 2 }),
      "strike",
      { swung: true },
    );
    expect(state.atBat).toBe(1);
    expect(state.outs).toBe(0);
    expect(state.baseLayout).toEqual([0, 0, 0]);
  });
  it("3rd out in bottom of inning 1 → inning 2 top", () => {
    const { state } = dispatchAction(
      makeState({ outs: 2, atBat: 1, inning: 1, strikes: 2 }),
      "strike",
      { swung: true },
    );
    expect(state.inning).toBe(2);
    expect(state.atBat).toBe(0);
  });
  it("bases cleared after 3rd out", () => {
    const { state } = dispatchAction(
      makeState({ outs: 2, strikes: 2, baseLayout: [1, 1, 1] }),
      "strike",
      { swung: true },
    );
    expect(state.baseLayout).toEqual([0, 0, 0]);
  });
});

// game-over
describe("game-over", () => {
  it("game ends after bottom of 9th if away leads", () => {
    const { state, logs } = dispatchAction(
      makeState({ outs: 2, atBat: 1, inning: 9, score: [3, 2], strikes: 2 }),
      "strike",
      { swung: true },
    );
    expect(state.gameOver).toBe(true);
    expect(logs.some((l) => l.toLowerCase().includes("ball game"))).toBe(true);
  });
  it("game does NOT end in 9th if tied", () => {
    const { state } = dispatchAction(
      makeState({ outs: 2, atBat: 1, inning: 9, score: [2, 2], strikes: 2 }),
      "strike",
      { swung: true },
    );
    expect(state.gameOver).toBe(false);
  });
  it("walk-off: home team takes lead in bottom 9th", () => {
    // line_drive + roll 300 → single; runner on 3rd scores → walk-off.
    mockRandom(0.3);
    const { state, logs } = dispatchAction(
      makeState({ atBat: 1, inning: 9, score: [2, 2], baseLayout: [0, 0, 1] }),
      "hit",
      { battedBallType: "line_drive", strategy: "balanced" },
    );
    expect(state.score[1]).toBe(3);
    expect(state.gameOver).toBe(true);
    expect(logs.some((l) => l.toLowerCase().includes("walk-off"))).toBe(true);
  });
  it("game actions ignored after gameOver", () => {
    const { state } = dispatchAction(makeState({ gameOver: true, strikes: 0 }), "strike", {
      swung: true,
    });
    expect(state.strikes).toBe(0);
  });
  it("setTeams still works when gameOver", () => {
    const { state } = dispatchAction(makeState({ gameOver: true, teams: ["A", "B"] }), "setTeams", [
      "X",
      "Y",
    ]);
    expect(state.teams).toEqual(["X", "Y"]);
  });
});

// detectDecision
describe("detectDecision", () => {
  it("returns null when managerMode is false", () => {
    expect(detectDecision(makeState({ baseLayout: [1, 0, 0] }), "balanced", false)).toBeNull();
  });
  it("returns null when game is over", () => {
    expect(
      detectDecision(makeState({ gameOver: true, baseLayout: [1, 0, 0] }), "balanced", true),
    ).toBeNull();
  });
  it("does NOT offer steal with balanced (pct=70 not > 70 default threshold)", () => {
    const d = detectDecision(makeState({ baseLayout: [1, 0, 0], outs: 0 }), "balanced", true);
    expect(d?.kind).not.toBe("steal");
  });
  it("offers steal from 1st with aggressive (pct=91 > 70 default threshold)", () => {
    const d = detectDecision(makeState({ baseLayout: [1, 0, 0], outs: 0 }), "aggressive", true);
    expect(d?.kind).toBe("steal");
    if (d?.kind === "steal") {
      expect(d.base).toBe(0);
      expect(d.successPct).toBeGreaterThan(70);
    }
  });
  it("does NOT offer steal from 2nd if 3rd is occupied (the reported bug)", () => {
    const d = detectDecision(makeState({ baseLayout: [0, 1, 1], outs: 0 }), "aggressive", true);
    expect(d?.kind).not.toBe("steal");
  });
  it("offers steal from 2nd when 3rd is empty", () => {
    const d = detectDecision(makeState({ baseLayout: [0, 1, 0], outs: 0 }), "aggressive", true);
    expect(d?.kind).toBe("steal");
    if (d?.kind === "steal") expect(d.base).toBe(1);
  });
  it("does NOT offer steal from 1st if 2nd is occupied", () => {
    const d = detectDecision(makeState({ baseLayout: [1, 1, 0], outs: 0 }), "aggressive", true);
    if (d?.kind === "steal") {
      expect((d as { kind: "steal"; base: 0 | 1 }).base).not.toBe(0);
    }
  });
  it("does NOT offer steal with 2 outs", () => {
    const d = detectDecision(makeState({ baseLayout: [1, 0, 0], outs: 2 }), "aggressive", true);
    expect(d?.kind).not.toBe("steal");
  });
  it("offers IBB: runner on 2nd, 1st open, 2 outs, inning 7+, close game", () => {
    expect(
      detectDecision(
        makeState({ baseLayout: [0, 1, 0], outs: 2, inning: 7, score: [3, 2] }),
        "balanced",
        true,
      )?.kind,
    ).toBe("ibb");
  });
  it("does NOT offer IBB in inning 6", () => {
    expect(
      detectDecision(
        makeState({ baseLayout: [0, 1, 0], outs: 2, inning: 6, score: [3, 2] }),
        "balanced",
        true,
      )?.kind,
    ).not.toBe("ibb");
  });
  it("does NOT offer IBB when score gap > 2", () => {
    expect(
      detectDecision(
        makeState({ baseLayout: [0, 1, 0], outs: 2, inning: 8, score: [7, 2] }),
        "balanced",
        true,
      )?.kind,
    ).not.toBe("ibb");
  });
  it("does NOT offer IBB with 1st occupied", () => {
    expect(
      detectDecision(
        makeState({ baseLayout: [1, 1, 0], outs: 2, inning: 7, score: [3, 2] }),
        "balanced",
        true,
      )?.kind,
    ).not.toBe("ibb");
  });
  it("does NOT offer IBB with ibbEnabled=false in decisionValues", () => {
    expect(
      detectDecision(
        makeState({ baseLayout: [0, 1, 0], outs: 2, inning: 7, score: [3, 2] }),
        "balanced",
        true,
        { ...DEFAULT_MANAGER_DECISION_VALUES, ibbEnabled: false },
      )?.kind,
    ).not.toBe("ibb");
  });
  it("offers steal with lower stealMinOfferPct", () => {
    // balanced pct=70; with threshold 69, 70 > 69 is true → steal offered
    const d = detectDecision(makeState({ baseLayout: [1, 0, 0], outs: 0 }), "balanced", true, {
      ...DEFAULT_MANAGER_DECISION_VALUES,
      stealMinOfferPct: 69,
      aiStealThreshold: 65,
    });
    expect(d?.kind).toBe("steal");
  });
  it("does NOT offer steal with higher stealMinOfferPct", () => {
    // aggressive pct=91; with threshold 95, 91 > 95 is false → no steal
    const d = detectDecision(makeState({ baseLayout: [1, 0, 0], outs: 0 }), "aggressive", true, {
      ...DEFAULT_MANAGER_DECISION_VALUES,
      stealMinOfferPct: 95,
      aiStealThreshold: 90,
    });
    expect(d?.kind).not.toBe("steal");
  });
  it("offers bunt when runner on 1st, 0 outs, inning 6+, close game, steal unavailable", () => {
    const d = detectDecision(
      makeState({ baseLayout: [1, 0, 0], outs: 0, inning: 6, score: [0, 1] }),
      "patient",
      true,
    );
    expect(d?.kind).toBe("bunt");
  });
  it("offers bunt with 1 out when runner on 2nd (scoring position)", () => {
    // At 1-0 count, pinch_hitter (requires 0-0) does not fire — bunt is offered.
    const d = detectDecision(
      makeState({ baseLayout: [0, 1, 0], outs: 1, inning: 7, score: [0, 1], balls: 1 }),
      "patient",
      true,
    );
    expect(d?.kind).toBe("bunt");
  });
  it("does NOT offer bunt with 1 out and runner on 1st only (less run value)", () => {
    const d = detectDecision(
      makeState({ baseLayout: [1, 0, 0], outs: 1, inning: 7, score: [0, 1] }),
      "patient",
      true,
    );
    expect(d?.kind).not.toBe("bunt");
  });
  it("does NOT offer bunt on 0-2 count — count02 takes priority", () => {
    const d = detectDecision(
      makeState({ baseLayout: [1, 0, 0], outs: 0, inning: 7, score: [0, 1], balls: 0, strikes: 2 }),
      "patient",
      true,
    );
    expect(d?.kind).toBe("count02");
    expect(d?.kind).not.toBe("bunt");
  });
  it("does NOT offer bunt on 1-2 count", () => {
    const d = detectDecision(
      makeState({ baseLayout: [1, 0, 0], outs: 0, inning: 7, score: [0, 1], balls: 1, strikes: 2 }),
      "patient",
      true,
    );
    expect(d?.kind).not.toBe("bunt");
  });
  it("does NOT offer bunt in early innings (inning < 6)", () => {
    const d = detectDecision(
      makeState({ baseLayout: [1, 0, 0], outs: 0, inning: 5, score: [0, 0] }),
      "patient",
      true,
    );
    expect(d?.kind).not.toBe("bunt");
  });
  it("does NOT offer bunt when score gap > 2", () => {
    const d = detectDecision(
      makeState({ baseLayout: [1, 0, 0], outs: 0, inning: 7, score: [0, 5] }),
      "patient",
      true,
    );
    expect(d?.kind).not.toBe("bunt");
  });
  it("does NOT offer bunt on 2-ball count or higher", () => {
    const d = detectDecision(
      makeState({ baseLayout: [1, 0, 0], outs: 0, inning: 7, score: [0, 1], balls: 2 }),
      "patient",
      true,
    );
    expect(d?.kind).not.toBe("bunt");
  });
  it("does NOT offer bunt with buntEnabled=false", () => {
    const d = detectDecision(
      makeState({ baseLayout: [1, 0, 0], outs: 0, inning: 7, score: [0, 1] }),
      "patient",
      true,
      { ...DEFAULT_MANAGER_DECISION_VALUES, buntEnabled: false },
    );
    expect(d?.kind).not.toBe("bunt");
  });
  it("does NOT offer bunt with 2 outs", () => {
    expect(
      detectDecision(
        makeState({ baseLayout: [1, 0, 0], outs: 2, inning: 7, score: [0, 0] }),
        "patient",
        true,
      )?.kind,
    ).not.toBe("bunt");
  });
  it("offers count30 on 3-0 count", () => {
    expect(detectDecision(makeState({ balls: 3, strikes: 0 }), "balanced", true)?.kind).toBe(
      "count30",
    );
  });
  it("offers count02 on 0-2 count", () => {
    expect(detectDecision(makeState({ balls: 0, strikes: 2 }), "balanced", true)?.kind).toBe(
      "count02",
    );
  });
  it("returns null on 1-1 count no runners", () => {
    expect(detectDecision(makeState({ balls: 1, strikes: 1 }), "balanced", true)).toBeNull();
  });
});

// pitchKey
describe("pitchKey", () => {
  it("starts at 0", () => expect(makeState().pitchKey).toBe(0));
  it("hit increments pitchKey", () => {
    // line_drive + roll 300 → single; pitchKey bumped inside handleBallInPlay.
    vi.spyOn(rngModule, "random").mockReturnValueOnce(0.3).mockReturnValue(0.8);
    const { state } = dispatchAction(makeState({ pitchKey: 3 }), "hit", {
      battedBallType: "line_drive",
    });
    expect(state.pitchKey).toBeGreaterThan(3);
  });
  it("strike increments pitchKey", () => {
    expect(
      dispatchAction(makeState({ pitchKey: 5 }), "strike", { swung: true }).state.pitchKey,
    ).toBe(6);
  });
});

// misc
describe("misc", () => {
  it("setTeams updates names", () => {
    const { state } = dispatchAction(makeState(), "setTeams", ["Yankees", "Red Sox"]);
    expect(state.teams).toEqual(["Yankees", "Red Sox"]);
  });
  it("set_pending_decision stores decision", () => {
    const d: DecisionType = { kind: "bunt" };
    expect(dispatchAction(makeState(), "set_pending_decision", d).state.pendingDecision).toEqual(d);
  });
  it("skip_decision clears pending", () => {
    expect(
      dispatchAction(makeState({ pendingDecision: { kind: "bunt" } }), "skip_decision").state
        .pendingDecision,
    ).toBeNull();
  });
  it("set_one_pitch_modifier stores modifier", () => {
    const { state } = dispatchAction(makeState(), "set_one_pitch_modifier", "take");
    expect(state.onePitchModifier).toBe("take");
  });
});

// ---------------------------------------------------------------------------
// Additional coverage for previously uncovered lines
// ---------------------------------------------------------------------------

// battedBallType dispatch validation
describe("advanceRunners – invalid hit type", () => {
  it("throws when advanceRunners receives an unknown hit type", () => {
    // advanceRunners has a default branch that throws for unrecognised Hit values.
    expect(() => advanceRunners(99 as Hit, [0, 0, 0], [null, null, null])).toThrow(
      /Not a possible hit type/,
    );
  });
});

// Lines 129-135: pop_up is always an out regardless of strategy (power conversion is in pitch dispatch)
describe("hit – pop_up always produces an out", () => {
  it("battedBallType pop_up → batter is out (no random roll needed)", () => {
    // No mock needed — pop_up short-circuits before getRandomInt.
    const { state, logs } = dispatchAction(makeState({ score: [0, 0] }), "hit", {
      battedBallType: "pop_up",
      strategy: "power",
    });
    expect(state.outs).toBe(1);
    expect(logs.some((l) => /popped it up/i.test(l))).toBe(true);
  });
});

// Lines 262-267: "take" modifier in playerWait → ball path
describe("wait – take modifier", () => {
  it("take modifier with high random → ball (walk odds up)", () => {
    // random < walkChance → ball path; walkChance ≈ 220 * 0.85 ≈ 187 for balanced (take base 220),
    // so 0.1 (→ 100 < 187) → ball
    vi.spyOn(rngModule, "random").mockReturnValueOnce(0.1).mockReturnValue(0.9);
    const { state, logs } = dispatchAction(
      makeState({ balls: 0, onePitchModifier: "take" }),
      "wait",
      { strategy: "balanced" },
    );
    expect(state.balls).toBe(1);
    expect(logs.some((l) => /ball/i.test(l))).toBe(true);
  });

  it("take modifier with low random → called strike", () => {
    // random >= walkChance → strike; walkChance ≈ 187 for balanced (take base 220), so 0.99 → strike
    vi.spyOn(rngModule, "random").mockReturnValue(0.99);
    const { state, logs } = dispatchAction(
      makeState({ strikes: 0, onePitchModifier: "take" }),
      "wait",
      { strategy: "balanced" },
    );
    expect(state.strikes).toBe(1);
    expect(logs.some((l) => /called strike/i.test(l))).toBe(true);
  });
});

// Line 272: playerWait default path → called strike
describe("wait – default (no modifier) → called strike", () => {
  it("random < strikeThreshold → called strike", () => {
    // strikeThreshold = round(500 / 1.0) = 500 for balanced; random 0.3 → 300 < 500 → strike
    vi.spyOn(rngModule, "random").mockReturnValue(0.3);
    const { state } = dispatchAction(makeState({ strikes: 0 }), "wait", { strategy: "balanced" });
    expect(state.strikes).toBe(1);
  });
});

// Line 355: nextInning action
describe("nextInning action", () => {
  it("increments the inning", () => {
    const { state } = dispatchAction(makeState({ inning: 3 }), "nextInning");
    expect(state.inning).toBe(4);
  });
});

// Lines 431-432: bunt single
describe("bunt_attempt – bunt single", () => {
  it("bunt single: runner advances as normal single", () => {
    // singleChance for balanced = 8, roll < 8 → single
    vi.spyOn(rngModule, "random")
      .mockReturnValueOnce(0.05) // roll=5 → bunt single (< 8)
      .mockReturnValue(0); // pop-out check inside hitBall → no pop-out
    const { state, logs } = dispatchAction(makeState({ baseLayout: [0, 0, 0] }), "bunt_attempt", {
      strategy: "balanced",
    });
    // bunt single: batter to 1st
    expect(state.baseLayout[0]).toBe(1);
    expect(logs.some((l) => /bunt single/i.test(l))).toBe(true);
  });

  it("contact strategy: bunt single chance is 20", () => {
    vi.spyOn(rngModule, "random")
      .mockReturnValueOnce(0.15) // roll=15 → contact single (< 20)
      .mockReturnValue(0);
    const { state, logs } = dispatchAction(makeState({ baseLayout: [0, 0, 0] }), "bunt_attempt", {
      strategy: "contact",
    });
    expect(state.baseLayout[0]).toBe(1);
    expect(logs.some((l) => /bunt single/i.test(l))).toBe(true);
  });
});

describe("bunt_attempt – fielder's choice", () => {
  it("FC: runner on 1st thrown out, batter reaches 1st", () => {
    // balanced singleChance=8, fcChance=20; roll=10 → FC
    vi.spyOn(rngModule, "random").mockReturnValue(0.1);
    const { state, logs } = dispatchAction(
      makeState({ baseLayout: [1, 0, 0], outs: 0 }),
      "bunt_attempt",
      { strategy: "balanced" },
    );
    expect(state.baseLayout[0]).toBe(1); // batter on 1st
    expect(state.baseLayout[1]).toBe(0); // runner thrown out at 2nd
    expect(state.outs).toBe(1);
    expect(logs.some((l) => l.toLowerCase().includes("fielder's choice"))).toBe(true);
  });

  it("FC: runner on 1st thrown out, runner on 2nd advances to 3rd", () => {
    vi.spyOn(rngModule, "random").mockReturnValue(0.1);
    const { state } = dispatchAction(
      makeState({ baseLayout: [1, 1, 0], outs: 0 }),
      "bunt_attempt",
      { strategy: "balanced" },
    );
    expect(state.baseLayout[0]).toBe(1);
    expect(state.baseLayout[1]).toBe(0);
    expect(state.baseLayout[2]).toBe(1);
    expect(state.outs).toBe(1);
  });

  it("FC: runner on 1st thrown out, runner on 3rd scores", () => {
    vi.spyOn(rngModule, "random").mockReturnValue(0.1);
    const { state, logs } = dispatchAction(
      makeState({ baseLayout: [1, 0, 1], outs: 0, score: [0, 0] }),
      "bunt_attempt",
      { strategy: "balanced" },
    );
    expect(state.baseLayout[0]).toBe(1);
    expect(state.score[0]).toBe(1);
    expect(state.outs).toBe(1);
    expect(logs.some((l) => l.toLowerCase().includes("run scores"))).toBe(true);
  });

  it("FC: runner on 2nd (only) thrown out, batter reaches 1st", () => {
    vi.spyOn(rngModule, "random").mockReturnValue(0.1);
    const { state, logs } = dispatchAction(
      makeState({ baseLayout: [0, 1, 0], outs: 1 }),
      "bunt_attempt",
      { strategy: "balanced" },
    );
    expect(state.baseLayout[0]).toBe(1);
    expect(state.baseLayout[1]).toBe(0);
    expect(state.outs).toBe(2);
    expect(logs.some((l) => l.toLowerCase().includes("fielder's choice"))).toBe(true);
  });

  it("FC: runners on 2nd and 3rd — 2nd runner thrown out, 3rd scores", () => {
    vi.spyOn(rngModule, "random").mockReturnValue(0.1);
    const { state, logs } = dispatchAction(
      makeState({ baseLayout: [0, 1, 1], outs: 0, score: [0, 0] }),
      "bunt_attempt",
      { strategy: "balanced" },
    );
    expect(state.baseLayout[0]).toBe(1);
    expect(state.baseLayout[1]).toBe(0);
    expect(state.baseLayout[2]).toBe(0);
    expect(state.score[0]).toBe(1);
    expect(state.outs).toBe(1);
    expect(logs.some((l) => l.toLowerCase().includes("run scores"))).toBe(true);
  });
});

// Lines 471-474: intentional_walk
describe("intentional_walk", () => {
  it("issues an intentional walk: batter to 1st", () => {
    vi.spyOn(rngModule, "random").mockReturnValue(0);
    const { state, logs } = dispatchAction(
      makeState({ baseLayout: [0, 0, 0] }),
      "intentional_walk",
    );
    expect(state.baseLayout[0]).toBe(1);
    expect(logs.some((l) => /intentional walk/i.test(l))).toBe(true);
  });

  it("intentional walk with bases loaded scores a run (walk-off in bottom 9th)", () => {
    vi.spyOn(rngModule, "random").mockReturnValue(0);
    const { state, logs } = dispatchAction(
      makeState({ baseLayout: [1, 1, 1], atBat: 1, inning: 9, score: [3, 3] }),
      "intentional_walk",
    );
    expect(state.score[1]).toBe(4);
    expect(state.gameOver).toBe(true);
    expect(logs.some((l) => /walk-off/i.test(l))).toBe(true);
  });
});

// Line 483: default case throws
describe("reducer – unknown action type", () => {
  it("throws an error for unknown action types", () => {
    const { reducer } = makeReducer();
    expect(() => reducer(makeState(), { type: "UNKNOWN_ACTION_XYZ", payload: null })).toThrow(
      /no such reducer type/i,
    );
  });
});

// Additional detectDecision coverage
describe("detectDecision – additional branches", () => {
  it("offers steal from 1st (patient strategy has steal mod 0.7 → 49%, not > 72)", () => {
    const d = detectDecision(makeState({ baseLayout: [1, 0, 0], outs: 0 }), "patient", true);
    // patient steal mod 0.7 → base_pct 70 * 0.7 = 49 → not > 72 → no steal offered
    expect(d?.kind).not.toBe("steal");
  });

  it("offers IBB when runner on 3rd (not 2nd)", () => {
    const d = detectDecision(
      makeState({ baseLayout: [0, 0, 1], outs: 2, inning: 8, score: [3, 2] }),
      "balanced",
      true,
    );
    expect(d?.kind).toBe("ibb");
  });

  it("offers IBB when score is tied (diff = 0, within ≤2 threshold)", () => {
    const d = detectDecision(
      makeState({ baseLayout: [0, 1, 0], outs: 2, inning: 9, score: [3, 3] }),
      "balanced",
      true,
    );
    expect(d?.kind).toBe("ibb");
  });

  it("does NOT offer bunt with 0 runners", () => {
    const d = detectDecision(
      makeState({ baseLayout: [0, 0, 0], outs: 0, balls: 1, strikes: 1 }),
      "patient",
      true,
    );
    expect(d).toBeNull();
  });
});

// walk advancement with runner on 1st and 3rd (no 2nd) — force advances 1st → 2nd, 3rd stays
describe("hit - walk with runner on 1st and 3rd", () => {
  it("runner on 1st forced to 2nd; runner on 3rd stays", () => {
    mockRandom(0);
    const { state } = dispatchAction(makeState({ baseLayout: [1, 0, 1] }), "intentional_walk");
    expect(state.baseLayout[0]).toBe(1); // batter to 1st
    expect(state.baseLayout[1]).toBe(1); // forced from 1st to 2nd
    expect(state.baseLayout[2]).toBe(1); // 3rd stays
    expect(state.score[0]).toBe(0); // no run scored
  });
});

// ---------------------------------------------------------------------------
// IBB follow-through: suppressNextDecision
// ---------------------------------------------------------------------------
describe("IBB follow-through — suppressNextDecision", () => {
  it("intentional_walk sets suppressNextDecision to true", () => {
    vi.spyOn(rngModule, "random").mockReturnValue(0);
    const { state } = dispatchAction(makeState(), "intentional_walk");
    expect(state.suppressNextDecision).toBe(true);
  });

  it("clear_suppress_decision clears the flag", () => {
    const { state } = dispatchAction(
      makeState({ suppressNextDecision: true }),
      "clear_suppress_decision",
    );
    expect(state.suppressNextDecision).toBe(false);
  });

  it("detectDecision returns null when suppressNextDecision is true", () => {
    const state = makeState({ baseLayout: [1, 0, 0], outs: 0, suppressNextDecision: true });
    expect(detectDecision(state, "aggressive", true)).toBeNull();
  });

  it("suppressNextDecision resets after half-inning transition", () => {
    const { state } = dispatchAction(
      makeState({ outs: 2, strikes: 2, atBat: 0, inning: 1, suppressNextDecision: true }),
      "strike",
      { swung: true },
    );
    expect(state.suppressNextDecision).toBe(false);
  });

  it("suppressNextDecision persists on the IBB walk result (cleared by usePitchDispatch, not hitBall)", () => {
    vi.spyOn(rngModule, "random").mockReturnValue(0);
    // After an IBB, the walk result state should still have suppressNextDecision: true
    // so the NEXT batter's first pitch can clear it via clear_suppress_decision.
    const { state } = dispatchAction(makeState(), "intentional_walk");
    expect(state.suppressNextDecision).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Pinch-hitter / substitution
// ---------------------------------------------------------------------------
describe("pinch_hitter decision", () => {
  it("detectDecision offers pinch_hitter when runner on 3rd, outs < 2, inning >= 7", () => {
    const d = detectDecision(
      makeState({ baseLayout: [0, 0, 1], outs: 0, inning: 7 }),
      "balanced",
      true,
    );
    expect(d?.kind).toBe("pinch_hitter");
  });

  it("detectDecision does NOT offer pinch_hitter before inning 7", () => {
    const d = detectDecision(
      makeState({ baseLayout: [0, 0, 1], outs: 0, inning: 6 }),
      "balanced",
      true,
    );
    expect(d?.kind).not.toBe("pinch_hitter");
  });

  it("detectDecision does NOT offer pinch_hitter with 2 outs", () => {
    const d = detectDecision(
      makeState({ baseLayout: [0, 0, 1], outs: 2, inning: 7 }),
      "balanced",
      true,
    );
    expect(d?.kind).not.toBe("pinch_hitter");
  });

  it("detectDecision does NOT offer pinch_hitter when pinchHitterStrategy already set", () => {
    const d = detectDecision(
      makeState({ baseLayout: [0, 0, 1], outs: 0, inning: 7, pinchHitterStrategy: "contact" }),
      "balanced",
      true,
    );
    expect(d?.kind).not.toBe("pinch_hitter");
  });

  it("detectDecision does NOT offer pinch_hitter mid-count (balls > 0)", () => {
    const d = detectDecision(
      makeState({ baseLayout: [0, 0, 1], outs: 0, inning: 7, balls: 1, strikes: 0 }),
      "balanced",
      true,
    );
    expect(d?.kind).not.toBe("pinch_hitter");
  });

  it("detectDecision does NOT offer pinch_hitter mid-count (strikes > 0)", () => {
    const d = detectDecision(
      makeState({ baseLayout: [0, 0, 1], outs: 0, inning: 7, balls: 0, strikes: 1 }),
      "balanced",
      true,
    );
    expect(d?.kind).not.toBe("pinch_hitter");
  });

  it("detectDecision offers pinch_hitter with runner on 2nd (inning 7, 0-0 count) — not preempted by bunt", () => {
    // Before fix: bunt check fired first because baseLayout[1]=1 satisfied it.
    const d = detectDecision(
      makeState({ baseLayout: [0, 1, 0], outs: 0, inning: 7, balls: 0, strikes: 0 }),
      "balanced",
      true,
    );
    expect(d?.kind).toBe("pinch_hitter");
  });

  it("detectDecision pinch_hitter decision includes teamIdx, lineupIdx, and candidates", () => {
    const state = makeState({
      baseLayout: [0, 0, 1],
      outs: 0,
      inning: 7,
      atBat: 0,
      batterIndex: [3, 0],
      rosterBench: [["b1", "b2"], []],
      substitutedOut: [["b2"], []],
      playerOverrides: [{ b1: { nickname: "Bench1", position: "LF" } }, {}],
    });
    const d = detectDecision(state, "balanced", true);
    expect(d?.kind).toBe("pinch_hitter");
    if (d?.kind === "pinch_hitter") {
      expect(d.teamIdx).toBe(0);
      expect(d.lineupIdx).toBe(3);
      // b2 is substituted out, so only b1 should be a candidate
      expect(d.candidates).toHaveLength(1);
      expect(d.candidates[0].id).toBe("b1");
      expect(d.candidates[0].name).toBe("Bench1");
      expect(d.candidates[0].position).toBe("LF");
      // stat mods default to 0 when no resolvedMods are set
      expect(d.candidates[0].contactMod).toBe(0);
      expect(d.candidates[0].powerMod).toBe(0);
    }
  });

  it("detectDecision pinch_hitter includes fatigue-adjusted candidate fields", () => {
    const state = makeState({
      baseLayout: [0, 0, 1],
      outs: 0,
      inning: 8,
      atBat: 0,
      batterIndex: [3, 0],
      rosterBench: [["b1"], []],
      lineupOrder: [
        ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9"],
        ["ph1", "ph2", "ph3", "ph4", "ph5", "ph6", "ph7", "ph8", "ph9"],
      ],
      batterPlateAppearances: [{ b1: 6, p4: 7 }, {}],
      resolvedMods: [
        {
          b1: {
            contactMod: 8,
            powerMod: 5,
            speedMod: 0,
            velocityMod: 0,
            controlMod: 0,
            movementMod: 0,
            staminaMod: -10,
          },
          p4: {
            contactMod: 0,
            powerMod: 0,
            speedMod: 0,
            velocityMod: 0,
            controlMod: 0,
            movementMod: 0,
            staminaMod: -10,
          },
        },
        {},
      ],
    });
    const d = detectDecision(state, "balanced", true);
    expect(d?.kind).toBe("pinch_hitter");
    if (d?.kind === "pinch_hitter") {
      expect(d.currentBatterPlateAppearances).toBe(7);
      expect((d.currentBatterFatigueContactPenalty ?? 0) > 0).toBe(true);
      expect(d.candidates[0].plateAppearances).toBe(6);
      expect((d.candidates[0].fatigueContactPenalty ?? 0) > 0).toBe(true);
      expect((d.candidates[0].effectiveContactMod ?? 0) < d.candidates[0].contactMod).toBe(true);
    }
  });

  it("pinch hitter substitution keeps workload identity on the incoming batter", () => {
    const preloaded = makeState({
      atBat: 0,
      batterIndex: [3, 0],
      strikes: 2,
      lineupOrder: [
        ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9"],
        ["ph1", "ph2", "ph3", "ph4", "ph5", "ph6", "ph7", "ph8", "ph9"],
      ],
      rosterBench: [["b1"], []],
      batterPlateAppearances: [{ p4: 4 }, {}],
    });
    const { state: afterSub } = dispatchAction(preloaded, "make_substitution", {
      teamIdx: 0,
      kind: "batter",
      lineupIdx: 3,
      benchPlayerId: "b1",
    });
    expect(afterSub.lineupOrder[0][3]).toBe("b1");
    expect(afterSub.batterPlateAppearances[0].p4).toBe(4);
    expect(afterSub.batterPlateAppearances[0].b1).toBeUndefined();

    const { state: afterStrikeout } = dispatchAction(afterSub, "strike", { swung: true });
    expect(afterStrikeout.batterPlateAppearances[0].p4).toBe(4);
    expect(afterStrikeout.batterPlateAppearances[0].b1).toBe(1);
  });

  it("set_pinch_hitter_strategy stores strategy and clears pending decision", () => {
    const { state, logs } = dispatchAction(
      makeState({
        pendingDecision: { kind: "pinch_hitter", candidates: [], teamIdx: 0, lineupIdx: 0 },
      }),
      "set_pinch_hitter_strategy",
      "contact",
    );
    expect(state.pinchHitterStrategy).toBe("contact");
    expect(state.pendingDecision).toBeNull();
    expect(logs.some((l) => /pinch hitter/i.test(l))).toBe(true);
  });

  it("pinchHitterStrategy cleared after hit ends at-bat", () => {
    // pop_up always produces an out — no random mock needed.
    const { state } = dispatchAction(makeState({ pinchHitterStrategy: "power" }), "hit", {
      battedBallType: "pop_up",
      strategy: "balanced",
    });
    expect(state.pinchHitterStrategy).toBeNull();
  });

  it("pinchHitterStrategy cleared after strikeout (half-inning transition)", () => {
    const { state } = dispatchAction(
      makeState({ outs: 2, strikes: 2, pinchHitterStrategy: "contact" }),
      "strike",
      { swung: true },
    );
    expect(state.pinchHitterStrategy).toBeNull();
  });

  it("pinchHitterStrategy cleared after non-3rd-out", () => {
    const { state } = dispatchAction(
      makeState({ outs: 0, strikes: 2, pinchHitterStrategy: "contact" }),
      "strike",
      { swung: true },
    );
    expect(state.pinchHitterStrategy).toBeNull();
  });

  it("pinchHitterStrategy persists on caught-stealing (batterCompleted=false, same batter stays up)", () => {
    // Caught stealing only records a runner out; the batter's at-bat is not over.
    // The active pinch-hitter strategy must remain for the batter's remaining pitches.
    vi.spyOn(rngModule, "random").mockReturnValue(0.99); // 99 ≥ successPct → caught stealing
    const { state } = dispatchAction(
      makeState({ baseLayout: [1, 0, 0], outs: 0, pinchHitterStrategy: "power" }),
      "steal_attempt",
      { base: 0, successPct: 70 },
    );
    expect(state.pinchHitterStrategy).toBe("power");
  });

  it("pinchHitterStrategy cleared after sac bunt", () => {
    vi.spyOn(rngModule, "random").mockReturnValue(0.5); // roll=50 → sac
    const { state } = dispatchAction(
      makeState({ baseLayout: [1, 0, 0], pinchHitterStrategy: "patient" }),
      "bunt_attempt",
      { strategy: "balanced" },
    );
    expect(state.pinchHitterStrategy).toBeNull();
  });

  it("reset clears pinchHitterStrategy", () => {
    const { state } = dispatchAction(makeState({ pinchHitterStrategy: "power" }), "reset");
    expect(state.pinchHitterStrategy).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Defensive shifting
// ---------------------------------------------------------------------------
describe("defensive_shift decision", () => {
  it("set_defensive_shift true sets defensiveShift and clears pendingDecision", () => {
    const { state, logs } = dispatchAction(
      makeState({ pendingDecision: { kind: "defensive_shift" } }),
      "set_defensive_shift",
      true,
    );
    expect(state.defensiveShift).toBe(true);
    expect(state.pendingDecision).toBeNull();
    expect(logs.some((l) => /shift/i.test(l))).toBe(true);
  });

  it("set_defensive_shift false sets defensiveShift to false", () => {
    const { state, logs } = dispatchAction(
      makeState({ defensiveShift: true, pendingDecision: { kind: "defensive_shift" } }),
      "set_defensive_shift",
      false,
    );
    expect(state.defensiveShift).toBe(false);
    expect(state.pendingDecision).toBeNull();
    expect(logs.some((l) => /normal alignment/i.test(l))).toBe(true);
  });

  it("set_pending_decision with defensive_shift sets defensiveShiftOffered to true", () => {
    const { state } = dispatchAction(makeState(), "set_pending_decision", {
      kind: "defensive_shift",
    });
    expect(state.defensiveShiftOffered).toBe(true);
    expect(state.pendingDecision).toEqual({ kind: "defensive_shift" });
  });

  it("set_pending_decision with other kinds does NOT set defensiveShiftOffered", () => {
    const { state } = dispatchAction(makeState(), "set_pending_decision", { kind: "bunt" });
    expect(state.defensiveShiftOffered).toBe(false);
  });

  it("defensive shift raises ground-out rate for hard grounders", () => {
    // hard_grounder: base threshold 500; shift boost +100 = 600.
    // roll=550 → without shift: 550 >= 500 → single. With shift: 550 < 600 → ground out.
    vi.spyOn(rngModule, "random").mockReturnValue(0.55);
    const { state: shiftOn, logs: logsOn } = dispatchAction(
      makeState({ defensiveShift: true }),
      "hit",
      { battedBallType: "hard_grounder", strategy: "balanced" },
    );
    expect(shiftOn.outs).toBe(1);
    expect(logsOn.some((l) => /out at first|fielder.s choice|double play/i.test(l))).toBe(true);
  });

  it("without defensive shift, same random does NOT produce a ground out", () => {
    // Without shift: threshold 500. roll=550 → 550 >= 500 → single.
    vi.spyOn(rngModule, "random").mockReturnValue(0.55);
    const { state: shiftOff } = dispatchAction(makeState({ defensiveShift: false }), "hit", {
      battedBallType: "hard_grounder",
      strategy: "balanced",
    });
    expect(shiftOff.outs).toBe(0);
  });

  it("defensiveShiftOffered persists across batters in the same half-inning (no re-prompt)", () => {
    // Simulate: shift was offered and accepted for batter 1, batter 1 struck out.
    // defensiveShiftOffered should still be true so the next batter is not re-prompted.
    const { state } = dispatchAction(
      makeState({ outs: 0, strikes: 2, defensiveShift: true, defensiveShiftOffered: true }),
      "strike",
      { swung: true },
    );
    expect(state.defensiveShiftOffered).toBe(true);
    expect(state.defensiveShift).toBe(true);
  });

  it("defensiveShift and defensiveShiftOffered both cleared after half-inning transition", () => {
    const { state } = dispatchAction(
      makeState({
        outs: 2,
        strikes: 2,
        atBat: 0,
        inning: 1,
        defensiveShift: true,
        defensiveShiftOffered: true,
      }),
      "strike",
      { swung: true },
    );
    expect(state.defensiveShift).toBe(false);
    expect(state.defensiveShiftOffered).toBe(false);
  });

  it("defensiveShift persists after hit ends at-bat (shift stays for half-inning)", () => {
    // line_drive + roll 300 → single; shift is preserved in state after at-bat.
    vi.spyOn(rngModule, "random").mockReturnValueOnce(0.3).mockReturnValue(0.8);
    const { state } = dispatchAction(
      makeState({ defensiveShift: true, defensiveShiftOffered: true }),
      "hit",
      { battedBallType: "line_drive", strategy: "balanced" },
    );
    expect(state.defensiveShift).toBe(true);
    expect(state.defensiveShiftOffered).toBe(true);
  });

  it("defensiveShift and defensiveShiftOffered persist after non-3rd-out (stay for half-inning)", () => {
    const { state } = dispatchAction(
      makeState({ outs: 0, strikes: 2, defensiveShift: true, defensiveShiftOffered: true }),
      "strike",
      { swung: true },
    );
    expect(state.defensiveShift).toBe(true);
    expect(state.defensiveShiftOffered).toBe(true);
  });

  it("reset clears defensive shift fields", () => {
    const { state } = dispatchAction(
      makeState({ defensiveShift: true, defensiveShiftOffered: true }),
      "reset",
    );
    expect(state.defensiveShift).toBe(false);
    expect(state.defensiveShiftOffered).toBe(false);
  });
});

describe("strikeout tracking", () => {
  it("strike on 2-strike count appends to strikeoutLog", () => {
    const { state } = dispatchAction(
      makeState({ strikes: 2, atBat: 0, batterIndex: [2, 0], lineupOrder: NINE_AWAY }),
      "strike",
      { swung: true },
    );
    expect(state.strikeoutLog).toHaveLength(1);
    expect(state.strikeoutLog[0]).toEqual({ team: 0, batterNum: 3, playerId: "p3" });
  });

  it("strike on 0-strike count does NOT append to strikeoutLog", () => {
    const { state } = dispatchAction(makeState({ strikes: 0, atBat: 0 }), "strike", {
      swung: true,
    });
    expect(state.strikeoutLog).toHaveLength(0);
  });

  it("wait resulting in a strikeout appends to strikeoutLog", () => {
    // Force a strike outcome by making random always return a value in strike range
    vi.spyOn(rngModule, "random").mockReturnValue(0); // 0/1000 < 500 → strike
    const { state } = dispatchAction(
      makeState({ strikes: 2, atBat: 1, batterIndex: [0, 4], lineupOrder: NINE_HOME }),
      "wait",
    );
    expect(state.strikeoutLog).toHaveLength(1);
    expect(state.strikeoutLog[0]).toEqual({ team: 1, batterNum: 5, playerId: "ph5" });
  });

  it("wait resulting in a walk (ball 4) on 2-strike count does NOT add a K", () => {
    // Force a ball outcome: random = 999 (> 500 threshold → ball)
    vi.spyOn(rngModule, "random").mockReturnValue(0.999);
    const { state } = dispatchAction(
      makeState({ strikes: 2, balls: 3, atBat: 0, batterIndex: [0, 0] }),
      "wait",
    );
    // Walk occurred — strikeoutLog should still be empty
    expect(state.strikeoutLog).toHaveLength(0);
  });

  it("reset clears strikeoutLog", () => {
    const { state } = dispatchAction(
      makeState({ strikeoutLog: [{ team: 0, batterNum: 1, playerId: "p1" }] }),
      "reset",
    );
    expect(state.strikeoutLog).toHaveLength(0);
  });
});

describe("restore_game — RBI backfill for older saves", () => {
  it("backfills rbi from runs on playLog entries that lack rbi", () => {
    const oldPlayLog = [
      {
        inning: 1,
        half: 0 as const,
        batterNum: 1,
        playerId: "p1",
        team: 0 as const,
        event: Hit.Single,
        runs: 1,
      },
      {
        inning: 2,
        half: 0 as const,
        batterNum: 3,
        playerId: "p3",
        team: 0 as const,
        event: Hit.Homerun,
        runs: 4,
      },
    ];
    const { state } = dispatchAction(
      makeState({ playLog: oldPlayLog }),
      "restore_game",
      makeState({ playLog: oldPlayLog }),
    );
    expect(state.playLog[0].rbi).toBe(1);
    expect(state.playLog[1].rbi).toBe(4);
  });

  it("preserves existing rbi values and does not overwrite them", () => {
    const playLog = [
      {
        inning: 1,
        half: 0 as const,
        batterNum: 2,
        playerId: "p2",
        team: 0 as const,
        event: Hit.Double,
        runs: 2,
        rbi: 2,
      },
    ];
    const { state } = dispatchAction(
      makeState({ playLog }),
      "restore_game",
      makeState({ playLog }),
    );
    expect(state.playLog[0].rbi).toBe(2);
  });

  it("handles empty playLog without error", () => {
    const { state } = dispatchAction(makeState(), "restore_game", makeState());
    expect(state.playLog).toHaveLength(0);
  });

  it("zero-runs entry gets rbi=0 after backfill", () => {
    const oldPlayLog = [
      {
        inning: 1,
        half: 0 as const,
        batterNum: 1,
        playerId: "p1",
        team: 0 as const,
        event: Hit.Single,
        runs: 0,
      },
    ];
    const { state } = dispatchAction(
      makeState({ playLog: oldPlayLog }),
      "restore_game",
      makeState({ playLog: oldPlayLog }),
    );
    expect(state.playLog[0].rbi).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Root reducer — routing / orchestration (one proof per domain handler)
// ---------------------------------------------------------------------------

describe("root reducer — routing and orchestration", () => {
  it("delegates sim action (hit) to handleSimAction", () => {
    // deep_fly + roll 800 → HR (770–999); solo HR scores 1.
    mockRandom(0.8);
    const { state } = dispatchAction(makeState({ score: [0, 0] }), "hit", {
      battedBallType: "deep_fly",
      strategy: "balanced",
    });
    expect(state.score[0]).toBe(1); // solo HR scored → sim handler ran
  });

  it("delegates lifecycle action (reset) to handleLifecycleAction", () => {
    const { state } = dispatchAction(makeState({ strikes: 2, balls: 3, score: [5, 3] }), "reset");
    expect(state.strikes).toBe(0);
    expect(state.score).toEqual([0, 0]);
  });

  it("delegates decisions action (skip_decision) to handleDecisionsAction", () => {
    const { state } = dispatchAction(
      makeState({ pendingDecision: { kind: "bunt" } }),
      "skip_decision",
    );
    expect(state.pendingDecision).toBeNull();
  });

  it("delegates setup action (setTeams) to handleSetupAction", () => {
    const { state } = dispatchAction(makeState(), "setTeams", ["Dodgers", "Giants"]);
    expect(state.teams).toEqual(["Dodgers", "Giants"]);
  });

  it("warnIfImpossible (invariant check) still runs after delegated actions in DEV", () => {
    // In the test environment import.meta.env.DEV is true; warnIfImpossible must
    // not throw for a valid post-action state.
    expect(() => dispatchAction(makeState(), "reset")).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// canProcessActionAfterGameOver — explicit allow-list regression tests
// (Bug fix: load over finished game must never be a silent no-op)
// ---------------------------------------------------------------------------

describe("canProcessActionAfterGameOver", () => {
  it("allows restore_game through when game is over", () => {
    expect(canProcessActionAfterGameOver({ type: "restore_game" })).toBe(true);
  });

  it("allows reset through when game is over", () => {
    expect(canProcessActionAfterGameOver({ type: "reset" })).toBe(true);
  });

  it("allows setTeams through when game is over", () => {
    expect(canProcessActionAfterGameOver({ type: "setTeams" })).toBe(true);
  });

  it("blocks pitch simulation actions after game over", () => {
    const blocked = [
      "strike",
      "hit",
      "foul",
      "wait",
      "steal_attempt",
      "bunt_attempt",
      "intentional_walk",
    ];
    for (const type of blocked) {
      expect(canProcessActionAfterGameOver({ type })).toBe(false);
    }
  });

  it("blocks manager-decision actions after game over", () => {
    const blocked = [
      "set_pending_decision",
      "skip_decision",
      "set_one_pitch_modifier",
      "set_pinch_hitter_strategy",
      "set_defensive_shift",
    ];
    for (const type of blocked) {
      expect(canProcessActionAfterGameOver({ type })).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// restore_game over a finished game — Bug regression
// ---------------------------------------------------------------------------
describe("restore_game when current game is already over (load-over-finished regression)", () => {
  it("loading an in-progress save over a finished game updates the state", () => {
    const finishedState = makeState({ gameOver: true, inning: 9, score: [5, 3], pitchKey: 50 });
    const { state: afterFirstLoad } = dispatchAction(makeState(), "restore_game", finishedState);
    expect(afterFirstLoad.gameOver).toBe(true);
    expect(afterFirstLoad.score).toEqual([5, 3]);

    // Second load: an in-progress save over the finished game
    const inProgressState = makeState({
      gameOver: false,
      inning: 6,
      score: [2, 1],
      pitchKey: 30,
      playLog: [
        {
          inning: 2,
          half: 0,
          batterNum: 1,
          playerId: "p1",
          team: 0,
          event: Hit.Single,
          runs: 0,
          rbi: 0,
        },
        {
          inning: 4,
          half: 1,
          batterNum: 3,
          playerId: "p3",
          team: 1,
          event: Hit.Homerun,
          runs: 1,
          rbi: 1,
        },
      ],
    });
    const { state: afterSecondLoad } = dispatchAction(
      afterFirstLoad,
      "restore_game",
      inProgressState,
    );

    // State must reflect the newly loaded save — NOT the old finished game
    expect(afterSecondLoad.gameOver).toBe(false);
    expect(afterSecondLoad.inning).toBe(6);
    expect(afterSecondLoad.score).toEqual([2, 1]);
    expect(afterSecondLoad.pitchKey).toBe(30);
    expect(afterSecondLoad.playLog).toHaveLength(2);
  });

  it("loading a finished save over a finished game updates the state (no silent no-op)", () => {
    const finishedA = makeState({ gameOver: true, inning: 9, score: [5, 3], teams: ["A", "B"] });
    const { state: afterA } = dispatchAction(makeState(), "restore_game", finishedA);
    expect(afterA.gameOver).toBe(true);
    expect(afterA.teams).toEqual(["A", "B"]);

    const finishedB = makeState({ gameOver: true, inning: 11, score: [7, 6], teams: ["X", "Y"] });
    const { state: afterB } = dispatchAction(afterA, "restore_game", finishedB);

    // Must switch to game B — not a no-op
    expect(afterB.teams).toEqual(["X", "Y"]);
    expect(afterB.inning).toBe(11);
    expect(afterB.score).toEqual([7, 6]);
  });

  it("loading after multiple consecutive finished games always succeeds", () => {
    let state = makeState();
    for (let i = 0; i < 3; i++) {
      const finished = makeState({ gameOver: true, inning: 9 + i, score: [i + 1, i] });
      const { state: next } = dispatchAction(state, "restore_game", finished);
      expect(next.gameOver).toBe(true);
      expect(next.inning).toBe(9 + i);
      state = next;
    }
    // Finally load an in-progress game
    const inProgress = makeState({ gameOver: false, inning: 4, score: [1, 0] });
    const { state: final } = dispatchAction(state, "restore_game", inProgress);
    expect(final.gameOver).toBe(false);
    expect(final.inning).toBe(4);
  });

  it("gameplay actions remain blocked on the restored finished game", () => {
    const finishedA = makeState({ gameOver: true, strikes: 0 });
    const { state: afterLoad } = dispatchAction(makeState(), "restore_game", finishedA);
    // strike should be blocked because the restored game is also finished
    const { state: afterStrike } = dispatchAction(afterLoad, "strike", { swung: true });
    expect(afterStrike.strikes).toBe(0);
  });

  it("reset is allowed on a finished game to start fresh", () => {
    const finished = makeState({ gameOver: true, score: [5, 3] });
    const { state } = dispatchAction(finished, "reset");
    expect(state.gameOver).toBe(false);
    expect(state.score).toEqual([0, 0]);
    expect(state.inning).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Hit-log after load — Bug regression
// ---------------------------------------------------------------------------
describe("restore_game hit log consistency after load", () => {
  it("restores playLog exactly so hit-log and line-score H column stay in sync", () => {
    const playLog = [
      {
        inning: 1,
        half: 0 as const,
        batterNum: 1,
        playerId: "p1",
        team: 0 as const,
        event: Hit.Single,
        runs: 0,
        rbi: 0,
      },
      {
        inning: 2,
        half: 0 as const,
        batterNum: 2,
        playerId: "p2",
        team: 0 as const,
        event: Hit.Double,
        runs: 1,
        rbi: 1,
      },
      {
        inning: 3,
        half: 1 as const,
        batterNum: 4,
        playerId: "p4",
        team: 1 as const,
        event: Hit.Homerun,
        runs: 2,
        rbi: 2,
      },
      {
        inning: 4,
        half: 0 as const,
        batterNum: 1,
        playerId: "p1",
        team: 0 as const,
        event: Hit.Walk,
        runs: 0,
        rbi: 0,
      },
    ];
    const savedState = makeState({ inning: 6, score: [1, 2], playLog });
    const { state } = dispatchAction(makeState(), "restore_game", savedState);

    // Full log preserved
    expect(state.playLog).toHaveLength(4);
    // Team-0 hits (excl. walk): Single + Double = 2
    const team0Hits = state.playLog.filter((e) => e.team === 0 && e.event !== Hit.Walk).length;
    expect(team0Hits).toBe(2);
    // Team-1 hits: HR = 1
    const team1Hits = state.playLog.filter((e) => e.team === 1 && e.event !== Hit.Walk).length;
    expect(team1Hits).toBe(1);
    // Walk entry present but not counted as hit
    const walks = state.playLog.filter((e) => e.event === Hit.Walk).length;
    expect(walks).toBe(1);
  });

  it("loading an older save without playLog produces an empty (not undefined) log", () => {
    const oldSave = makeState({ inning: 7, score: [3, 2] });
    // @ts-expect-error simulate pre-playLog save
    delete oldSave.playLog;
    const { state } = dispatchAction(makeState(), "restore_game", oldSave);
    expect(Array.isArray(state.playLog)).toBe(true);
    expect(state.playLog).toHaveLength(0);
  });

  it("hit log aligns with batting stats after restore", () => {
    const playLog = [
      {
        inning: 1,
        half: 0 as const,
        batterNum: 3,
        playerId: "p3",
        team: 0 as const,
        event: Hit.Single,
        runs: 0,
        rbi: 0,
      },
      {
        inning: 2,
        half: 0 as const,
        batterNum: 3,
        playerId: "p3",
        team: 0 as const,
        event: Hit.Double,
        runs: 1,
        rbi: 1,
      },
    ];
    const savedState = makeState({ playLog });
    const { state } = dispatchAction(makeState(), "restore_game", savedState);
    const batter3Entries = state.playLog.filter((e) => e.team === 0 && e.batterNum === 3);
    expect(batter3Entries).toHaveLength(2);
    // RBI must be preserved for stats computation
    expect(batter3Entries[0].rbi).toBe(0);
    expect(batter3Entries[1].rbi).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Save → Load → Save round-trip scenarios
// These exercise the reducer state transitions for every meaningful sequence
// a player can perform involving saves, loads, and new games.
// ---------------------------------------------------------------------------
describe("save → load → save round-trip scenarios", () => {
  it("restore_game preserves batter workload and continues incrementing from loaded values", () => {
    const savedState = makeState({
      atBat: 0,
      batterIndex: [0, 0],
      strikes: 2,
      lineupOrder: [
        ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9"],
        ["ph1", "ph2", "ph3", "ph4", "ph5", "ph6", "ph7", "ph8", "ph9"],
      ],
      batterPlateAppearances: [{ p1: 3 }, {}],
    });
    const { state: loaded } = dispatchAction(makeState(), "restore_game", savedState);
    expect(loaded.batterPlateAppearances[0].p1).toBe(3);

    const { state: afterStrikeout } = dispatchAction(loaded, "strike", { swung: true });
    expect(afterStrikeout.batterPlateAppearances[0].p1).toBe(4);
  });

  it("load in-progress → play a hit → state reflects new hit", () => {
    // line_drive + roll 300 → single; 0.8 suppresses stretch-to-3rd.
    vi.spyOn(rngModule, "random").mockReturnValueOnce(0.3).mockReturnValue(0.8);
    const savedState = makeState({ inning: 5, score: [2, 1], pitchKey: 20 });
    const { state: loaded } = dispatchAction(makeState(), "restore_game", savedState);
    expect(loaded.inning).toBe(5);
    // Play a hit from the loaded state
    const { state: afterHit } = dispatchAction(loaded, "hit", {
      battedBallType: "line_drive",
      strategy: "balanced",
    });
    expect(afterHit.score[0]).toBeGreaterThanOrEqual(loaded.score[0]);
    expect(afterHit.pitchKey).toBeGreaterThan(loaded.pitchKey);
  });

  it("load finished save → reset → new game starts from scratch", () => {
    const finished = makeState({
      gameOver: true,
      inning: 9,
      score: [5, 3],
      playLog: [
        {
          inning: 1,
          half: 0,
          batterNum: 1,
          playerId: "p1",
          team: 0,
          event: Hit.Single,
          runs: 0,
          rbi: 0,
        },
      ],
    });
    const { state: loaded } = dispatchAction(makeState(), "restore_game", finished);
    expect(loaded.gameOver).toBe(true);

    const { state: fresh } = dispatchAction(loaded, "reset");
    expect(fresh.gameOver).toBe(false);
    expect(fresh.inning).toBe(1);
    expect(fresh.score).toEqual([0, 0]);
    expect(fresh.playLog).toHaveLength(0);
  });

  it("load save A → load save B → state is exactly save B (not a blend)", () => {
    const saveA = makeState({
      inning: 3,
      score: [1, 0],
      teams: ["Red Sox", "Yankees"],
      playLog: [
        {
          inning: 1,
          half: 0,
          batterNum: 1,
          playerId: "p1",
          team: 0,
          event: Hit.Single,
          runs: 0,
          rbi: 0,
        },
      ],
    });
    const saveB = makeState({
      inning: 7,
      score: [4, 2],
      teams: ["Mets", "Cubs"],
      playLog: [
        {
          inning: 2,
          half: 0,
          batterNum: 2,
          playerId: "p2",
          team: 0,
          event: Hit.Homerun,
          runs: 1,
          rbi: 1,
        },
        {
          inning: 5,
          half: 1,
          batterNum: 1,
          playerId: "p1",
          team: 1,
          event: Hit.Double,
          runs: 0,
          rbi: 0,
        },
      ],
    });
    const { state: afterA } = dispatchAction(makeState(), "restore_game", saveA);
    const { state: afterB } = dispatchAction(afterA, "restore_game", saveB);

    expect(afterB.inning).toBe(7);
    expect(afterB.score).toEqual([4, 2]);
    expect(afterB.teams).toEqual(["Mets", "Cubs"]);
    expect(afterB.playLog).toHaveLength(2);
    // No bleed-through from save A
    expect(afterB.playLog.some((e) => e.event === Hit.Single)).toBe(false);
  });

  it("load finished A → load in-progress B → load finished C → state is C", () => {
    const saveA = makeState({ gameOver: true, inning: 9, score: [5, 3], teams: ["A", "B"] });
    const saveB = makeState({ gameOver: false, inning: 6, score: [2, 1], teams: ["C", "D"] });
    const saveC = makeState({ gameOver: true, inning: 10, score: [3, 3], teams: ["E", "F"] });

    const { state: a } = dispatchAction(makeState(), "restore_game", saveA);
    const { state: b } = dispatchAction(a, "restore_game", saveB);
    const { state: c } = dispatchAction(b, "restore_game", saveC);

    expect(c.gameOver).toBe(true);
    expect(c.teams).toEqual(["E", "F"]);
    expect(c.inning).toBe(10);
    expect(c.score).toEqual([3, 3]);
  });

  it("load save → setTeams still works (team setup during finished game)", () => {
    const finished = makeState({ gameOver: true, teams: ["A", "B"] });
    const { state: loaded } = dispatchAction(makeState(), "restore_game", finished);
    const { state: renamed } = dispatchAction(loaded, "setTeams", ["X", "Y"]);
    expect(renamed.teams).toEqual(["X", "Y"]);
    // gameOver state preserved
    expect(renamed.gameOver).toBe(true);
  });

  it("load save with missing inningRuns → pitchKey increments safely on next pitch", () => {
    mockRandom(0);
    const oldSave = makeState({ inning: 5, score: [2, 1], pitchKey: 15 });
    // @ts-expect-error simulate old save without inningRuns
    delete oldSave.inningRuns;
    const { state: loaded } = dispatchAction(makeState(), "restore_game", oldSave);
    expect(Array.isArray(loaded.inningRuns)).toBe(true);
    // A strike action should proceed without crashing
    expect(() => dispatchAction(loaded, "strike", { swung: true })).not.toThrow();
  });

  it("load save with missing batterIndex → next batter rotation works", () => {
    mockRandom(0);
    const oldSave = makeState({ inning: 3 });
    // @ts-expect-error simulate old save without batterIndex
    delete oldSave.batterIndex;
    const { state: loaded } = dispatchAction(makeState(), "restore_game", oldSave);
    expect(Array.isArray(loaded.batterIndex)).toBe(true);
    // A hit should proceed without crashing
    expect(() =>
      dispatchAction(loaded, "hit", { battedBallType: "pop_up", strategy: "balanced" }),
    ).not.toThrow();
  });
});

describe("steal success pct with runner speed", () => {
  it("fast runner gets higher steal successPct than default", () => {
    const fastState = makeState({
      atBat: 0,
      outs: 1,
      baseLayout: [1, 0, 0] as [number, number, number],
      baseRunnerIds: ["fast-runner", null, null] as [string | null, string | null, string | null],
      playerOverrides: [{ "fast-runner": { speedMod: 20 as ModPreset } }, {}] as [
        TeamCustomPlayerOverrides,
        TeamCustomPlayerOverrides,
      ],
    });
    const slowState = makeState({
      atBat: 0,
      outs: 1,
      baseLayout: [1, 0, 0] as [number, number, number],
      baseRunnerIds: ["slow-runner", null, null] as [string | null, string | null, string | null],
      playerOverrides: [{ "slow-runner": { speedMod: -20 as ModPreset } }, {}] as [
        TeamCustomPlayerOverrides,
        TeamCustomPlayerOverrides,
      ],
    });
    const fastDecision = detectDecision(fastState, "aggressive", true);
    const slowDecision = detectDecision(slowState, "aggressive", true);
    expect(fastDecision?.kind).toBe("steal");
    expect(slowDecision?.kind).toBe("steal");
    if (fastDecision?.kind === "steal" && slowDecision?.kind === "steal") {
      expect(fastDecision.successPct).toBeGreaterThan(slowDecision.successPct);
    }
  });
});
