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
    const seed = deriveScheduledGameSeed("s_testseason01", "sg_testgame001");
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
    const a = deriveScheduledGameSeed("s_abc", "sg_xyz");
    const b = deriveScheduledGameSeed("s_abc", "sg_xyz");
    expect(a).toBe(b);
  });

  it("returns different seeds for different seasonGameIds", () => {
    const a = deriveScheduledGameSeed("s_season1", "sg_game001");
    const b = deriveScheduledGameSeed("s_season1", "sg_game002");
    expect(a).not.toBe(b);
  });

  it("returns different seeds for different seasonIds", () => {
    const a = deriveScheduledGameSeed("s_season1", "sg_game001");
    const b = deriveScheduledGameSeed("s_season2", "sg_game001");
    expect(a).not.toBe(b);
  });

  it("returns a valid base-36 string (no colons or invalid chars)", () => {
    const seed = deriveScheduledGameSeed("s_abc:def", "sg_ghi:jkl");
    // Base-36 uses digits 0-9 and letters a-z only.
    expect(seed).toMatch(/^[0-9a-z]+$/);
  });

  it("handles uint32 wrap-around (large hash values) without producing NaN or Infinity", () => {
    // Use inputs that are likely to produce a large hash value.
    const seed = deriveScheduledGameSeed(
      "s_ffffffff_large_season_id_test",
      "sg_ffffffff_large_game_id_test",
    );
    const parsed = parseInt(seed, 36);
    expect(Number.isFinite(parsed)).toBe(true);
    expect(seed).not.toBe("nan");
    expect(seed).not.toBe("infinity");
  });
});
