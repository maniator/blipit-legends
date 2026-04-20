import { describe, expect, it } from "vitest";

import type { TeamPlayer } from "@storage/types";
import { makePlayer, makeTeam } from "@test/helpers/customTeams";

import { preScanForDuplicatePlayers } from "./customTeamImportPrescan";
import { buildPlayerSig, buildTeamFingerprint } from "./customTeamSignatures";

// ── preScanForDuplicatePlayers ────────────────────────────────────────────────

describe("preScanForDuplicatePlayers", () => {
  it("returns empty warnings and zero skipped for empty teams array", () => {
    const result = preScanForDuplicatePlayers([], new Map(), new Set());
    expect(result.warnings).toHaveLength(0);
    expect(result.skippedCount).toBe(0);
  });

  it("skips fingerprint-matched teams and does not emit player warnings for them", () => {
    const team = makeTeam({ name: "Existing Team" });
    const fp = buildTeamFingerprint(team);
    const teamWithFp = { ...team, fingerprint: fp };
    const existingFingerprints = new Map([[fp, team.id]]);
    // Add a player sig that would normally trigger a warning
    const playerSig = "deadbeef";
    const existingPlayerSigs = new Set([playerSig]);

    const result = preScanForDuplicatePlayers(
      [teamWithFp],
      existingFingerprints,
      existingPlayerSigs,
    );
    expect(result.skippedCount).toBe(1);
    expect(result.warnings).toHaveLength(0);
  });

  it("emits a warning when a player sig matches an existing player sig", () => {
    const player = makePlayer({ name: "Bob" });
    const team = makeTeam({
      name: "Fresh Team",
      roster: { schemaVersion: 1, lineup: [player], bench: [], pitchers: [] },
    });

    // Build the sig the prescan would compute for this player
    // (prescan builds sig from player fields if no .sig property present)
    const existingFingerprints = new Map<string, string>();
    const sig = buildPlayerSig(player);
    const existingPlayerSigs = new Set([sig]);

    const result = preScanForDuplicatePlayers([team], existingFingerprints, existingPlayerSigs);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toMatch(/Bob/);
    expect(result.warnings[0]).toMatch(/Fresh Team/);
  });

  it("does not emit a warning when player sig is not in existing sigs", () => {
    const player = makePlayer({ name: "Charlie" });
    const team = makeTeam({
      name: "New Team",
      roster: { schemaVersion: 1, lineup: [player], bench: [], pitchers: [] },
    });
    const existingFingerprints = new Map<string, string>();
    const existingPlayerSigs = new Set(["some-other-sig"]);

    const result = preScanForDuplicatePlayers([team], existingFingerprints, existingPlayerSigs);
    expect(result.warnings).toHaveLength(0);
    expect(result.skippedCount).toBe(0);
  });

  it("counts skipped correctly when multiple teams are fingerprint-matched", () => {
    const team1 = makeTeam({ name: "Team One" });
    const team2 = makeTeam({ name: "Team Two" });
    const fp1 = buildTeamFingerprint(team1);
    const fp2 = buildTeamFingerprint(team2);
    const team1WithFp = { ...team1, fingerprint: fp1 };
    const team2WithFp = { ...team2, fingerprint: fp2 };
    const existingFingerprints = new Map([
      [fp1, team1.id],
      [fp2, team2.id],
    ]);
    const existingPlayerSigs = new Set<string>();

    const result = preScanForDuplicatePlayers(
      [team1WithFp, team2WithFp],
      existingFingerprints,
      existingPlayerSigs,
    );
    expect(result.skippedCount).toBe(2);
    expect(result.warnings).toHaveLength(0);
  });

  it("does not mutate the teams, fingerprints, or player sigs arguments", () => {
    const player = makePlayer({ name: "Dave" });
    const team = makeTeam({
      name: "Immutable Team",
      roster: { schemaVersion: 1, lineup: [player], bench: [], pitchers: [] },
    });
    const fingerprints = new Map<string, string>();
    const playerSigs = new Set<string>();

    const teamsBefore = JSON.stringify(team);
    preScanForDuplicatePlayers([team], fingerprints, playerSigs);

    expect(JSON.stringify(team)).toBe(teamsBefore);
    expect(fingerprints.size).toBe(0);
    expect(playerSigs.size).toBe(0);
  });

  it("emits one warning per duplicate player across all roster slots", () => {
    const lineup = makePlayer({ name: "Eve" });
    const bench = makePlayer({ name: "Frank" });
    const pitcher = makePlayer({ name: "Grace", role: "pitcher" });
    const team = makeTeam({
      name: "All Slots Team",
      roster: { schemaVersion: 1, lineup: [lineup], bench: [bench], pitchers: [pitcher] },
    });
    const existingPlayerSigs = new Set([
      buildPlayerSig(lineup) as string,
      buildPlayerSig(bench) as string,
      buildPlayerSig(pitcher) as string,
    ]);

    const result = preScanForDuplicatePlayers([team], new Map(), existingPlayerSigs);
    expect(result.warnings).toHaveLength(3);
  });

  it("uses import-compat stamina defaults for legacy players missing stamina", () => {
    const legacyBatter = {
      ...makePlayer({ name: "Legacy Batter" }),
      batting: { contact: 50, power: 50, speed: 50 },
    };
    const legacyPitcher = {
      ...makePlayer({ name: "Legacy Pitcher", role: "pitcher" }),
      pitching: { velocity: 50, control: 50, movement: 50 },
    };
    const team = makeTeam({
      name: "Legacy Team",
      roster: {
        schemaVersion: 1,
        lineup: [legacyBatter as unknown as TeamPlayer],
        bench: [],
        pitchers: [legacyPitcher as unknown as TeamPlayer],
      },
    });
    const existingPlayerSigs = new Set([
      buildPlayerSig({
        ...legacyBatter,
        batting: { contact: 50, power: 50, speed: 50, stamina: 50 },
      }),
      buildPlayerSig({
        ...legacyPitcher,
        pitching: { velocity: 50, control: 50, movement: 50, stamina: 60 },
      }),
    ]);

    const result = preScanForDuplicatePlayers([team], new Map(), existingPlayerSigs);
    expect(result.warnings).toHaveLength(2);
  });
});
