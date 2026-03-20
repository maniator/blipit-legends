import { describe, expect, it } from "vitest";

import type { TeamPlayer } from "@storage/types";
import { makePlayer, makeTeam } from "@test/helpers/customTeams";

import { buildPlayerSig, buildTeamFingerprint, stripTeamPlayerSigs } from "./customTeamSignatures";

// ── buildTeamFingerprint ─────────────────────────────────────────────────────

describe("buildTeamFingerprint", () => {
  it("returns an 8-char hex string", () => {
    expect(buildTeamFingerprint(makeTeam())).toMatch(/^[0-9a-f]{8}$/);
  });

  it("is stable across calls", () => {
    const team = makeTeam({ id: "ct_stable", name: "StableTeam" });
    expect(buildTeamFingerprint(team)).toBe(buildTeamFingerprint(team));
  });

  it("depends on team id (id is used as the entropy source)", () => {
    const team1 = makeTeam({ id: "ct_aaa", name: "X" });
    const team2 = { ...team1, id: "ct_bbb" };
    expect(buildTeamFingerprint(team1)).not.toBe(buildTeamFingerprint(team2));
  });

  it("differs when name changes", () => {
    const a = makeTeam({ name: "A" });
    const b = makeTeam({ name: "B" });
    expect(buildTeamFingerprint(a)).not.toBe(buildTeamFingerprint(b));
  });

  it("differs when abbreviation changes", () => {
    const a = makeTeam({ abbreviation: "AA" });
    const b = makeTeam({ abbreviation: "BB" });
    expect(buildTeamFingerprint(a)).not.toBe(buildTeamFingerprint(b));
  });

  it("is case-insensitive for name and abbreviation", () => {
    const base = makeTeam({ id: "ct_case", name: "Rockets", abbreviation: "ROC" });
    const lowerCase = { ...base, name: "rockets", abbreviation: "roc" };
    expect(buildTeamFingerprint(base)).toBe(buildTeamFingerprint(lowerCase));
  });

  it("does not depend on roster composition", () => {
    const base = makeTeam({ name: "Rockets", abbreviation: "ROC" });
    const differentRoster = {
      ...base,
      roster: {
        ...base.roster,
        lineup: [makePlayer({ name: "Someone Else" }), makePlayer({ name: "Another Player" })],
      },
    };
    expect(buildTeamFingerprint(base)).toBe(buildTeamFingerprint(differentRoster));
  });

  it("differs when id changes (same name and abbreviation)", () => {
    const a = makeTeam({ id: "ct_id_aaa", name: "Rockets", abbreviation: "ROC" });
    const b = makeTeam({ id: "ct_id_bbb", name: "Rockets", abbreviation: "ROC" });
    expect(buildTeamFingerprint(a)).not.toBe(buildTeamFingerprint(b));
  });

  it("is stable for the same id, name, and abbreviation", () => {
    const a = makeTeam({ id: "ct_stable_xyz", name: "Rockets", abbreviation: "ROC" });
    const b = { ...a };
    expect(buildTeamFingerprint(a)).toBe(buildTeamFingerprint(b));
  });
});

// ── buildPlayerSig ───────────────────────────────────────────────────────────

describe("buildPlayerSig", () => {
  it("returns an 8-char hex string", () => {
    const p = makePlayer();
    expect(buildPlayerSig(p)).toMatch(/^[0-9a-f]{8}$/);
  });

  it("is stable for the same inputs", () => {
    const p = makePlayer();
    expect(buildPlayerSig(p)).toBe(buildPlayerSig(p));
  });

  it("differs when batting stats change", () => {
    const p = makePlayer();
    const pAltered = { ...p, batting: { ...p.batting, contact: 99 } };
    expect(buildPlayerSig(pAltered)).not.toBe(buildPlayerSig(p));
  });

  it("differs when player name changes", () => {
    const p = makePlayer();
    expect(buildPlayerSig({ ...p, name: "Bob" })).not.toBe(buildPlayerSig(p));
  });

  it("does NOT depend on player id (sig is content-based for deduplication)", () => {
    const p = makePlayer();
    const pOther = makePlayer(); // different id, same default content
    expect(buildPlayerSig(pOther)).toBe(buildPlayerSig(p));
  });

  it("does NOT depend on team assignment (content-based, not identity-based)", () => {
    const p = makePlayer();
    // Same player object spread produces the same sig
    expect(buildPlayerSig(p)).toBe(buildPlayerSig({ ...p }));
  });

  it("does NOT depend on position (position is editable after creation)", () => {
    const p = makePlayer();
    const pWithPos: TeamPlayer = { ...p, position: "DH" };
    expect(buildPlayerSig(pWithPos)).toBe(buildPlayerSig(p));
  });

  it("is the same when only id changes (same content produces same sig)", () => {
    const p1 = makePlayer({ id: "id-aaa" });
    const p2 = makePlayer({ id: "id-bbb" });
    expect(buildPlayerSig(p1)).toBe(buildPlayerSig(p2));
  });

  it("is stable for the same content regardless of id", () => {
    const p = makePlayer({ id: "stable-id-xyz" });
    expect(buildPlayerSig(p)).toBe(buildPlayerSig({ ...p }));
  });
});

// ── stripTeamPlayerSigs ──────────────────────────────────────────────────────

describe("stripTeamPlayerSigs", () => {
  it("removes sig from all roster slots", () => {
    const team = makeTeam({
      roster: {
        schemaVersion: 1,
        lineup: [{ ...makePlayer(), sig: "aabbccdd" }],
        bench: [{ ...makePlayer(), sig: "11223344" }],
        pitchers: [{ ...makePlayer(), sig: "deadbeef" }],
      },
    });
    const cleaned = stripTeamPlayerSigs(team);
    expect("sig" in cleaned.roster.lineup[0]).toBe(false);
    expect("sig" in (cleaned.roster.bench ?? [])[0]).toBe(false);
    expect("sig" in cleaned.roster.pitchers[0]).toBe(false);
  });

  it("is a no-op when players have no sig", () => {
    const team = makeTeam();
    const cleaned = stripTeamPlayerSigs(team);
    expect("sig" in cleaned.roster.lineup[0]).toBe(false);
  });
});
