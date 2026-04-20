import { describe, expect, it } from "vitest";

import { fnv1a } from "@storage/hash";
import type { TeamWithRoster } from "@storage/types";
import { makePlayer, makeTeam } from "@test/helpers/customTeams";

import { buildPlayerSig, buildTeamFingerprint, TEAMS_EXPORT_KEY } from "./customTeamSignatures";
import { exportCustomTeams, parseExportedCustomTeams } from "./customTeamTeamBundle";

/** Build a valid signed bundle from scratch (for edge-case tests). */
function makeSignedBundle(
  overrides: Record<string, unknown> = {},
  payloadOverride?: Record<string, unknown>,
) {
  const payload = payloadOverride ?? { teams: [] };
  const sig = fnv1a(TEAMS_EXPORT_KEY + JSON.stringify(payload));
  return JSON.stringify({ type: "customTeams", formatVersion: 1, payload, sig, ...overrides });
}

// ── exportCustomTeams ────────────────────────────────────────────────────────

describe("exportCustomTeams", () => {
  it("produces valid parseable JSON", () => {
    expect(() => JSON.parse(exportCustomTeams([makeTeam()]))).not.toThrow();
  });

  it("includes top-level type, formatVersion, exportedAt, sig", () => {
    const parsed = JSON.parse(exportCustomTeams([makeTeam()]));
    expect(parsed.type).toBe("customTeams");
    expect(parsed.formatVersion).toBe(1);
    expect(typeof parsed.exportedAt).toBe("string");
    expect(typeof parsed.sig).toBe("string");
    expect(parsed.sig).toMatch(/^[0-9a-f]{8}$/);
  });

  it("always embeds fingerprint on each team", () => {
    const team = makeTeam({ name: "Rocketeers", fingerprint: undefined });
    const parsed = JSON.parse(exportCustomTeams([team]));
    expect(typeof parsed.payload.teams[0].fingerprint).toBe("string");
    expect(parsed.payload.teams[0].fingerprint.length).toBe(8);
  });

  it("embeds sig on every player in every roster slot", () => {
    const team = makeTeam({
      roster: {
        schemaVersion: 1,
        lineup: [makePlayer({ name: "Batter" })],
        bench: [makePlayer({ name: "BenchGuy", role: "batter" })],
        pitchers: [makePlayer({ name: "Pitcher", role: "pitcher" })],
      },
    });
    const parsed = JSON.parse(exportCustomTeams([team]));
    const t = parsed.payload.teams[0];
    expect(typeof t.roster.lineup[0].sig).toBe("string");
    expect(typeof t.roster.bench[0].sig).toBe("string");
    expect(typeof t.roster.pitchers[0].sig).toBe("string");
  });

  it("serializes all provided teams", () => {
    const json = exportCustomTeams([makeTeam({ name: "T1" }), makeTeam({ name: "T2" })]);
    expect(JSON.parse(json).payload.teams).toHaveLength(2);
  });

  it("round-trips through parseExportedCustomTeams", () => {
    const team = makeTeam({ name: "Round Trip" });
    const result = parseExportedCustomTeams(exportCustomTeams([team]));
    expect(result.payload.teams[0].name).toBe("Round Trip");
  });
});

// ── parseExportedCustomTeams ─────────────────────────────────────────────────

describe("parseExportedCustomTeams", () => {
  it("throws on invalid JSON", () => {
    expect(() => parseExportedCustomTeams("not json")).toThrow("Invalid JSON");
  });

  it("rejects empty object with a clean error (no undefined/null/NaN)", () => {
    const err = (() => {
      try {
        parseExportedCustomTeams("{}");
      } catch (e) {
        return e as Error;
      }
    })();
    expect(err).toBeInstanceOf(Error);
    expect(err!.message).not.toMatch(/undefined|null|NaN/);
    expect(err!.message).toContain("Invalid");
    expect(err!.message).toContain("format");
    expect(err!.message).toMatch(/Make sure to export using/i);
  });

  it("throws when type is wrong", () => {
    const bad = makeSignedBundle({ type: "saves" });
    expect(() => parseExportedCustomTeams(bad)).toThrow('expected type "customTeams"');
  });

  it("throws on unsupported formatVersion", () => {
    const bad = makeSignedBundle({ formatVersion: 99 });
    expect(() => parseExportedCustomTeams(bad)).toThrow("unsupported format version: 99");
  });

  it("throws when payload is missing", () => {
    const bad = JSON.stringify({ type: "customTeams", formatVersion: 1, sig: "00000000" });
    expect(() => parseExportedCustomTeams(bad)).toThrow("missing payload");
  });

  it("throws when teams is not an array", () => {
    const payload = { teams: "oops" };
    const sig = fnv1a(TEAMS_EXPORT_KEY + JSON.stringify(payload));
    const bad = JSON.stringify({ type: "customTeams", formatVersion: 1, payload, sig });
    expect(() => parseExportedCustomTeams(bad)).toThrow("must be an array");
  });

  it("throws when a team is missing required id", () => {
    const player = { ...makePlayer(), sig: buildPlayerSig(makePlayer()) };
    const team = {
      name: "No ID",
      fingerprint: "aabbccdd",
      roster: { lineup: [player] },
    };
    const payload = { teams: [team] };
    const sig = fnv1a(TEAMS_EXPORT_KEY + JSON.stringify(payload));
    const bad = JSON.stringify({ type: "customTeams", formatVersion: 1, payload, sig });
    expect(() => parseExportedCustomTeams(bad)).toThrow("missing required field: id");
  });

  it("throws when a team has an empty lineup", () => {
    const fp = "aabbccdd";
    const team = {
      id: "ct1",
      name: "T",
      metadata: {},
      fingerprint: fp,
      roster: { schemaVersion: 1, lineup: [] },
    };
    const payload = { teams: [team] };
    const sig = fnv1a(TEAMS_EXPORT_KEY + JSON.stringify(payload));
    const bad = JSON.stringify({ type: "customTeams", formatVersion: 1, payload, sig });
    expect(() => parseExportedCustomTeams(bad)).toThrow("non-empty array");
  });

  it("throws when bundle sig is missing", () => {
    const bad = JSON.stringify({
      type: "customTeams",
      formatVersion: 1,
      payload: { teams: [] },
    });
    expect(() => parseExportedCustomTeams(bad)).toThrow("signature mismatch");
  });

  it("throws when bundle sig is wrong (tampered payload)", () => {
    const team = makeTeam({ name: "Legit" });
    const obj = JSON.parse(exportCustomTeams([team]));
    obj.payload.teams[0].name = "Tampered";
    expect(() => parseExportedCustomTeams(JSON.stringify(obj))).toThrow("signature mismatch");
  });

  it("throws when a player sig is wrong (tampered player stats)", () => {
    const team = makeTeam({ name: "Good Team" });
    const exported = exportCustomTeams([team]);
    const obj = JSON.parse(exported);
    // Tamper the player stats inside the payload, then re-sign the bundle so only the player sig fails
    obj.payload.teams[0].roster.lineup[0].batting.contact = 99;
    obj.sig = fnv1a(TEAMS_EXPORT_KEY + JSON.stringify(obj.payload));
    expect(() => parseExportedCustomTeams(JSON.stringify(obj))).toThrow(
      "player signature mismatch",
    );
  });

  it("parses a valid bundle successfully", () => {
    const json = exportCustomTeams([makeTeam({ name: "Valid" })]);
    const result = parseExportedCustomTeams(json);
    expect(result.type).toBe("customTeams");
    expect(result.payload.teams[0].name).toBe("Valid");
  });
});

// ── Import validation: roster constraints and required fields ─────────────────
// These tests verify the parser rejects structurally invalid bundles, matching
// the issue requirement "import validation rejects invalid teams (roster
// constraints, stat caps, missing fields)".

describe("parseExportedCustomTeams — roster constraint validation", () => {
  it("throws when a team is missing required name", () => {
    const player = { ...makePlayer(), sig: buildPlayerSig(makePlayer()) };
    const team = {
      id: "ct1",
      fingerprint: "aabbccdd",
      roster: { lineup: [player] },
    };
    const payload = { teams: [team] };
    const sig = fnv1a(TEAMS_EXPORT_KEY + JSON.stringify(payload));
    const bad = JSON.stringify({ type: "customTeams", formatVersion: 1, payload, sig });
    expect(() => parseExportedCustomTeams(bad)).toThrow("missing required field: name");
  });

  it("throws when a team is missing required metadata", () => {
    const player = { ...makePlayer(), sig: buildPlayerSig(makePlayer()) };
    const team = {
      id: "ct1",
      name: "T",
      fingerprint: "aabbccdd",
      roster: { schemaVersion: 1, lineup: [player] },
    };
    const payload = { teams: [team] };
    const sig = fnv1a(TEAMS_EXPORT_KEY + JSON.stringify(payload));
    const bad = JSON.stringify({ type: "customTeams", formatVersion: 1, payload, sig });
    expect(() => parseExportedCustomTeams(bad)).toThrow("missing required field: metadata");
  });

  it("throws when a team is missing required roster", () => {
    const fp = buildTeamFingerprint(makeTeam());
    const team = { id: "ct1", name: "T", source: "custom", metadata: {}, fingerprint: fp };
    const payload = { teams: [team] };
    const sig = fnv1a(TEAMS_EXPORT_KEY + JSON.stringify(payload));
    const bad = JSON.stringify({ type: "customTeams", formatVersion: 1, payload, sig });
    expect(() => parseExportedCustomTeams(bad)).toThrow("missing required field: roster");
  });

  it("throws when a team entry is not an object", () => {
    const payload = { teams: ["not-an-object"] };
    const sig = fnv1a(TEAMS_EXPORT_KEY + JSON.stringify(payload));
    const bad = JSON.stringify({ type: "customTeams", formatVersion: 1, payload, sig });
    expect(() => parseExportedCustomTeams(bad)).toThrow("is not an object");
  });

  it("throws when roster.lineup is empty (lineup size constraint)", () => {
    const fp = "aabbccdd";
    const team = {
      id: "ct1",
      name: "T",
      metadata: {},
      fingerprint: fp,
      roster: { schemaVersion: 1, lineup: [] },
    };
    const payload = { teams: [team] };
    const sig = fnv1a(TEAMS_EXPORT_KEY + JSON.stringify(payload));
    const bad = JSON.stringify({ type: "customTeams", formatVersion: 1, payload, sig });
    expect(() => parseExportedCustomTeams(bad)).toThrow("non-empty array");
  });

  it("rejects a bundle where the whole payload is a bare array (not a keyed object)", () => {
    // A bare array IS typeof "object" but has no formatVersion — triggers the
    // generic format guard before any type/version-specific check.
    expect(() => parseExportedCustomTeams(JSON.stringify([{ id: "ct1" }]))).toThrow(
      "missing or unrecognized format",
    );
  });

  it("accepts a bundle with optional bench and pitchers omitted from roster", () => {
    const team = makeTeam({
      roster: {
        schemaVersion: 1,
        lineup: [makePlayer({ name: "Sole Batter" })],
        bench: [],
        pitchers: [],
      },
    });
    const result = parseExportedCustomTeams(exportCustomTeams([team]));
    expect(result.payload.teams[0].roster.lineup[0].name).toBe("Sole Batter");
  });

  it("throws a descriptive error when a lineup player is null", () => {
    const team = makeTeam({
      roster: { schemaVersion: 1, lineup: [makePlayer()], bench: [], pitchers: [] },
    });
    // Manually corrupt: replace lineup[0] with null
    const bundle = JSON.parse(exportCustomTeams([team]));
    bundle.payload.teams[0].roster.lineup[0] = null;
    // Recompute bundle sig so structural validation (not sig check) fires first
    const { fnv1a: _fnv1a } = { fnv1a };
    bundle.sig = _fnv1a(TEAMS_EXPORT_KEY + JSON.stringify(bundle.payload));
    expect(() => parseExportedCustomTeams(JSON.stringify(bundle))).toThrow("is not an object");
  });

  it("throws a descriptive error when a player is missing required 'name' field", () => {
    const team = makeTeam({
      roster: { schemaVersion: 1, lineup: [makePlayer()], bench: [], pitchers: [] },
    });
    const bundle = JSON.parse(exportCustomTeams([team]));
    // Remove the name from lineup[0]
    delete bundle.payload.teams[0].roster.lineup[0].name;
    bundle.sig = fnv1a(TEAMS_EXPORT_KEY + JSON.stringify(bundle.payload));
    expect(() => parseExportedCustomTeams(JSON.stringify(bundle))).toThrow(
      "missing required field: name",
    );
  });

  it("throws a descriptive error when a player is missing required 'batting' field", () => {
    const team = makeTeam({
      roster: { schemaVersion: 1, lineup: [makePlayer()], bench: [], pitchers: [] },
    });
    const bundle = JSON.parse(exportCustomTeams([team]));
    delete bundle.payload.teams[0].roster.lineup[0].batting;
    bundle.sig = fnv1a(TEAMS_EXPORT_KEY + JSON.stringify(bundle.payload));
    expect(() => parseExportedCustomTeams(JSON.stringify(bundle))).toThrow(
      "missing required field: batting",
    );
  });

  it("throws a descriptive error when a player has an invalid role", () => {
    const team = makeTeam({
      roster: { schemaVersion: 1, lineup: [makePlayer()], bench: [], pitchers: [] },
    });
    const bundle = JSON.parse(exportCustomTeams([team]));
    bundle.payload.teams[0].roster.lineup[0].role = "superplayer";
    bundle.sig = fnv1a(TEAMS_EXPORT_KEY + JSON.stringify(bundle.payload));
    expect(() => parseExportedCustomTeams(JSON.stringify(bundle))).toThrow(
      'invalid role "superplayer"',
    );
  });
});

// ── parseExportedCustomTeams — slot invariants ───────────────────────────────

describe("parseExportedCustomTeams — slot invariants", () => {
  /** Build a signed bundle with the given teams payload. */
  function signedBundleFromTeams(teams: unknown[]): string {
    const payload = { teams };
    const sig = fnv1a(TEAMS_EXPORT_KEY + JSON.stringify(payload));
    return JSON.stringify({ type: "customTeams", formatVersion: 1, payload, sig });
  }

  it("accepts a valid bundle where pitchers are in pitchers and batters in lineup/bench", () => {
    const batter = makePlayer({ name: "Line Batter" });
    const pitcher = makePlayer({ name: "Starting Pitcher", role: "pitcher" });
    const team = makeTeam({
      roster: {
        schemaVersion: 1,
        lineup: [batter],
        bench: [],
        pitchers: [pitcher],
      },
    });
    expect(() => parseExportedCustomTeams(exportCustomTeams([team]))).not.toThrow();
  });

  it("rejects a bundle where a pitcher-role player is in roster.lineup", () => {
    const batter = makePlayer({ name: "Batter" });
    const pitcher = makePlayer({ name: "Wrong Section Pitcher", role: "pitcher" });
    // Build the bundle manually so we can place the pitcher in lineup
    const pitcherWithSig = { ...pitcher, sig: buildPlayerSig(pitcher) };
    const batterWithSig = { ...batter, sig: buildPlayerSig(batter) };
    const team = {
      id: "ct_slot_test",
      name: "Slot Test",
      metadata: {},
      fingerprint: buildTeamFingerprint(makeTeam()),
      roster: {
        schemaVersion: 1,
        lineup: [batterWithSig, pitcherWithSig], // pitcher in lineup — invalid
        bench: [],
        pitchers: [],
      },
    };
    expect(() => parseExportedCustomTeams(signedBundleFromTeams([team]))).toThrow(
      /pitcher-role player cannot be placed in the lineup/i,
    );
  });

  it("rejects a bundle where a pitcher-role player is in roster.bench", () => {
    const batter = makePlayer({ name: "Batter" });
    const pitcher = makePlayer({ name: "Bench Pitcher", role: "pitcher" });
    const pitcherWithSig = { ...pitcher, sig: buildPlayerSig(pitcher) };
    const batterWithSig = { ...batter, sig: buildPlayerSig(batter) };
    const team = {
      id: "ct_bench_slot_test",
      name: "Bench Slot Test",
      metadata: {},
      fingerprint: buildTeamFingerprint(makeTeam()),
      roster: {
        schemaVersion: 1,
        lineup: [batterWithSig],
        bench: [pitcherWithSig], // pitcher in bench — invalid
        pitchers: [],
      },
    };
    expect(() => parseExportedCustomTeams(signedBundleFromTeams([team]))).toThrow(
      /pitcher-role player cannot be placed in the bench/i,
    );
  });

  it("rejects a bundle where a batter-role player is in roster.pitchers", () => {
    const batter = makePlayer({ name: "Wrong Batter" });
    const lineupBatter = makePlayer({ name: "Lineup Batter" });
    const batterWithSig = { ...batter, sig: buildPlayerSig(batter) };
    const lineupWithSig = { ...lineupBatter, sig: buildPlayerSig(lineupBatter) };
    const team = {
      id: "ct_pitchers_slot_test",
      name: "Pitchers Slot Test",
      metadata: {},
      fingerprint: buildTeamFingerprint(makeTeam()),
      roster: {
        schemaVersion: 1,
        lineup: [lineupWithSig],
        bench: [],
        pitchers: [batterWithSig], // batter in pitchers — invalid
      },
    };
    expect(() => parseExportedCustomTeams(signedBundleFromTeams([team]))).toThrow(
      /must have role "pitcher"/i,
    );
  });
});

// ── exportCustomTeams — identity fields per player ────────────────────────────

describe("exportCustomTeams — identity fields per player", () => {
  /** Reusable type for the parsed export payload */
  type ParsedTeamsExport = {
    payload: {
      teams: Array<{
        roster: {
          lineup: Array<Record<string, unknown>>;
          bench: Array<Record<string, unknown>>;
          pitchers: Array<Record<string, unknown>>;
        };
      }>;
    };
  };

  it("preserves fingerprint for each player in lineup", () => {
    const player = makePlayer({ fingerprint: "deadbeef" });
    const team = makeTeam({
      roster: { schemaVersion: 1, lineup: [player], bench: [], pitchers: [] },
    });
    const parsed = JSON.parse(exportCustomTeams([team])) as ParsedTeamsExport;
    expect(parsed.payload.teams[0].roster.lineup[0]["fingerprint"]).toBe("deadbeef");
  });

  it("preserves fingerprint for each player in bench", () => {
    const player = makePlayer({ fingerprint: "cafebabe" });
    const team = makeTeam({
      roster: { schemaVersion: 1, lineup: [], bench: [player], pitchers: [] },
    });
    const parsed = JSON.parse(exportCustomTeams([team])) as ParsedTeamsExport;
    expect(parsed.payload.teams[0].roster.bench[0]["fingerprint"]).toBe("cafebabe");
  });

  it("preserves fingerprint for each player in pitchers", () => {
    const player = makePlayer({ fingerprint: "feedface" });
    const team = makeTeam({
      roster: { schemaVersion: 1, lineup: [], bench: [], pitchers: [player] },
    });
    const parsed = JSON.parse(exportCustomTeams([team])) as ParsedTeamsExport;
    expect(parsed.payload.teams[0].roster.pitchers[0]["fingerprint"]).toBe("feedface");
  });
});
