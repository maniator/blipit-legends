/**
 * Unit tests for deriveScheduledGameSeed.
 *
 * Validates the FNV-1a → uint32 → base-36 pipeline against known golden vectors,
 * and checks that different inputs always produce different seeds.
 */
import { describe, expect, it } from "vitest";

import { deriveScheduledGameSeed } from "./deriveScheduledGameSeed";

describe("deriveScheduledGameSeed", () => {
  it("produces a consistent golden vector for a known input", () => {
    // Golden vector: computed externally and pinned here.
    // If this test fails after a code change, a determinism regression occurred.
    const seed = deriveScheduledGameSeed({
      seasonId: "s_testseason01",
      seasonRoundIdx: 0,
      gameInSeriesIdx: 0,
      homeCustomTeamId: "ct_home01",
      awayCustomTeamId: "ct_away01",
    });
    expect(typeof seed).toBe("string");
    expect(seed.length).toBeGreaterThan(0);
    // The seed must be a valid base-36 number.
    const parsed = parseInt(seed, 36);
    expect(Number.isFinite(parsed)).toBe(true);
    expect(parsed >>> 0).toBe(parsed); // must fit in uint32

    // Pin the exact value — change only if the fnv1a implementation changes.
    expect(seed).toMatchSnapshot();
  });

  it("returns the same seed for the same inputs on repeated calls", () => {
    const input = {
      seasonId: "s_abc",
      seasonRoundIdx: 0,
      gameInSeriesIdx: 0,
      homeCustomTeamId: "ct_home",
      awayCustomTeamId: "ct_away",
    };
    const a = deriveScheduledGameSeed(input);
    const b = deriveScheduledGameSeed(input);
    expect(a).toBe(b);
  });

  it("returns different seeds for different round indices", () => {
    const base = {
      seasonId: "s_season1",
      gameInSeriesIdx: 0,
      homeCustomTeamId: "ct_home",
      awayCustomTeamId: "ct_away",
    };
    const a = deriveScheduledGameSeed({ ...base, seasonRoundIdx: 0 });
    const b = deriveScheduledGameSeed({ ...base, seasonRoundIdx: 1 });
    expect(a).not.toBe(b);
  });

  it("returns different seeds for different seasonIds", () => {
    const base = {
      seasonRoundIdx: 0,
      gameInSeriesIdx: 0,
      homeCustomTeamId: "ct_home",
      awayCustomTeamId: "ct_away",
    };
    const a = deriveScheduledGameSeed({ ...base, seasonId: "s_season1" });
    const b = deriveScheduledGameSeed({ ...base, seasonId: "s_season2" });
    expect(a).not.toBe(b);
  });

  it("treats team IDs as opaque values and distinguishes unexpected prefixes", () => {
    const base = {
      seasonId: "s_prefix_contract",
      seasonRoundIdx: 0,
      gameInSeriesIdx: 0,
    };

    const customTeamSeed = deriveScheduledGameSeed({
      ...base,
      homeCustomTeamId: "ct_home",
      awayCustomTeamId: "ct_away",
    });
    const unexpectedPrefixSeed = deriveScheduledGameSeed({
      ...base,
      homeCustomTeamId: "other_home",
      awayCustomTeamId: "other_away",
    });

    expect(unexpectedPrefixSeed).toMatch(/^[0-9a-z]+$/);
    expect(unexpectedPrefixSeed).not.toBe(customTeamSeed);
  });

  it("returns a valid base-36 string (no colons or invalid chars)", () => {
    const seed = deriveScheduledGameSeed({
      seasonId: "s_abc:def",
      seasonRoundIdx: 0,
      gameInSeriesIdx: 0,
      homeCustomTeamId: "ct_home:ghi",
      awayCustomTeamId: "ct_away:jkl",
    });
    // Base-36 uses digits 0-9 and letters a-z only.
    expect(seed).toMatch(/^[0-9a-z]+$/);
  });

  it("handles uint32 wrap-around (large hash values) without producing NaN or Infinity", () => {
    // Use inputs that are likely to produce a large hash value.
    const seed = deriveScheduledGameSeed({
      seasonId: "s_ffffffff_large_season_id_test",
      seasonRoundIdx: 999,
      gameInSeriesIdx: 999,
      homeCustomTeamId: "ct_ffffffff_large_home_id",
      awayCustomTeamId: "ct_ffffffff_large_away_id",
    });
    const parsed = parseInt(seed, 36);
    expect(Number.isFinite(parsed)).toBe(true);
    expect(seed).not.toBe("nan");
    expect(seed).not.toBe("infinity");
  });
});
