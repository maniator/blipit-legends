import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { BallgameDb } from "@storage/db";
import type { CreateCustomTeamInput, TeamPlayer } from "@storage/types";
import { makePlayer as makeSharedPlayer } from "@test/helpers/customTeams";
import { createTestDb } from "@test/helpers/db";

import {
  buildRoster,
  clampStat,
  HITTER_STAT_CAP,
  PITCHER_STAT_CAP,
  requireNonEmpty,
  ROSTER_SCHEMA_VERSION,
  sanitizeAbbreviation,
  sanitizePlayer,
  STAT_MAX,
  STAT_MIN,
  validatePlayerStatCaps,
} from "./customTeamSanitizers";
import { makeCustomTeamStore } from "./customTeamStore";

const makePlayer = (overrides: Partial<TeamPlayer> = {}): TeamPlayer => ({
  id: "p1",
  name: "Test Player",
  role: "batter",
  batting: { contact: 50, power: 50, speed: 50, stamina: 50 },
  position: "CF",
  handedness: "R",
  ...overrides,
});

describe("constants", () => {
  it("STAT_MIN is 0", () => expect(STAT_MIN).toBe(0));
  it("STAT_MAX is 100", () => expect(STAT_MAX).toBe(100));
  it("ROSTER_SCHEMA_VERSION is 1", () => expect(ROSTER_SCHEMA_VERSION).toBe(1));
});

describe("requireNonEmpty", () => {
  it("returns trimmed string for valid input", () => {
    expect(requireNonEmpty("  hello  ", "field")).toBe("hello");
  });

  it("throws on empty string", () => {
    expect(() => requireNonEmpty("", "myField")).toThrow("myField must be a non-empty string");
  });

  it("throws on whitespace-only string", () => {
    expect(() => requireNonEmpty("   ", "myField")).toThrow("myField must be a non-empty string");
  });

  it("throws on non-string", () => {
    expect(() => requireNonEmpty(42, "myField")).toThrow("myField must be a non-empty string");
    expect(() => requireNonEmpty(null, "myField")).toThrow("myField must be a non-empty string");
    expect(() => requireNonEmpty(undefined, "myField")).toThrow(
      "myField must be a non-empty string",
    );
  });
});

describe("sanitizeAbbreviation", () => {
  it("trims and uppercases valid abbreviation", () => {
    expect(sanitizeAbbreviation("  ny  ")).toBe("NY");
  });

  it("accepts 2-character abbreviation", () => {
    expect(sanitizeAbbreviation("SF")).toBe("SF");
  });

  it("accepts 3-character abbreviation", () => {
    expect(sanitizeAbbreviation("BOS")).toBe("BOS");
  });

  it("throws on 1-character abbreviation", () => {
    expect(() => sanitizeAbbreviation("A")).toThrow(
      'abbreviation must be 2–3 characters (got "A")',
    );
  });

  it("throws on 4-character abbreviation", () => {
    expect(() => sanitizeAbbreviation("LONG")).toThrow(
      'abbreviation must be 2–3 characters (got "LONG")',
    );
  });
});

describe("clampStat", () => {
  it("clamps values below STAT_MIN to 0", () => {
    expect(clampStat(-10)).toBe(0);
    expect(clampStat(-1)).toBe(0);
  });

  it("clamps values above STAT_MAX to 100", () => {
    expect(clampStat(101)).toBe(100);
    expect(clampStat(999)).toBe(100);
  });

  it("passes through in-range values", () => {
    expect(clampStat(0)).toBe(0);
    expect(clampStat(50)).toBe(50);
    expect(clampStat(100)).toBe(100);
  });

  it("returns STAT_MIN (0) for NaN input", () => {
    expect(clampStat(NaN)).toBe(0);
  });

  it("returns STAT_MIN (0) for Infinity input", () => {
    // Infinity is finite=false → defaults to STAT_MIN, then clamp → 0
    // (Infinity is not finite)
    expect(clampStat(Infinity)).toBe(0);
    expect(clampStat(-Infinity)).toBe(0);
  });
});

describe("sanitizePlayer", () => {
  it("trims player name", () => {
    const result = sanitizePlayer(makePlayer({ name: "  John Doe  " }), { index: 0 });
    expect(result.name).toBe("John Doe");
  });

  it("throws on empty player name", () => {
    expect(() => sanitizePlayer(makePlayer({ name: "" }), { index: 0 })).toThrow(
      "roster player[0].name must be a non-empty string",
    );
  });

  it("throws on invalid role", () => {
    // @ts-expect-error testing invalid role
    expect(() => sanitizePlayer(makePlayer({ role: "fielder" }), { index: 2 })).toThrow(
      'roster player[2].role must be "batter", "pitcher", or "two-way"',
    );
  });

  it("throws when batting is missing", () => {
    // @ts-expect-error testing missing batting
    expect(() => sanitizePlayer(makePlayer({ batting: null }), { index: 0 })).toThrow(
      "roster player[0].batting is required",
    );
  });

  it("clamps batting stats", () => {
    const result = sanitizePlayer(
      makePlayer({ batting: { contact: 150, power: -5, speed: 50, stamina: 50 } }),
      {
        index: 0,
      },
    );
    expect(result.batting.contact).toBe(100);
    expect(result.batting.power).toBe(0);
    expect(result.batting.speed).toBe(50);
  });

  it("does not include playerSeed in output (legacy field stripped from PlayerRecord)", () => {
    const result = sanitizePlayer(makePlayer(), { index: 0 });
    expect("playerSeed" in result).toBe(false);
  });

  it("preserves non-temp player.id in output", () => {
    const player = makePlayer({ id: "import_player_42" });
    const result = sanitizePlayer(player, { index: 0 });
    expect(result.id).toBe("import_player_42");
  });

  it("remaps editor-temp player IDs", () => {
    const result = sanitizePlayer(makePlayer({ id: "ep_7" }), { index: 0 });
    expect(result.id).toMatch(/^p_/);
    expect(result.id).not.toBe("ep_7");
  });

  it("generates fingerprint", () => {
    const result = sanitizePlayer(makePlayer(), { index: 0 });
    expect(typeof result.fingerprint).toBe("string");
    expect(result.fingerprint!.length).toBeGreaterThan(0);
  });

  it("clamps pitching stats when present", () => {
    const result = sanitizePlayer(
      makePlayer({
        role: "pitcher",
        pitching: { velocity: 200, control: -10, movement: 55, stamina: 130 },
      }),
      { index: 0 },
    );
    expect(result.pitching!.velocity).toBe(100);
    expect(result.pitching!.control).toBe(0);
    expect(result.pitching!.movement).toBe(55);
    expect(result.pitching!.stamina).toBe(100);
  });

  it("clamps batting stamina when present", () => {
    const result = sanitizePlayer(
      makePlayer({ batting: { contact: 50, power: 50, speed: 50, stamina: -20 } }),
      {
        index: 0,
      },
    );
    expect(result.batting.stamina).toBe(0);
  });

  it("omits pitching when not provided", () => {
    const result = sanitizePlayer(makePlayer({ role: "batter" }), { index: 0 });
    expect(result.pitching).toBeUndefined();
  });

  it("accepts two-way role", () => {
    const result = sanitizePlayer(
      makePlayer({
        role: "two-way",
        pitching: { velocity: 60, control: 50, movement: 50, stamina: 60 },
      }),
      { index: 0 },
    );
    expect(result.role).toBe("two-way");
  });
});

describe("buildRoster", () => {
  it("returns roster with schemaVersion", () => {
    const result = buildRoster({ lineup: [makePlayer()] });
    expect(result.schemaVersion).toBe(ROSTER_SCHEMA_VERSION);
  });

  it("throws when lineup is empty", () => {
    expect(() => buildRoster({ lineup: [] })).toThrow("roster.lineup must have at least 1 player");
  });

  it("throws when lineup is not an array", () => {
    // @ts-expect-error testing invalid input
    expect(() => buildRoster({ lineup: null })).toThrow(
      "roster.lineup must have at least 1 player",
    );
  });

  it("sanitizes all players in lineup", () => {
    const result = buildRoster({
      lineup: [makePlayer({ name: "  Alice  " }), makePlayer({ name: "Bob" })],
    });
    expect(result.lineup[0].name).toBe("Alice");
    expect(result.lineup[1].name).toBe("Bob");
  });

  it("defaults bench and pitchers to empty when omitted", () => {
    const result = buildRoster({ lineup: [makePlayer()] });
    expect(result.bench).toEqual([]);
    expect(result.pitchers).toEqual([]);
  });

  it("sanitizes bench players", () => {
    const result = buildRoster({
      lineup: [makePlayer()],
      bench: [makePlayer({ batting: { contact: 150, power: 25, speed: 25, stamina: 50 } })],
    });
    expect(result.bench[0].batting.contact).toBe(100);
  });

  it("sanitizes pitchers", () => {
    const result = buildRoster({
      lineup: [makePlayer()],
      pitchers: [
        makePlayer({
          role: "pitcher",
          pitching: { velocity: 60, control: 50, movement: 50, stamina: 60 },
        }),
      ],
    });
    expect(result.pitchers.length).toBe(1);
    expect(result.pitchers[0].role).toBe("pitcher");
  });
});

describe("validatePlayerStatCaps — exported constants", () => {
  it("HITTER_STAT_CAP is 150", () => expect(HITTER_STAT_CAP).toBe(150));
  it("PITCHER_STAT_CAP is 160", () => expect(PITCHER_STAT_CAP).toBe(160));
});

describe("validatePlayerStatCaps", () => {
  it("does not throw when batting total equals the cap exactly (150)", () => {
    const player = makePlayer({ batting: { contact: 50, power: 50, speed: 50, stamina: 50 } });
    expect(() => validatePlayerStatCaps(player, { section: "player", index: 0 })).not.toThrow();
  });

  it("does not throw when batting total is under the cap", () => {
    const player = makePlayer({ batting: { contact: 40, power: 50, speed: 50, stamina: 50 } });
    expect(() => validatePlayerStatCaps(player, { section: "player", index: 0 })).not.toThrow();
  });

  it("throws with a clear message when batting total > 150 (non-pitcher role)", () => {
    const player = makePlayer({ batting: { contact: 60, power: 50, speed: 50, stamina: 50 } }); // 160
    expect(() => validatePlayerStatCaps(player, { section: "player", index: 0 })).toThrow(
      /stat cap/i,
    );
    expect(() => validatePlayerStatCaps(player, { section: "player", index: 3 })).toThrow(
      "roster player[3]",
    );
  });

  it("does not throw for a pitcher with batting total > 150 (pitchers are exempt)", () => {
    const player = makePlayer({
      role: "pitcher",
      batting: { contact: 60, power: 50, speed: 50, stamina: 50 }, // 160 > 150 but role=pitcher
    });
    expect(() => validatePlayerStatCaps(player, { section: "player", index: 0 })).not.toThrow();
  });

  it("does not throw when pitching total equals the cap exactly (160)", () => {
    const player = makePlayer({
      role: "pitcher",
      batting: { contact: 30, power: 20, speed: 25, stamina: 50 },
      pitching: { velocity: 60, control: 50, movement: 50, stamina: 60 }, // 160
    });
    expect(() => validatePlayerStatCaps(player, { section: "player", index: 0 })).not.toThrow();
  });

  it("throws with a clear message when pitching total > 160 (pitcher/two-way role)", () => {
    const player = makePlayer({
      role: "pitcher",
      batting: { contact: 30, power: 20, speed: 25, stamina: 50 },
      pitching: { velocity: 70, control: 50, movement: 50, stamina: 60 }, // 170 > 160
    });
    expect(() => validatePlayerStatCaps(player, { section: "player", index: 0 })).toThrow(
      /stat cap/i,
    );
    expect(() => validatePlayerStatCaps(player, { section: "player", index: 5 })).toThrow(
      "roster player[5]",
    );
  });

  it("does not throw for a batter with pitching total > 160 (batters are exempt)", () => {
    const player = makePlayer({
      role: "batter",
      batting: { contact: 50, power: 50, speed: 50, stamina: 50 },
      pitching: { velocity: 70, control: 50, movement: 50, stamina: 60 }, // 170 > 160 but role=batter
    });
    expect(() => validatePlayerStatCaps(player, { section: "player", index: 0 })).not.toThrow();
  });

  it("does not throw when pitching is absent (no pitcher cap check)", () => {
    const player = makePlayer({ role: "pitcher" }); // no pitching field
    expect(() => validatePlayerStatCaps(player, { section: "player", index: 0 })).not.toThrow();
  });

  it("two-way player is subject to both batting and pitching caps", () => {
    const valid = makePlayer({
      role: "two-way",
      batting: { contact: 50, power: 50, speed: 50, stamina: 50 }, // 150
      pitching: { velocity: 60, control: 50, movement: 50, stamina: 60 }, // 160
    });
    expect(() => validatePlayerStatCaps(valid, { section: "player", index: 0 })).not.toThrow();

    const batOverCap = makePlayer({
      role: "two-way",
      batting: { contact: 60, power: 50, speed: 50, stamina: 50 }, // 160 > 150
      pitching: { velocity: 60, control: 50, movement: 50, stamina: 60 },
    });
    expect(() => validatePlayerStatCaps(batOverCap, { section: "player", index: 0 })).toThrow(
      /stat cap/i,
    );

    const pitchOverCap = makePlayer({
      role: "two-way",
      batting: { contact: 50, power: 50, speed: 50, stamina: 50 },
      pitching: { velocity: 70, control: 50, movement: 50, stamina: 60 }, // 170 > 160
    });
    expect(() => validatePlayerStatCaps(pitchOverCap, { section: "player", index: 0 })).toThrow(
      /stat cap/i,
    );
  });
});

describe("sanitizePlayer — stat cap enforcement (clamp + cap integration)", () => {
  it("throws when batting total exceeds cap even after clamping", () => {
    // {100, 0, 55} — all within [0,100], total=155 > 150
    const player = makePlayer({ batting: { contact: 100, power: 0, speed: 55, stamina: 50 } });
    expect(() => sanitizePlayer(player, { index: 0 })).toThrow(/stat cap/i);
  });

  it("does not throw when clamping brings total exactly to the cap", () => {
    // {150, -5, 50} → clamps to {100, 0, 50} = 150 ✓
    const player = makePlayer({ batting: { contact: 150, power: -5, speed: 50, stamina: 50 } });
    expect(() => sanitizePlayer(player, { index: 0 })).not.toThrow();
  });

  it("throws when pitching total exceeds cap after clamping (pitcher role)", () => {
    // {100, 0, 65} — all within [0,100], total=165 > 160
    const player = makePlayer({
      role: "pitcher",
      batting: { contact: 30, power: 20, speed: 25, stamina: 50 },
      pitching: { velocity: 100, control: 0, movement: 65, stamina: 60 },
    });
    expect(() => sanitizePlayer(player, { index: 0 })).toThrow(/stat cap/i);
  });

  it("does not throw when pitching total is exactly at cap after clamping", () => {
    // {200, -10, 60} → clamps to {100, 0, 60} = 160 ✓
    const player = makePlayer({
      role: "pitcher",
      batting: { contact: 30, power: 20, speed: 25, stamina: 50 },
      pitching: { velocity: 200, control: -10, movement: 60, stamina: 60 },
    });
    expect(() => sanitizePlayer(player, { index: 0 })).not.toThrow();
  });
});

// ── sanitizePlayer — fingerprint storage (integration via store) ──────────────

describe("sanitizePlayer — fingerprint storage", () => {
  const makeStoreInput = (
    overrides: Partial<CreateCustomTeamInput> = {},
  ): CreateCustomTeamInput => ({
    name: "Test Team",
    roster: {
      lineup: [makeSharedPlayer()],
      bench: [],
      pitchers: [],
    },
    ...overrides,
  });

  let db: BallgameDb;
  let store: ReturnType<typeof makeCustomTeamStore>;

  beforeEach(async () => {
    db = await createTestDb(getRxStorageMemory());
    store = makeCustomTeamStore(() => Promise.resolve(db));
  });

  afterEach(async () => {
    await db.close();
  });

  it("stores a fingerprint on each player when a team is created", async () => {
    const id = await store.createCustomTeam(
      makeStoreInput({
        roster: {
          lineup: [makeSharedPlayer({ id: "p_fp1", name: "Fingerprint Batter" })],
          bench: [],
          pitchers: [
            makeSharedPlayer({
              id: "p_fp2",
              name: "Fingerprint Pitcher",
              role: "pitcher",
              pitching: { velocity: 55, control: 55, movement: 50, stamina: 60 },
            }),
          ],
        },
      }),
    );
    const team = await store.getCustomTeam(id);
    expect(team?.roster.lineup[0].fingerprint).toBeTruthy();
    expect(team?.roster.pitchers[0].fingerprint).toBeTruthy();
  });

  it("fingerprint matches buildPlayerSig result", async () => {
    const { buildPlayerSig } = await import("./customTeamExportImport");
    const player = makeSharedPlayer({ id: "p_sig", name: "Sig Check" });
    const id = await store.createCustomTeam(
      makeStoreInput({ roster: { lineup: [player], bench: [], pitchers: [] } }),
    );
    const team = await store.getCustomTeam(id);
    const stored = team?.roster.lineup[0];
    expect(stored?.fingerprint).toBe(buildPlayerSig(stored!));
  });
});
