import { afterEach, describe, expect, it, vi } from "vitest";

import { makeLogs, makeState } from "@test/testHelpers";

import { nextBatter, playerOut } from "./playerOut";

afterEach(() => vi.restoreAllMocks());

describe("playerOut", () => {
  it("one out logs 'One out.' and increments outs", () => {
    const { logs, log } = makeLogs();
    const next = playerOut(makeState({ outs: 0 }), log);
    expect(next.outs).toBe(1);
    expect(logs).toContain("One out.");
  });

  it("two outs logs 'Two outs.' and increments outs", () => {
    const { logs, log } = makeLogs();
    const next = playerOut(makeState({ outs: 1 }), log);
    expect(next.outs).toBe(2);
    expect(logs).toContain("Two outs.");
  });

  it("three outs transitions to next half-inning", () => {
    const { log } = makeLogs();
    const next = playerOut(makeState({ outs: 2, atBat: 0, inning: 1 }), log);
    expect(next.outs).toBe(0);
    expect(next.atBat).toBe(1);
  });

  it("three outs in bottom of 9th with home leading → gameOver", () => {
    const { log } = makeLogs();
    const next = playerOut(makeState({ outs: 2, atBat: 1, inning: 9, score: [1, 2] }), log);
    expect(next.gameOver).toBe(true);
  });

  it("resets strikes and balls when batterCompleted=true (batter out)", () => {
    const { log } = makeLogs();
    const next = playerOut(makeState({ outs: 0, strikes: 2, balls: 3 }), log, true);
    expect(next.strikes).toBe(0);
    expect(next.balls).toBe(0);
  });

  it("preserves strikes and balls when batterCompleted=false (caught stealing — MLB rule 5.06(b)(4)(G))", () => {
    const { log } = makeLogs();
    const next = playerOut(makeState({ outs: 0, strikes: 2, balls: 3 }), log, false);
    expect(next.strikes).toBe(2);
    expect(next.balls).toBe(3);
  });

  it("does NOT rotate batting order when batterCompleted=false (caught stealing)", () => {
    const { log } = makeLogs();
    const next = playerOut(makeState({ batterIndex: [2, 0] }), log, false);
    expect(next.batterIndex[0]).toBe(2);
  });

  it("DOES rotate batting order when batterCompleted=true (strikeout / popup)", () => {
    const { log } = makeLogs();
    const next = playerOut(makeState({ batterIndex: [2, 0] }), log, true);
    expect(next.batterIndex[0]).toBe(3);
  });

  it("DOES increment outsPitched but NOT battersFaced when batterCompleted=false (caught stealing / DP runner out)", () => {
    const { log } = makeLogs();
    const pitcherEntry = {
      teamIdx: 1 as 0 | 1,
      pitcherId: "p1",
      inningEntered: 1,
      halfEntered: 0 as 0 | 1,
      scoreOnEntry: [0, 0] as [number, number],
      outsPitched: 5,
      battersFaced: 7,
      pitchesThrown: 0,
      hitsAllowed: 2,
      walksAllowed: 1,
      strikeoutsRecorded: 2,
      runsAllowed: 0,
      homersAllowed: 0,
    };
    // atBat=0 → away batting → home pitching (teamIdx=1)
    const next = playerOut(
      makeState({ atBat: 0, pitcherGameLog: [[], [pitcherEntry]] }),
      log,
      false,
    );
    expect(next.pitcherGameLog![1][0].outsPitched).toBe(6); // incremented — the runner out counts toward IP
    expect(next.pitcherGameLog![1][0].battersFaced).toBe(7); // unchanged — batter's PA is not over
  });

  it("DOES increment outsPitched and battersFaced when batterCompleted=true (strikeout)", () => {
    const { log } = makeLogs();
    const pitcherEntry = {
      teamIdx: 1 as 0 | 1,
      pitcherId: "p1",
      inningEntered: 1,
      halfEntered: 0 as 0 | 1,
      scoreOnEntry: [0, 0] as [number, number],
      outsPitched: 5,
      battersFaced: 7,
      pitchesThrown: 0,
      hitsAllowed: 2,
      walksAllowed: 1,
      strikeoutsRecorded: 2,
      runsAllowed: 0,
      homersAllowed: 0,
    };
    const next = playerOut(
      makeState({ atBat: 0, pitcherGameLog: [[], [pitcherEntry]] }),
      log,
      true,
    );
    expect(next.pitcherGameLog![1][0].outsPitched).toBe(6); // incremented — batter's PA is done
    expect(next.pitcherGameLog![1][0].battersFaced).toBe(8); // incremented
  });

  it("batting order does NOT reset between half-innings", () => {
    const { log } = makeLogs();
    const next = playerOut(
      makeState({ outs: 2, atBat: 0, inning: 1, batterIndex: [5, 0] }),
      log,
      true,
    );
    expect(next.atBat).toBe(1);
    expect(next.batterIndex[0]).toBe(6);
    expect(next.batterIndex[1]).toBe(0);
  });

  it("6-4-3 double play: pitcher receives 2 outsPitched total (first call batterCompleted=false, second true)", () => {
    const { log } = makeLogs();
    const pitcherEntry = {
      teamIdx: 1 as 0 | 1,
      pitcherId: "p1",
      inningEntered: 1,
      halfEntered: 0 as 0 | 1,
      scoreOnEntry: [0, 0] as [number, number],
      outsPitched: 0,
      battersFaced: 0,
      pitchesThrown: 0,
      hitsAllowed: 0,
      walksAllowed: 0,
      strikeoutsRecorded: 0,
      runsAllowed: 0,
      homersAllowed: 0,
    };
    // atBat=0 → away batting → home pitching (teamIdx=1)
    const state0 = makeState({ atBat: 0, outs: 0, pitcherGameLog: [[], [pitcherEntry]] });
    // First call: runner forced out at 2nd (batterCompleted=false) — first out of the DP
    const state1 = playerOut(state0, log, false);
    expect(state1.pitcherGameLog![1][0].outsPitched).toBe(1); // runner out counted
    expect(state1.pitcherGameLog![1][0].battersFaced).toBe(0); // batter PA not over
    // Second call: batter thrown out at 1st (batterCompleted=true) — second out of the DP
    const state2 = playerOut(state1, log, true);
    expect(state2.pitcherGameLog![1][0].outsPitched).toBe(2); // 2/3 IP credited
    expect(state2.pitcherGameLog![1][0].battersFaced).toBe(1); // batter PA now complete
  });
});

describe("nextBatter", () => {
  it("advances batterIndex for the team currently at bat (team 0)", () => {
    const next = nextBatter(makeState({ atBat: 0, batterIndex: [3, 5] }));
    expect(next.batterIndex[0]).toBe(4);
    expect(next.batterIndex[1]).toBe(5);
  });

  it("advances batterIndex for the team currently at bat (team 1)", () => {
    const next = nextBatter(makeState({ atBat: 1, batterIndex: [3, 5] }));
    expect(next.batterIndex[0]).toBe(3);
    expect(next.batterIndex[1]).toBe(6);
  });

  it("wraps from position 8 back to 0 (end of lineup)", () => {
    const next = nextBatter(makeState({ atBat: 0, batterIndex: [8, 0] }));
    expect(next.batterIndex[0]).toBe(0);
  });
});
