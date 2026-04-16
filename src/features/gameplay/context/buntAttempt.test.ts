import * as rngModule from "@shared/utils/rng";
import { afterEach, describe, expect, it, vi } from "vitest";

import { makeLogs, makeState } from "@test/testHelpers";

import { buntAttempt } from "./buntAttempt";

afterEach(() => vi.restoreAllMocks());

describe("buntAttempt — bunt single", () => {
  it("bunt single (roll < 8) calls hitBall and places runner on 1st", () => {
    vi.spyOn(rngModule, "random")
      .mockReturnValueOnce(0.05) // bunt roll = 5 < 8 → bunt single
      .mockReturnValue(0); // hitBall subsequent calls → no pop-out
    const { log } = makeLogs();
    const next = buntAttempt(makeState(), log);
    expect(next.baseLayout[0]).toBe(1);
  });

  it("bunt single with contact strategy (roll < 20)", () => {
    vi.spyOn(rngModule, "random")
      .mockReturnValueOnce(0.15) // roll = 15 < 20 → bunt single for contact
      .mockReturnValue(0);
    const { log } = makeLogs();
    const next = buntAttempt(makeState(), log, "contact");
    expect(next.baseLayout[0]).toBe(1);
  });
});

describe("buntAttempt — fielder's choice", () => {
  it("FC: runner on 1st only — batter safe, lead runner out", () => {
    vi.spyOn(rngModule, "random").mockReturnValueOnce(0.15); // roll=15, 8<=15<20 → FC
    const { logs, log } = makeLogs();
    const next = buntAttempt(makeState({ baseLayout: [1, 0, 0] }), log);
    expect(next.outs).toBe(1);
    expect(next.baseLayout[0]).toBe(1);
    expect(logs.some((l) => l.includes("Fielder's choice"))).toBe(true);
  });

  it("FC: runner on 1st + 3rd — 3rd scores, batter safe", () => {
    vi.spyOn(rngModule, "random").mockReturnValueOnce(0.15);
    const { log } = makeLogs();
    const next = buntAttempt(makeState({ baseLayout: [1, 0, 1], score: [0, 0] }), log);
    expect(next.score[0]).toBe(1); // 3rd runner scored
    expect(next.baseLayout[0]).toBe(1); // batter safe at 1st
    expect(next.baseLayout[2]).toBe(0); // 3rd base now empty
  });

  it("FC: runner on 1st + 2nd — 2nd advances to 3rd", () => {
    vi.spyOn(rngModule, "random").mockReturnValueOnce(0.15);
    const { log } = makeLogs();
    const next = buntAttempt(makeState({ baseLayout: [1, 1, 0] }), log);
    expect(next.baseLayout[0]).toBe(1);
    expect(next.baseLayout[2]).toBe(1); // 2nd advanced to 3rd
  });

  it("FC: runner on 2nd only — 2nd is lead runner", () => {
    vi.spyOn(rngModule, "random").mockReturnValueOnce(0.15);
    const { log } = makeLogs();
    const next = buntAttempt(makeState({ baseLayout: [0, 1, 0] }), log);
    expect(next.outs).toBe(1);
  });

  it("FC with pitchKey undefined falls back to 0 + 1 = 1", () => {
    vi.spyOn(rngModule, "random").mockReturnValueOnce(0.15);
    const { log } = makeLogs();
    const state = makeState({ baseLayout: [1, 0, 0] });

    (state as any).pitchKey = undefined;
    const next = buntAttempt(state, log);
    expect(next.outs).toBe(1);
  });
});

describe("buntAttempt — fielder's choice extras", () => {
  it("FC: runner on 2nd + 3rd — 3rd scores", () => {
    vi.spyOn(rngModule, "random").mockReturnValueOnce(0.15);
    const { log } = makeLogs();
    const next = buntAttempt(makeState({ baseLayout: [0, 1, 1], score: [0, 0] }), log);
    expect(next.score[0]).toBe(1);
  });
});

describe("buntAttempt — sacrifice bunt", () => {
  it("sac bunt: runner on 3rd scores", () => {
    vi.spyOn(rngModule, "random").mockReturnValueOnce(0.5); // roll=50, 20<=50<80 → sac bunt
    const { logs, log } = makeLogs();
    const next = buntAttempt(makeState({ baseLayout: [0, 0, 1], score: [0, 0] }), log);
    expect(next.score[0]).toBe(1);
    expect(logs.some((l) => l.includes("Sacrifice bunt"))).toBe(true);
  });

  it("sac bunt: runner on 2nd advances to 3rd", () => {
    vi.spyOn(rngModule, "random").mockReturnValueOnce(0.5);
    const { log } = makeLogs();
    const next = buntAttempt(makeState({ baseLayout: [0, 1, 0] }), log);
    expect(next.baseLayout[2]).toBe(1);
    expect(next.baseLayout[1]).toBe(0);
  });

  it("sac bunt: runner on 1st advances to 2nd", () => {
    vi.spyOn(rngModule, "random").mockReturnValueOnce(0.5);
    const { log } = makeLogs();
    const next = buntAttempt(makeState({ baseLayout: [1, 0, 0] }), log);
    expect(next.baseLayout[1]).toBe(1);
    expect(next.baseLayout[0]).toBe(0);
  });

  it("sac bunt: all bases loaded — 3rd scores, others advance", () => {
    vi.spyOn(rngModule, "random").mockReturnValueOnce(0.5);
    const { log } = makeLogs();
    const next = buntAttempt(makeState({ baseLayout: [1, 1, 1], score: [0, 0] }), log);
    expect(next.score[0]).toBe(1);
    expect(next.baseLayout[2]).toBe(1);
    expect(next.baseLayout[1]).toBe(1);
    expect(next.baseLayout[0]).toBe(0);
  });

  it("sac bunt with pitchKey undefined falls back to 0 + 1 = 1", () => {
    vi.spyOn(rngModule, "random").mockReturnValueOnce(0.5);
    const { log } = makeLogs();
    const state = makeState({ baseLayout: [1, 0, 0] });

    (state as any).pitchKey = undefined;
    const next = buntAttempt(state, log);
    expect(next.outs).toBe(1);
  });
});

describe("buntAttempt — bunt pop-out", () => {
  it("pop-out (roll >= 80) records an out", () => {
    vi.spyOn(rngModule, "random").mockReturnValueOnce(0.85); // roll=85 >= 80 → pop-out
    const { logs, log } = makeLogs();
    const next = buntAttempt(makeState(), log);
    expect(next.outs).toBe(1);
    expect(logs.some((l) => l.includes("popped up"))).toBe(true);
  });

  it("pop-out with pitchKey undefined falls back to 0 + 1 = 1", () => {
    vi.spyOn(rngModule, "random").mockReturnValueOnce(0.85);
    const { log } = makeLogs();
    const state = makeState();

    (state as any).pitchKey = undefined;
    const next = buntAttempt(state, log);
    expect(next.outs).toBe(1);
  });
});

describe("buntAttempt — 2-strike foul bunt strikeout", () => {
  it("foul bunt (roll >= 80) with 2 strikes logs strike three and records an out", () => {
    vi.spyOn(rngModule, "random").mockReturnValueOnce(0.85); // roll=85 >= 80 → foul bunt
    const { logs, log } = makeLogs();
    const next = buntAttempt(makeState({ strikes: 2 }), log);
    expect(next.outs).toBe(1);
    expect(logs.some((l) => l.includes("strike three"))).toBe(true);
  });

  it("foul bunt (roll >= 80) with 1 strike falls through to pop-out, not strikeout", () => {
    vi.spyOn(rngModule, "random").mockReturnValueOnce(0.85); // roll=85 >= 80 → still pop-out
    const { logs, log } = makeLogs();
    const next = buntAttempt(makeState({ strikes: 1 }), log);
    expect(next.outs).toBe(1);
    expect(logs.some((l) => l.includes("popped up"))).toBe(true);
    expect(logs.some((l) => l.includes("strike three"))).toBe(false);
  });

  it("foul bunt (roll >= 80) with 0 strikes falls through to pop-out, not strikeout", () => {
    vi.spyOn(rngModule, "random").mockReturnValueOnce(0.85); // roll=85 >= 80 → still pop-out
    const { logs, log } = makeLogs();
    const next = buntAttempt(makeState({ strikes: 0 }), log);
    expect(next.outs).toBe(1);
    expect(logs.some((l) => l.includes("popped up"))).toBe(true);
    expect(logs.some((l) => l.includes("strike three"))).toBe(false);
  });

  it("roll < 80 with 2 strikes does NOT produce a foul bunt strikeout", () => {
    vi.spyOn(rngModule, "random").mockReturnValueOnce(0.5); // roll=50 < 80 → sac bunt
    const { logs, log } = makeLogs();
    const next = buntAttempt(makeState({ strikes: 2 }), log);
    expect(logs.some((l) => l.includes("strike three"))).toBe(false);
    expect(logs.some((l) => l.includes("Sacrifice bunt"))).toBe(true);
  });
});
