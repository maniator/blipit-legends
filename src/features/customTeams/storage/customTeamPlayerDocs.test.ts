import { describe, expect, it } from "vitest";

import type { PlayerDoc, TeamPlayer, TeamRoster } from "@storage/types";

import { assembleRoster, PLAYER_SCHEMA_VERSION, toPlayerDoc } from "./customTeamPlayerDocs";

const makePlayerDoc = (overrides: Partial<PlayerDoc> = {}): PlayerDoc => ({
  id: "team1:p1",
  playerId: "p1",
  teamId: "team1",
  section: "lineup",
  orderIndex: 0,
  schemaVersion: PLAYER_SCHEMA_VERSION,
  name: "Test Player",
  role: "batter",
  batting: { contact: 70, power: 60, speed: 50 },
  globalPlayerId: "pl_abc123",
  ...overrides,
});

const makeTeamPlayer = (overrides: Partial<TeamPlayer> = {}): TeamPlayer => ({
  id: "p1",
  name: "Test Player",
  role: "batter",
  batting: { contact: 70, power: 60, speed: 50 },
  globalPlayerId: "pl_abc123",
  ...overrides,
});

const makeRoster = (overrides: Partial<TeamRoster> = {}): TeamRoster => ({
  schemaVersion: 1,
  lineup: [],
  bench: [],
  pitchers: [],
  ...overrides,
});

describe("PLAYER_SCHEMA_VERSION", () => {
  it("is 1", () => expect(PLAYER_SCHEMA_VERSION).toBe(1));
});

describe("toPlayerDoc", () => {
  it("creates a composite id from teamId and player.id", () => {
    const doc = toPlayerDoc(makeTeamPlayer({ id: "p42" }), "team99", "lineup", 0);
    expect(doc.id).toBe("team99:p42");
  });

  it("stores original player id in playerId", () => {
    const doc = toPlayerDoc(makeTeamPlayer({ id: "orig-id" }), "team1", "bench", 3);
    expect(doc.playerId).toBe("orig-id");
  });

  it("sets teamId, section, orderIndex, schemaVersion", () => {
    const doc = toPlayerDoc(makeTeamPlayer(), "myteam", "pitchers", 5);
    expect(doc.teamId).toBe("myteam");
    expect(doc.section).toBe("pitchers");
    expect(doc.orderIndex).toBe(5);
    expect(doc.schemaVersion).toBe(PLAYER_SCHEMA_VERSION);
  });

  it("preserves existing globalPlayerId", () => {
    const doc = toPlayerDoc(
      makeTeamPlayer({ globalPlayerId: "pl_existing" }),
      "team1",
      "lineup",
      0,
    );
    expect(doc.globalPlayerId).toBe("pl_existing");
  });

  it("generates globalPlayerId from playerSeed when missing", () => {
    const player = makeTeamPlayer({ globalPlayerId: undefined, playerSeed: "seed-123" });
    const doc = toPlayerDoc(player, "team1", "lineup", 0);
    expect(doc.globalPlayerId).toMatch(/^pl_/);
  });

  it("falls back to player.id for globalPlayerId when both seed and globalPlayerId are missing", () => {
    const player = makeTeamPlayer({ globalPlayerId: undefined, playerSeed: undefined });
    const doc = toPlayerDoc(player, "team1", "lineup", 0);
    expect(doc.globalPlayerId).toMatch(/^pl_/);
  });
});

describe("assembleRoster", () => {
  it("groups docs by section and sorts by orderIndex", () => {
    const playerDocs: PlayerDoc[] = [
      makePlayerDoc({ id: "t1:p2", playerId: "p2", section: "lineup", orderIndex: 1 }),
      makePlayerDoc({ id: "t1:p1", playerId: "p1", section: "lineup", orderIndex: 0 }),
      makePlayerDoc({ id: "t1:p3", playerId: "p3", section: "bench", orderIndex: 0 }),
    ];
    const roster = assembleRoster(playerDocs, makeRoster());
    expect(roster.lineup.map((p) => p.id)).toEqual(["p1", "p2"]);
    expect(roster.bench.map((p) => p.id)).toEqual(["p3"]);
    expect(roster.pitchers).toEqual([]);
  });

  it("preserves schemaVersion from existingRoster", () => {
    const roster = assembleRoster([], makeRoster({ schemaVersion: 42 }));
    expect(roster.schemaVersion).toBe(42);
  });

  it("reconstructs original player id from playerId field", () => {
    const playerDocs: PlayerDoc[] = [
      makePlayerDoc({ id: "team1:p1", playerId: "p1", section: "lineup", orderIndex: 0 }),
    ];
    const roster = assembleRoster(playerDocs, makeRoster());
    expect(roster.lineup[0].id).toBe("p1");
  });

  it("strips teamId, section, orderIndex, schemaVersion from team player", () => {
    const playerDocs: PlayerDoc[] = [makePlayerDoc({ section: "lineup", orderIndex: 0 })];
    const roster = assembleRoster(playerDocs, makeRoster());
    const player = roster.lineup[0];
    expect("teamId" in player).toBe(false);
    expect("section" in player).toBe(false);
    expect("orderIndex" in player).toBe(false);
    expect("schemaVersion" in player).toBe(false);
  });

  it("handles pitchers section", () => {
    const playerDocs: PlayerDoc[] = [
      makePlayerDoc({ id: "t1:p10", playerId: "p10", section: "pitchers", orderIndex: 0 }),
    ];
    const roster = assembleRoster(playerDocs, makeRoster());
    expect(roster.pitchers.map((p) => p.id)).toEqual(["p10"]);
    expect(roster.lineup).toEqual([]);
    expect(roster.bench).toEqual([]);
  });
});
