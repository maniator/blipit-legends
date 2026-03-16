/**
 * Unit tests for pitcherLog.ts pure helpers.
 */
import { describe, expect, it } from "vitest";

import type { PitcherLogEntry } from "./gameLogTypes";
import {
  activePitcherLogIdx,
  createPitcherLogEntry,
  pushPitcherLogEntry,
  updateActivePitcherLog,
} from "./pitcherLog";

// Minimal State-like fixture (only the fields pitcherLog helpers read).
const baseState = {
  inning: 1,
  atBat: 0 as 0 | 1,
  score: [0, 0] as [number, number],
} as Parameters<typeof createPitcherLogEntry>[2];

function makeEntry(overrides: Partial<PitcherLogEntry> = {}): PitcherLogEntry {
  return {
    teamIdx: 0,
    pitcherId: "pitcher1",
    inningEntered: 1,
    halfEntered: 0,
    scoreOnEntry: [0, 0],
    outsPitched: 0,
    battersFaced: 0,
    hitsAllowed: 0,
    walksAllowed: 0,
    strikeoutsRecorded: 0,
    runsAllowed: 0,
    homersAllowed: 0,
    ...overrides,
  };
}

describe("createPitcherLogEntry", () => {
  it("creates an entry with the correct teamIdx and pitcherId", () => {
    const entry = createPitcherLogEntry(1, "p42", baseState);
    expect(entry.teamIdx).toBe(1);
    expect(entry.pitcherId).toBe("p42");
  });

  it("captures inning and score on entry from state", () => {
    const state = { ...baseState, inning: 5, score: [3, 2] as [number, number] };
    const entry = createPitcherLogEntry(0, "p1", state);
    expect(entry.inningEntered).toBe(5);
    expect(entry.scoreOnEntry).toEqual([3, 2]);
  });

  it("initialises all counting stats to zero", () => {
    const entry = createPitcherLogEntry(0, "p1", baseState);
    expect(entry.outsPitched).toBe(0);
    expect(entry.battersFaced).toBe(0);
    expect(entry.hitsAllowed).toBe(0);
    expect(entry.walksAllowed).toBe(0);
    expect(entry.strikeoutsRecorded).toBe(0);
    expect(entry.runsAllowed).toBe(0);
    expect(entry.homersAllowed).toBe(0);
  });

  it("captures atBat as halfEntered", () => {
    const state = { ...baseState, atBat: 1 as 0 | 1 };
    const entry = createPitcherLogEntry(1, "p1", state);
    expect(entry.halfEntered).toBe(1);
  });
});

describe("activePitcherLogIdx", () => {
  it("returns -1 when the team log is empty", () => {
    const log: [PitcherLogEntry[], PitcherLogEntry[]] = [[], []];
    expect(activePitcherLogIdx(log, 0)).toBe(-1);
  });

  it("returns 0 when there is exactly one entry", () => {
    const entry = makeEntry();
    const log: [PitcherLogEntry[], PitcherLogEntry[]] = [[entry], []];
    expect(activePitcherLogIdx(log, 0)).toBe(0);
  });

  it("returns the last index when multiple entries exist", () => {
    const entries = [makeEntry(), makeEntry({ pitcherId: "p2" }), makeEntry({ pitcherId: "p3" })];
    const log: [PitcherLogEntry[], PitcherLogEntry[]] = [entries, []];
    expect(activePitcherLogIdx(log, 0)).toBe(2);
  });

  it("works for team index 1", () => {
    const entry = makeEntry({ teamIdx: 1 });
    const log: [PitcherLogEntry[], PitcherLogEntry[]] = [[], [entry, makeEntry({ teamIdx: 1 })]];
    expect(activePitcherLogIdx(log, 1)).toBe(1);
  });
});

describe("updateActivePitcherLog", () => {
  it("returns the same reference when the team log is empty", () => {
    const log: [PitcherLogEntry[], PitcherLogEntry[]] = [[], []];
    const result = updateActivePitcherLog(log, 0, (e) => ({ ...e, outsPitched: 1 }));
    expect(result).toBe(log); // same reference — no copy
  });

  it("updates the last entry for team 0", () => {
    const entry = makeEntry({ outsPitched: 3 });
    const log: [PitcherLogEntry[], PitcherLogEntry[]] = [[entry], []];
    const result = updateActivePitcherLog(log, 0, (e) => ({
      ...e,
      outsPitched: e.outsPitched + 1,
    }));
    expect(result[0][0].outsPitched).toBe(4);
  });

  it("updates the last entry for team 1", () => {
    const entry = makeEntry({ teamIdx: 1, outsPitched: 6 });
    const log: [PitcherLogEntry[], PitcherLogEntry[]] = [[], [entry]];
    const result = updateActivePitcherLog(log, 1, (e) => ({
      ...e,
      outsPitched: e.outsPitched + 3,
    }));
    expect(result[1][0].outsPitched).toBe(9);
  });

  it("does not mutate entries before the last one", () => {
    const first = makeEntry({ pitcherId: "p1", outsPitched: 9 });
    const last = makeEntry({ pitcherId: "p2", outsPitched: 3 });
    const log: [PitcherLogEntry[], PitcherLogEntry[]] = [[first, last], []];
    const result = updateActivePitcherLog(log, 0, (e) => ({ ...e, outsPitched: 6 }));
    expect(result[0][0].outsPitched).toBe(9); // first unchanged
    expect(result[0][1].outsPitched).toBe(6); // last updated
  });
});

describe("pushPitcherLogEntry", () => {
  it("appends an entry to team 0's log", () => {
    const log: [PitcherLogEntry[], PitcherLogEntry[]] = [[], []];
    const entry = makeEntry();
    const result = pushPitcherLogEntry(log, 0, entry);
    expect(result[0]).toHaveLength(1);
    expect(result[0][0]).toBe(entry);
    expect(result[1]).toHaveLength(0);
  });

  it("appends an entry to team 1's log", () => {
    const log: [PitcherLogEntry[], PitcherLogEntry[]] = [[], []];
    const entry = makeEntry({ teamIdx: 1 });
    const result = pushPitcherLogEntry(log, 1, entry);
    expect(result[1]).toHaveLength(1);
    expect(result[1][0]).toBe(entry);
    expect(result[0]).toHaveLength(0);
  });

  it("preserves existing entries when pushing to team 0", () => {
    const existing = makeEntry({ pitcherId: "p1" });
    const newEntry = makeEntry({ pitcherId: "p2" });
    const log: [PitcherLogEntry[], PitcherLogEntry[]] = [[existing], []];
    const result = pushPitcherLogEntry(log, 0, newEntry);
    expect(result[0]).toHaveLength(2);
    expect(result[0][0].pitcherId).toBe("p1");
    expect(result[0][1].pitcherId).toBe("p2");
  });
});
