import { describe, expect, it } from "vitest";

import type { TeamPlayer, TeamWithRoster } from "@storage/types";
import { makePlayer, makeTeam } from "@test/helpers/customTeams";

import { importCustomTeams } from "./customTeamImportTeams";
import { buildTeamFingerprint } from "./customTeamSignatures";
import { exportCustomTeams } from "./customTeamTeamBundle";

// ── importCustomTeams ────────────────────────────────────────────────────────

describe("importCustomTeams", () => {
  it("imports teams with no collisions", () => {
    const team = makeTeam({ id: "ct_unique", name: "New Team" });
    const json = exportCustomTeams([team]);
    const result = importCustomTeams(json, []);
    expect(result.teams).toHaveLength(1);
    expect(result.created).toBe(1);
    expect(result.remapped).toBe(0);
  });

  it("strips player sigs from output (not stored in DB)", () => {
    const team = makeTeam();
    const result = importCustomTeams(exportCustomTeams([team]), []);
    for (const player of result.teams[0].roster.lineup) {
      expect("sig" in player).toBe(false);
    }
  });

  it("remaps team id on collision", () => {
    const existing = makeTeam({ id: "ct_clash" });
    const incoming = makeTeam({ id: "ct_clash", name: "Incoming" });
    const result = importCustomTeams(
      exportCustomTeams([incoming]),
      [existing],
      { makeTeamId: () => "ct_new_id" },
      { allowDuplicatePlayers: true },
    );
    expect(result.remapped).toBe(1);
    expect(result.created).toBe(0);
    expect(result.teams[0].id).toBe("ct_new_id");
  });

  it("remaps player ids on collision", () => {
    const sharedPlayerId = "p_shared";
    const existing = makeTeam({
      id: "ct_existing",
      roster: {
        schemaVersion: 1,
        lineup: [makePlayer({ id: sharedPlayerId, name: "Existing Player" })],
        bench: [],
        pitchers: [],
      },
    });
    const incoming = makeTeam({
      id: "ct_different",
      name: "Incoming",
      roster: {
        schemaVersion: 1,
        lineup: [makePlayer({ id: sharedPlayerId, name: "Incoming Player" })],
        bench: [],
        pitchers: [],
      },
    });
    let counter = 0;
    const result = importCustomTeams(exportCustomTeams([incoming]), [existing], {
      makePlayerId: () => `p_remapped_${counter++}`,
    });
    expect(result.remapped).toBe(1);
    expect(result.teams[0].roster.lineup[0].id).not.toBe(sharedPlayerId);
  });

  it("counts team as created when no IDs collide", () => {
    // Teams must have distinct names to have different fingerprints; otherwise the second
    // would be skipped by intra-bundle deduplication. allowDuplicatePlayers is set because
    // both teams use a player with the same default name which would otherwise block the import.
    const json = exportCustomTeams([
      makeTeam({ id: "ct_a", name: "Team Alpha" }),
      makeTeam({ id: "ct_b", name: "Team Beta" }),
    ]);
    const result = importCustomTeams(json, [], undefined, { allowDuplicatePlayers: true });
    expect(result.created).toBe(2);
    expect(result.remapped).toBe(0);
  });

  it("skips exact-duplicate teams (matching fingerprint) instead of importing them", () => {
    const team = makeTeam({ id: "ct_orig", name: "Dupes" });
    const existing = { ...team, id: "ct_existing", fingerprint: buildTeamFingerprint(team) };
    const result = importCustomTeams(exportCustomTeams([team]), [existing], {
      makeTeamId: () => "ct_new",
    });
    expect(result.teams).toHaveLength(0);
    expect(result.skipped).toBe(1);
    expect(result.created).toBe(0);
    expect(result.remapped).toBe(0);
    expect(result.duplicateWarnings).toHaveLength(0);
  });

  it("skips duplicate team and imports non-duplicate in mixed batch", () => {
    const dup = makeTeam({ id: "ct_dup", name: "Existing" });
    const fresh = makeTeam({ id: "ct_fresh", name: "Brand New" });
    const existing = { ...dup, fingerprint: buildTeamFingerprint(dup) };
    // Both teams use the default Alice player; pass allowDuplicatePlayers so the
    // test focuses on fingerprint-skip logic rather than player duplicate detection.
    const result = importCustomTeams(exportCustomTeams([dup, fresh]), [existing], undefined, {
      allowDuplicatePlayers: true,
    });
    expect(result.teams).toHaveLength(1);
    expect(result.teams[0].name).toBe("Brand New");
    expect(result.skipped).toBe(1);
    expect(result.created).toBe(1);
  });

  it("skips intra-bundle duplicate teams (same team appears twice in same bundle)", () => {
    // Simulates a malformed or hand-crafted export where the same team appears twice.
    // The second occurrence should be skipped via intra-bundle fingerprint tracking,
    // before player-duplicate checks run — so this works with or without allowDuplicatePlayers.
    const team = makeTeam({ id: "ct_a", name: "Alpha" });
    // Export the same team twice (two entries in the bundle, identical fingerprint).
    const result = importCustomTeams(exportCustomTeams([team, team]), [], undefined, {
      allowDuplicatePlayers: true,
    });
    expect(result.teams).toHaveLength(1);
    expect(result.skipped).toBe(1);
    expect(result.created).toBe(1);
  });

  it("skips intra-bundle duplicate teams even without allowDuplicatePlayers", () => {
    // Fingerprint-based dedup fires before player-duplicate detection, so the second
    // occurrence is skipped without ever triggering requiresDuplicateConfirmation.
    const team = makeTeam({ id: "ct_a", name: "Alpha" });
    const result = importCustomTeams(exportCustomTeams([team, team]), []);
    expect(result.teams).toHaveLength(1);
    expect(result.skipped).toBe(1);
    expect(result.created).toBe(1);
    expect(result.requiresDuplicateConfirmation).toBe(false);
  });

  it("blocks import and requires confirmation when duplicate players found (default behavior)", () => {
    // Player warnings fire when a non-duplicate team (different fingerprint) shares a player
    // whose {name, role, batting, pitching} matches one already in the local DB.
    // Without allowDuplicatePlayers=true the import is BLOCKED.
    const alice = makePlayer({ id: "p_alice", name: "Alice" });
    const existingTeam = makeTeam({
      id: "ct_a",
      name: "Team A",
      roster: { schemaVersion: 1, lineup: [alice], bench: [], pitchers: [] },
    });
    const teamB = makeTeam({
      id: "ct_b",
      name: "Team B",
      roster: {
        schemaVersion: 1,
        lineup: [{ ...alice, id: "p_alice_b" }],
        bench: [],
        pitchers: [],
      },
    });
    const result = importCustomTeams(exportCustomTeams([teamB]), [existingTeam]);
    expect(result.requiresDuplicateConfirmation).toBe(true);
    expect(result.duplicatePlayerWarnings.length).toBeGreaterThan(0);
    expect(result.duplicatePlayerWarnings[0]).toMatch(/Alice/);
    // Import is blocked — no teams in the result
    expect(result.teams).toHaveLength(0);
  });

  it("imports teams with duplicate players when allowDuplicatePlayers is true", () => {
    const alice = makePlayer({ id: "p_alice", name: "Alice" });
    const existingTeam = makeTeam({
      id: "ct_a",
      name: "Team A",
      roster: { schemaVersion: 1, lineup: [alice], bench: [], pitchers: [] },
    });
    const teamB = makeTeam({
      id: "ct_b",
      name: "Team B",
      roster: {
        schemaVersion: 1,
        lineup: [{ ...alice, id: "p_alice_b" }],
        bench: [],
        pitchers: [],
      },
    });
    const result = importCustomTeams(exportCustomTeams([teamB]), [existingTeam], undefined, {
      allowDuplicatePlayers: true,
    });
    expect(result.requiresDuplicateConfirmation).toBe(false);
    // Team is imported despite the duplicate player
    expect(result.teams).toHaveLength(1);
    expect(result.duplicatePlayerWarnings.length).toBeGreaterThan(0);
  });

  it("attaches fingerprint to each output team", () => {
    const team = makeTeam();
    const result = importCustomTeams(exportCustomTeams([team]), []);
    expect(typeof result.teams[0].fingerprint).toBe("string");
    expect(result.teams[0].fingerprint).toMatch(/^[0-9a-f]{8}$/);
  });

  it("handles mixed created + remapped teams", () => {
    const fresh = makeTeam({ id: "ct_fresh", name: "Fresh" });
    const collision = makeTeam({ id: "ct_col", name: "Collision" });
    const existing = makeTeam({ id: "ct_col" });
    let n = 0;
    // Both incoming teams use the default Alice player; pass allowDuplicatePlayers so
    // this test focuses on ID-remapping logic rather than player duplicate detection.
    const result = importCustomTeams(
      exportCustomTeams([fresh, collision]),
      [existing],
      { makeTeamId: () => `ct_gen_${n++}` },
      { allowDuplicatePlayers: true },
    );
    expect(result.created).toBe(1);
    expect(result.remapped).toBe(1);
  });

  it("throws on malformed JSON", () => {
    expect(() => importCustomTeams("bad", [])).toThrow("Invalid JSON");
  });

  it("remaps cross-slot intra-team duplicate player IDs (no duplicate IDs in output roster)", () => {
    // Both lineup and bench share the same player ID; bench player must be remapped.
    const sharedId = "p_dupe";
    const incoming = makeTeam({
      id: "ct_intra",
      name: "Intra Dupe Team",
      roster: {
        schemaVersion: 1,
        lineup: [makePlayer({ id: sharedId, name: "Player A" })],
        bench: [makePlayer({ id: sharedId, name: "Player B", role: "batter" })],
        pitchers: [],
      },
    });
    let n = 0;
    const result = importCustomTeams(exportCustomTeams([incoming]), [], {
      makePlayerId: () => `p_gen_${n++}`,
    });
    const t = result.teams[0];
    const allIds = [
      ...t.roster.lineup.map((p) => p.id),
      ...(t.roster.bench ?? []).map((p) => p.id),
      ...t.roster.pitchers.map((p) => p.id),
    ];
    // All IDs within the roster must be unique
    expect(new Set(allIds).size).toBe(allIds.length);
    // The bench player (second occurrence of the shared ID) must have been remapped
    expect(t.roster.bench?.[0]?.id).not.toBe(sharedId);
    // The lineup player (first occurrence) keeps the original ID
    expect(t.roster.lineup[0].id).toBe(sharedId);
  });

  it("player sig is used only for duplicate detection — not as primary identity key", () => {
    // After import, the primary identity is player.id, not the sig.
    // The sig must be stripped from the output (not stored in DB).
    const team = makeTeam({
      roster: {
        schemaVersion: 1,
        lineup: [makePlayer({ id: "p_identity", name: "Identity Check" })],
        bench: [],
        pitchers: [],
      },
    });
    const result = importCustomTeams(exportCustomTeams([team]), []);
    const player = result.teams[0].roster.lineup[0];
    expect(player.id).toBe("p_identity");
    expect("sig" in player).toBe(false);
  });
});

// ── Import validation: strips player sigs on output ───────────────────────────

describe("parseExportedCustomTeams — roster constraint validation (importCustomTeams)", () => {
  it("imports teams without preserving player sig fields in output (stat-sanitized)", () => {
    // Verifies that player sigs are stripped on import (not persisted to DB)
    const team = makeTeam();
    const result = importCustomTeams(exportCustomTeams([team]), []);
    const player = result.teams[0].roster.lineup[0];
    expect("sig" in player).toBe(false);
  });
});

// ── Full schema round-trip: all player fields through exportCustomTeams / importCustomTeams ──

describe("exportCustomTeams / importCustomTeams — full player and team field round-trips", () => {
  it("round-trips pitchingRole for pitchers through exportCustomTeams → importCustomTeams", () => {
    const spPitcher = makePlayer({
      role: "pitcher",
      pitching: { velocity: 90, control: 82, movement: 75 },
      pitchingRole: "SP",
    });
    const rpPitcher = makePlayer({
      role: "pitcher",
      pitching: { velocity: 87, control: 78, movement: 70 },
      pitchingRole: "RP",
    });
    const team = makeTeam({
      roster: {
        schemaVersion: 1,
        lineup: [makePlayer()],
        bench: [],
        pitchers: [spPitcher, rpPitcher],
      },
    });
    const json = exportCustomTeams([team]);
    const result = importCustomTeams(json, []);
    expect(result.teams[0].roster.pitchers[0].pitchingRole).toBe("SP");
    expect(result.teams[0].roster.pitchers[1].pitchingRole).toBe("RP");
  });

  it("round-trips handedness for all roster slots through exportCustomTeams → importCustomTeams", () => {
    const lineupPlayer = makePlayer({ handedness: "L" });
    const benchPlayer = makePlayer({ handedness: "S" });
    const pitcher = makePlayer({
      role: "pitcher",
      handedness: "R",
      pitching: { velocity: 88, control: 80, movement: 70 },
    });
    const team = makeTeam({
      roster: {
        schemaVersion: 1,
        lineup: [lineupPlayer],
        bench: [benchPlayer],
        pitchers: [pitcher],
      },
    });
    const json = exportCustomTeams([team]);
    const result = importCustomTeams(json, []);
    expect(result.teams[0].roster.lineup[0].handedness).toBe("L");
    expect(result.teams[0].roster.bench?.[0]?.handedness).toBe("S");
    expect(result.teams[0].roster.pitchers[0].handedness).toBe("R");
  });

  it("round-trips position for all roster slots through exportCustomTeams → importCustomTeams", () => {
    const lineupPlayer = makePlayer({ position: "SS" });
    const benchPlayer = makePlayer({ position: "C" });
    const pitcher = makePlayer({
      role: "pitcher",
      position: "P",
      pitching: { velocity: 88, control: 80, movement: 70 },
    });
    const team = makeTeam({
      roster: {
        schemaVersion: 1,
        lineup: [lineupPlayer],
        bench: [benchPlayer],
        pitchers: [pitcher],
      },
    });
    const json = exportCustomTeams([team]);
    const result = importCustomTeams(json, []);
    expect(result.teams[0].roster.lineup[0].position).toBe("SS");
    expect(result.teams[0].roster.bench?.[0]?.position).toBe("C");
    expect(result.teams[0].roster.pitchers[0].position).toBe("P");
  });

  it("round-trips complete batting stats for all lineup players", () => {
    const p1 = makePlayer({
      batting: { contact: 85, power: 70, speed: 90 },
    });
    const p2 = makePlayer({
      batting: { contact: 55, power: 90, speed: 40 },
    });
    const team = makeTeam({
      roster: { schemaVersion: 1, lineup: [p1, p2], bench: [], pitchers: [] },
    });
    const json = exportCustomTeams([team]);
    const result = importCustomTeams(json, []);
    expect(result.teams[0].roster.lineup[0].batting).toEqual({ contact: 85, power: 70, speed: 90 });
    expect(result.teams[0].roster.lineup[1].batting).toEqual({ contact: 55, power: 90, speed: 40 });
  });

  it("round-trips complete pitching stats (velocity, control, movement)", () => {
    const pitcher = makePlayer({
      role: "pitcher",
      pitching: { velocity: 95, control: 88, movement: 80 },
    });
    const team = makeTeam({
      roster: { schemaVersion: 1, lineup: [makePlayer()], bench: [], pitchers: [pitcher] },
    });
    const json = exportCustomTeams([team]);
    const result = importCustomTeams(json, []);
    expect(result.teams[0].roster.pitchers[0].pitching).toEqual({
      velocity: 95,
      control: 88,
      movement: 80,
    });
  });

  it("round-trips team identity fields: abbreviation, city, nickname through importCustomTeams", () => {
    const team = makeTeam({
      name: "River City Rockets",
      abbreviation: "RCR",
      city: "River City",
      nickname: "Rockets",
    });
    const json = exportCustomTeams([team]);
    const result = importCustomTeams(json, []);
    expect(result.teams[0].name).toBe("River City Rockets");
    expect(result.teams[0].abbreviation).toBe("RCR");
    expect(result.teams[0].city).toBe("River City");
    expect(result.teams[0].nickname).toBe("Rockets");
  });

  it("round-trips isBenchEligible and isPitcherEligible flags through importCustomTeams", () => {
    const bench = makePlayer({
      isBenchEligible: true,
      isPitcherEligible: false,
    });
    const extraBatter = makePlayer({
      role: "batter",
      isBenchEligible: true,
      isPitcherEligible: true,
      batting: { contact: 80, power: 75, speed: 70, stamina: 50 },
    });
    const team = makeTeam({
      roster: { schemaVersion: 1, lineup: [bench, extraBatter], bench: [], pitchers: [] },
    });
    const json = exportCustomTeams([team]);
    const result = importCustomTeams(json, []);
    expect(result.teams[0].roster.lineup[0].isBenchEligible).toBe(true);
    expect(result.teams[0].roster.lineup[0].isPitcherEligible).toBe(false);
    expect(result.teams[0].roster.lineup[1].isBenchEligible).toBe(true);
    expect(result.teams[0].roster.lineup[1].isPitcherEligible).toBe(true);
  });

  it("strips sig from all players after importCustomTeams — export-only metadata not stored", () => {
    const player = makePlayer();
    const team = makeTeam({
      roster: { schemaVersion: 1, lineup: [player], bench: [], pitchers: [] },
    });
    const json = exportCustomTeams([team]);
    const result = importCustomTeams(json, []);
    expect("sig" in result.teams[0].roster.lineup[0]).toBe(false);
  });

  it("legacy player without pitchingRole imports without error and leaves field absent", () => {
    // Simulates a player from a pre-pitchingRole bundle (no pitchingRole field at all).
    const legacyPlayer = makePlayer({
      role: "pitcher",
      pitching: { velocity: 88, control: 80, movement: 72 },
    });
    // Explicitly ensure no pitchingRole field
    const { pitchingRole: _removed, ...legacyNoRole } = legacyPlayer as TeamPlayer & {
      pitchingRole?: string;
    };
    const team = makeTeam({
      roster: {
        schemaVersion: 1,
        lineup: [makePlayer()],
        bench: [],
        pitchers: [legacyNoRole as TeamPlayer],
      },
    });
    const json = exportCustomTeams([team]);
    const result = importCustomTeams(json, []);
    // pitchingRole absent rather than set to a wrong default
    expect(result.teams[0].roster.pitchers[0].pitchingRole).toBeUndefined();
  });
});
