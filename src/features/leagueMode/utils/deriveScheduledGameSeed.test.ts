import { describe, expect, it } from "vitest";

import { deriveScheduledGameSeed } from "./deriveScheduledGameSeed";

describe("deriveScheduledGameSeed", () => {
  it("produces the same output for the same inputs (stable across 100 calls)", () => {
    const leagueSeasonId = "lsn_abc123";
    const scheduledGameId = "sgame_xyz789";
    const first = deriveScheduledGameSeed(leagueSeasonId, scheduledGameId);
    for (let i = 0; i < 99; i++) {
      expect(deriveScheduledGameSeed(leagueSeasonId, scheduledGameId)).toBe(first);
    }
  });

  it("result only contains base-36 chars [0-9a-z]", () => {
    const result = deriveScheduledGameSeed("lsn_test", "sgame_test");
    expect(result).toMatch(/^[0-9a-z]+$/);
  });

  it("different scheduledGameId produces a different seed", () => {
    const leagueSeasonId = "lsn_same";
    const seed1 = deriveScheduledGameSeed(leagueSeasonId, "sgame_aaa");
    const seed2 = deriveScheduledGameSeed(leagueSeasonId, "sgame_bbb");
    expect(seed1).not.toBe(seed2);
  });

  it("different leagueSeasonId produces a different seed", () => {
    const scheduledGameId = "sgame_same";
    const seed1 = deriveScheduledGameSeed("lsn_aaa", scheduledGameId);
    const seed2 = deriveScheduledGameSeed("lsn_bbb", scheduledGameId);
    expect(seed1).not.toBe(seed2);
  });
});
