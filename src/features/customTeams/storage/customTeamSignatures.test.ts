import { describe, expect, it } from "vitest";

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

  it("does not depend on team id", () => {
    const team1 = makeTeam({ id: "ct_aaa", name: "X" });
    const team2 = { ...team1, id: "ct_bbb" };
    expect(buildTeamFingerprint(team1)).toBe(buildTeamFingerprint(team2));
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
    const a = makeTeam({ name: "Rockets", abbreviation: "ROC" });
    const b = makeTeam({ name: "rockets", abbreviation: "roc" });
    expect(buildTeamFingerprint(a)).toBe(buildTeamFingerprint(b));
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

  it("differs when teamSeed changes (same name and abbreviation)", () => {
    const a = makeTeam({ name: "Rockets", abbreviation: "ROC", teamSeed: "seed-aaa" });
    const b = makeTeam({ name: "Rockets", abbreviation: "ROC", teamSeed: "seed-bbb" });
    expect(buildTeamFingerprint(a)).not.toBe(buildTeamFingerprint(b));
  });

  it("is stable for the same teamSeed, name, and abbreviation", () => {
    const a = makeTeam({ name: "Rockets", abbreviation: "ROC", teamSeed: "stableXYZ" });
    const b = makeTeam({ name: "Rockets", abbreviation: "ROC", teamSeed: "stableXYZ" });
    expect(buildTeamFingerprint(a)).toBe(buildTeamFingerprint(b));
  });

  it("falls back gracefully when teamSeed is absent (legacy bundles)", () => {
    const team = makeTeam({ name: "Legacy", abbreviation: "LGC" });
    // No teamSeed — must not throw and must return an 8-char hex string
    expect(buildTeamFingerprint(team)).toMatch(/^[0-9a-f]{8}$/);
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

  it("does NOT depend on player id (id is remapped on import and must not affect dup detection)", () => {
    const p = makePlayer();
    expect(
      buildPlayerSig({ ...p, id: "p_other" } as unknown as Pick<
        typeof p,
        "name" | "role" | "batting" | "pitching" | "playerSeed"
      >),
    ).toBe(buildPlayerSig(p));
  });

  it("does NOT depend on team (sig is team-independent so players can move between teams)", () => {
    const p = makePlayer();
    // Same player in two different teams must produce the same sig
    expect(buildPlayerSig(p)).toBe(buildPlayerSig({ ...p }));
  });

  it("does NOT depend on position (position is editable after creation)", () => {
    const p = makePlayer();
    expect(
      buildPlayerSig({ ...p, position: "DH" } as unknown as Pick<
        typeof p,
        "name" | "role" | "batting" | "pitching" | "playerSeed"
      >),
    ).toBe(buildPlayerSig(p));
  });

  it("differs when playerSeed changes (same content)", () => {
    const p = makePlayer();
    expect(buildPlayerSig({ ...p, playerSeed: "seed-aaa" })).not.toBe(
      buildPlayerSig({ ...p, playerSeed: "seed-bbb" }),
    );
  });

  it("is stable for the same playerSeed and content", () => {
    const p = makePlayer({ playerSeed: "stableABC123" });
    expect(buildPlayerSig(p)).toBe(buildPlayerSig({ ...p }));
  });

  it("falls back gracefully when playerSeed is absent (legacy bundles)", () => {
    const p = makePlayer();
    // No playerSeed — must not throw and must return 8-char hex
    expect(buildPlayerSig(p)).toMatch(/^[0-9a-f]{8}$/);
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
    expect("sig" in cleaned.roster.bench[0]).toBe(false);
    expect("sig" in cleaned.roster.pitchers[0]).toBe(false);
  });

  it("is a no-op when players have no sig", () => {
    const team = makeTeam();
    const cleaned = stripTeamPlayerSigs(team);
    expect("sig" in cleaned.roster.lineup[0]).toBe(false);
  });
});
