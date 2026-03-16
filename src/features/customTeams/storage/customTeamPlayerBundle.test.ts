import { describe, expect, it } from "vitest";

import { fnv1a } from "@storage/hash";
import { makePlayer } from "@test/helpers/customTeams";

import { exportCustomPlayer, parseExportedCustomPlayer } from "./customTeamPlayerBundle";
import { buildPlayerSig, PLAYER_EXPORT_KEY } from "./customTeamSignatures";

// ── exportCustomPlayer ────────────────────────────────────────────────────────

describe("exportCustomPlayer", () => {
  it("produces valid parseable JSON", () => {
    const p = makePlayer();
    expect(() => JSON.parse(exportCustomPlayer(p))).not.toThrow();
  });

  it("includes type 'customPlayer', formatVersion 1, exportedAt, sig", () => {
    const parsed = JSON.parse(exportCustomPlayer(makePlayer()));
    expect(parsed.type).toBe("customPlayer");
    expect(parsed.formatVersion).toBe(1);
    expect(typeof parsed.exportedAt).toBe("string");
    expect(parsed.sig).toMatch(/^[0-9a-f]{8}$/);
  });

  it("embeds the player sig in the payload", () => {
    const p = makePlayer({ name: "Export Test" });
    const parsed = JSON.parse(exportCustomPlayer(p));
    expect(typeof parsed.payload.player.sig).toBe("string");
    expect(parsed.payload.player.sig).toBe(buildPlayerSig(p));
  });

  it("round-trips through parseExportedCustomPlayer", () => {
    const p = makePlayer({ name: "Round Trip Player" });
    const result = parseExportedCustomPlayer(exportCustomPlayer(p));
    expect(result.name).toBe("Round Trip Player");
    expect(result.id).toBe(p.id);
  });
});

// ── parseExportedCustomPlayer ─────────────────────────────────────────────────

describe("parseExportedCustomPlayer", () => {
  it("throws on invalid JSON", () => {
    expect(() => parseExportedCustomPlayer("not json")).toThrow("Invalid JSON");
  });

  it("throws when type is wrong", () => {
    const payload = { player: { ...makePlayer(), sig: buildPlayerSig(makePlayer()) } };
    const sig = fnv1a(PLAYER_EXPORT_KEY + JSON.stringify(payload));
    const bad = JSON.stringify({ type: "customTeams", formatVersion: 1, payload, sig });
    expect(() => parseExportedCustomPlayer(bad)).toThrow('expected type "customPlayer"');
  });

  it("throws on unsupported formatVersion", () => {
    const payload = { player: { ...makePlayer(), sig: buildPlayerSig(makePlayer()) } };
    const sig = fnv1a(PLAYER_EXPORT_KEY + JSON.stringify(payload));
    const bad = JSON.stringify({ type: "customPlayer", formatVersion: 99, payload, sig });
    expect(() => parseExportedCustomPlayer(bad)).toThrow("Unsupported player format version");
  });

  it("throws when bundle sig is wrong", () => {
    const p = makePlayer({ name: "Tampered" });
    const json = exportCustomPlayer(p);
    const obj = JSON.parse(json) as Record<string, unknown>;
    (obj["payload"] as Record<string, unknown>)["extra"] = "tamper";
    expect(() => parseExportedCustomPlayer(JSON.stringify(obj))).toThrow("signature mismatch");
  });

  it("throws when player sig is wrong (tampered stats)", () => {
    const p = makePlayer({ name: "Tampered Stats" });
    const json = exportCustomPlayer(p);
    const obj = JSON.parse(json) as Record<string, unknown>;
    const payload = obj["payload"] as Record<string, unknown>;
    const player = payload["player"] as Record<string, unknown>;
    // Tamper the stats then re-sign the bundle sig only (player sig stays stale)
    (player["batting"] as Record<string, unknown>)["contact"] = 99;
    obj["sig"] = fnv1a(PLAYER_EXPORT_KEY + JSON.stringify(payload));
    expect(() => parseExportedCustomPlayer(JSON.stringify(obj))).toThrow(
      "content signature mismatch",
    );
  });

  it("strips the sig field from the returned player", () => {
    const p = makePlayer();
    const result = parseExportedCustomPlayer(exportCustomPlayer(p));
    expect("sig" in result).toBe(false);
  });

  it("preserves batting stats, role, position, handedness", () => {
    const p = makePlayer({
      name: "Full Player",
      role: "batter",
      batting: { contact: 78, power: 65, speed: 55 },
      position: "SS",
      handedness: "L",
    });
    const result = parseExportedCustomPlayer(exportCustomPlayer(p));
    expect(result.batting.contact).toBe(78);
    expect(result.batting.power).toBe(65);
    expect(result.position).toBe("SS");
    expect(result.handedness).toBe("L");
  });

  it("preserves pitcher pitching stats", () => {
    const p = makePlayer({
      name: "Ace Pitcher",
      role: "pitcher",
      pitching: { velocity: 92, control: 80, movement: 75 },
    });
    const result = parseExportedCustomPlayer(exportCustomPlayer(p));
    expect(result.pitching?.velocity).toBe(92);
    expect(result.pitching?.control).toBe(80);
    expect(result.pitching?.movement).toBe(75);
  });
});

// ── exportCustomPlayer — identity fields ──────────────────────────────────────

describe("exportCustomPlayer — identity fields", () => {
  it("preserves globalPlayerId in exported JSON", () => {
    const p = makePlayer({ globalPlayerId: "pl_abc12345", playerSeed: "seed-xyz" });
    const parsed = JSON.parse(exportCustomPlayer(p)) as {
      payload: { player: Record<string, unknown> };
    };
    expect(parsed.payload.player["globalPlayerId"]).toBe("pl_abc12345");
  });

  it("preserves playerSeed in exported JSON", () => {
    const p = makePlayer({ playerSeed: "my-stable-seed" });
    const parsed = JSON.parse(exportCustomPlayer(p)) as {
      payload: { player: Record<string, unknown> };
    };
    expect(parsed.payload.player["playerSeed"]).toBe("my-stable-seed");
  });

  it("preserves fingerprint in exported JSON", () => {
    const p = makePlayer({ fingerprint: "aabbccdd", playerSeed: "fp-seed" });
    const parsed = JSON.parse(exportCustomPlayer(p)) as {
      payload: { player: Record<string, unknown> };
    };
    expect(parsed.payload.player["fingerprint"]).toBe("aabbccdd");
  });

  it("round-trips globalPlayerId through parseExportedCustomPlayer", () => {
    const p = makePlayer({ globalPlayerId: "pl_roundtrip", playerSeed: "rt-seed" });
    const result = parseExportedCustomPlayer(exportCustomPlayer(p));
    expect(result.globalPlayerId).toBe("pl_roundtrip");
  });

  it("round-trips playerSeed through parseExportedCustomPlayer", () => {
    const p = makePlayer({ playerSeed: "round-trip-seed" });
    const result = parseExportedCustomPlayer(exportCustomPlayer(p));
    expect(result.playerSeed).toBe("round-trip-seed");
  });

  it("round-trips fingerprint through parseExportedCustomPlayer", () => {
    const fp = buildPlayerSig(makePlayer({ playerSeed: "fp-rt-seed" }));
    const p = makePlayer({ fingerprint: fp, playerSeed: "fp-rt-seed" });
    const result = parseExportedCustomPlayer(exportCustomPlayer(p));
    expect(result.fingerprint).toBe(fp);
  });
});

// ── Full schema round-trip: all player fields through exportCustomPlayer / parseExportedCustomPlayer ──

describe("exportCustomPlayer / parseExportedCustomPlayer — full player field round-trip", () => {
  it("round-trips all batting fields (contact, power, speed)", () => {
    const p = makePlayer({ batting: { contact: 88, power: 72, speed: 65 } });
    const result = parseExportedCustomPlayer(exportCustomPlayer(p));
    expect(result.batting.contact).toBe(88);
    expect(result.batting.power).toBe(72);
    expect(result.batting.speed).toBe(65);
  });

  it("round-trips all pitching fields (velocity, control, movement) for a pitcher", () => {
    const p = makePlayer({
      role: "pitcher",
      batting: { contact: 30, power: 20, speed: 40 },
      pitching: { velocity: 91, control: 85, movement: 78 },
    });
    const result = parseExportedCustomPlayer(exportCustomPlayer(p));
    expect(result.pitching?.velocity).toBe(91);
    expect(result.pitching?.control).toBe(85);
    expect(result.pitching?.movement).toBe(78);
  });

  it("round-trips pitchingRole through exportCustomPlayer → parseExportedCustomPlayer", () => {
    const p = makePlayer({
      role: "pitcher",
      pitching: { velocity: 90, control: 80, movement: 70 },
      pitchingRole: "SP",
    });
    expect(parseExportedCustomPlayer(exportCustomPlayer(p)).pitchingRole).toBe("SP");

    const rp = makePlayer({
      role: "pitcher",
      pitching: { velocity: 88, control: 75, movement: 65 },
      pitchingRole: "RP",
    });
    expect(parseExportedCustomPlayer(exportCustomPlayer(rp)).pitchingRole).toBe("RP");

    const swingman = makePlayer({
      role: "pitcher",
      pitching: { velocity: 87, control: 80, movement: 72 },
      pitchingRole: "SP/RP",
    });
    expect(parseExportedCustomPlayer(exportCustomPlayer(swingman)).pitchingRole).toBe("SP/RP");
  });

  it("round-trips handedness through exportCustomPlayer → parseExportedCustomPlayer", () => {
    const righty = makePlayer({ handedness: "R" });
    expect(parseExportedCustomPlayer(exportCustomPlayer(righty)).handedness).toBe("R");

    const lefty = makePlayer({ handedness: "L" });
    expect(parseExportedCustomPlayer(exportCustomPlayer(lefty)).handedness).toBe("L");

    const switch_ = makePlayer({ handedness: "S" });
    expect(parseExportedCustomPlayer(exportCustomPlayer(switch_)).handedness).toBe("S");
  });

  it("round-trips position through exportCustomPlayer → parseExportedCustomPlayer", () => {
    const p = makePlayer({ position: "CF" });
    expect(parseExportedCustomPlayer(exportCustomPlayer(p)).position).toBe("CF");
  });

  it("round-trips isBenchEligible and isPitcherEligible flags", () => {
    const p = makePlayer({ isBenchEligible: true, isPitcherEligible: false });
    const result = parseExportedCustomPlayer(exportCustomPlayer(p));
    expect(result.isBenchEligible).toBe(true);
    expect(result.isPitcherEligible).toBe(false);
  });

  it("round-trips jerseyNumber (including null) through exportCustomPlayer", () => {
    const p = makePlayer({ jerseyNumber: 42 });
    expect(parseExportedCustomPlayer(exportCustomPlayer(p)).jerseyNumber).toBe(42);

    const nullJersey = makePlayer({ jerseyNumber: null });
    expect(parseExportedCustomPlayer(exportCustomPlayer(nullJersey)).jerseyNumber).toBeNull();
  });

  it("round-trips role=two-way", () => {
    const p = makePlayer({
      role: "two-way",
      batting: { contact: 65, power: 70, speed: 60 },
      pitching: { velocity: 85, control: 80, movement: 70 },
    });
    const result = parseExportedCustomPlayer(exportCustomPlayer(p));
    expect(result.role).toBe("two-way");
    expect(result.batting.contact).toBe(65);
    expect(result.pitching?.velocity).toBe(85);
  });

  it("complete round-trip: all identity and attribute fields together", () => {
    const p: TeamPlayer = {
      id: "player-full-rt",
      name: "Complete Player",
      role: "pitcher",
      batting: { contact: 45, power: 38, speed: 52 },
      pitching: { velocity: 93, control: 87, movement: 82 },
      position: "SP",
      handedness: "R",
      isBenchEligible: false,
      isPitcherEligible: true,
      jerseyNumber: 22,
      pitchingRole: "SP",
      playerSeed: "full-rt-seed-abc",
      fingerprint: buildPlayerSig({
        name: "Complete Player",
        role: "pitcher",
        batting: { contact: 45, power: 38, speed: 52 },
        pitching: { velocity: 93, control: 87, movement: 82 },
        playerSeed: "full-rt-seed-abc",
      }),
      globalPlayerId: "pl_full_rt_gid",
    };
    const result = parseExportedCustomPlayer(exportCustomPlayer(p));
    expect(result.name).toBe("Complete Player");
    expect(result.role).toBe("pitcher");
    expect(result.batting).toEqual({ contact: 45, power: 38, speed: 52 });
    expect(result.pitching).toEqual({ velocity: 93, control: 87, movement: 82 });
    expect(result.position).toBe("SP");
    expect(result.handedness).toBe("R");
    expect(result.isBenchEligible).toBe(false);
    expect(result.isPitcherEligible).toBe(true);
    expect(result.jerseyNumber).toBe(22);
    expect(result.pitchingRole).toBe("SP");
    expect(result.playerSeed).toBe("full-rt-seed-abc");
    expect(result.globalPlayerId).toBe("pl_full_rt_gid");
    // sig must be stripped — export-only metadata
    expect("sig" in result).toBe(false);
  });
});
