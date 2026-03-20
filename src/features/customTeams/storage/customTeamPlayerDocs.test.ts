import "fake-indexeddb/auto";

import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { BallgameDb } from "@storage/db";
import type { PlayerRecord, TeamPlayer, TeamRoster } from "@storage/types";
import { makePlayer } from "@test/helpers/customTeams";
import { createTestDb } from "@test/helpers/db";

import {
  assembleRoster,
  fetchTeamPlayers,
  PLAYER_SCHEMA_VERSION,
  removeTeamPlayerRecords,
  writePlayerRecords,
} from "./customTeamPlayerDocs";
import { makeCustomTeamStore } from "./customTeamStore";

const makeRoster = (overrides: Partial<TeamRoster> = {}): TeamRoster => ({
  schemaVersion: 1,
  lineup: [],
  bench: [],
  pitchers: [],
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

describe("PLAYER_SCHEMA_VERSION", () => {
  it("is 1", () => expect(PLAYER_SCHEMA_VERSION).toBe(1));
});

describe("fetchTeamPlayers", () => {
  it("returns empty array when no players exist for team", async () => {
    const players = await fetchTeamPlayers(db, "nonexistent-team");
    expect(players).toEqual([]);
  });

  it("returns player records for a team", async () => {
    const teamId = await store.createCustomTeam({
      name: "Fetch Test Team",
      roster: {
        lineup: [makePlayer({ name: "Alice" })],
        bench: [makePlayer({ name: "Bob" })],
        pitchers: [],
      },
    });
    const players = await fetchTeamPlayers(db, teamId);
    expect(players.length).toBe(2);
    const names = players.map((p) => p.name);
    expect(names).toContain("Alice");
    expect(names).toContain("Bob");
  });
});

describe("assembleRoster", () => {
  it("groups and sorts players correctly by section and orderIndex", async () => {
    const teamId = await store.createCustomTeam({
      name: "Assemble Team",
      roster: {
        lineup: [makePlayer({ name: "L1" }), makePlayer({ name: "L2" })],
        bench: [makePlayer({ name: "B1" })],
        pitchers: [
          makePlayer({
            name: "P1",
            role: "pitcher",
            pitching: { velocity: 55, control: 55, movement: 50, stamina: 60 },
          }),
        ],
      },
    });
    const players = await fetchTeamPlayers(db, teamId);
    const roster = assembleRoster(players);
    expect(roster.lineup.map((p) => p.name)).toEqual(["L1", "L2"]);
    expect(roster.bench.map((p) => p.name)).toEqual(["B1"]);
    expect(roster.pitchers.map((p) => p.name)).toEqual(["P1"]);
  });

  it("returns empty sections when players array is empty", () => {
    const roster = assembleRoster([]);
    expect(roster.lineup).toEqual([]);
    expect(roster.bench).toEqual([]);
    expect(roster.pitchers).toEqual([]);
  });

  it("strips teamId, section, orderIndex, schemaVersion, createdAt, updatedAt from TeamPlayer", async () => {
    const teamId = await store.createCustomTeam({
      name: "Strip Fields Team",
      roster: { lineup: [makePlayer({ name: "X" })], bench: [], pitchers: [] },
    });
    const players = await fetchTeamPlayers(db, teamId);
    const roster = assembleRoster(players);
    const player = roster.lineup[0];
    expect("teamId" in player).toBe(false);
    expect("section" in player).toBe(false);
    expect("orderIndex" in player).toBe(false);
    expect("schemaVersion" in player).toBe(false);
    expect("createdAt" in player).toBe(false);
    expect("updatedAt" in player).toBe(false);
  });
});

describe("writePlayerRecords", () => {
  it("uses simple player IDs (not composite)", async () => {
    const teamId = await store.createCustomTeam({
      name: "Write Test Team",
      roster: { lineup: [makePlayer({ name: "Alice" })], bench: [], pitchers: [] },
    });
    const players = await fetchTeamPlayers(db, teamId);
    // IDs should be plain p_xxx IDs, not composite "${teamId}:${playerId}"
    for (const p of players) {
      expect(p.id).not.toContain(":");
      expect(p.id).toMatch(/^p_/);
    }
  });

  it("upserts player records and returns their IDs", async () => {
    const teamId = await store.createCustomTeam({
      name: "Upsert Team",
      roster: {
        lineup: [makePlayer({ name: "A" }), makePlayer({ name: "B" })],
        bench: [],
        pitchers: [],
      },
    });
    const roster = makeRoster({
      lineup: [makePlayer({ name: "C" }), makePlayer({ name: "D" })],
    });
    const writtenIds = await writePlayerRecords(db, teamId, roster);
    expect(writtenIds.size).toBe(2);
  });
});

describe("removeTeamPlayerRecords", () => {
  it("removes all player records for a team", async () => {
    const teamId = await store.createCustomTeam({
      name: "Remove Team",
      roster: {
        lineup: [makePlayer({ name: "A" }), makePlayer({ name: "B" })],
        bench: [],
        pitchers: [],
      },
    });
    await removeTeamPlayerRecords(db, teamId);
    const remaining = await fetchTeamPlayers(db, teamId);
    expect(remaining).toEqual([]);
  });

  it("only removes records not in exceptIds", async () => {
    const teamId = await store.createCustomTeam({
      name: "Partial Remove Team",
      roster: {
        lineup: [makePlayer({ name: "Keep" }), makePlayer({ name: "Remove" })],
        bench: [],
        pitchers: [],
      },
    });
    const players = await fetchTeamPlayers(db, teamId);
    const keepId = players.find((p) => p.name === "Keep")!.id;
    await removeTeamPlayerRecords(db, teamId, new Set([keepId]));
    const remaining = await fetchTeamPlayers(db, teamId);
    expect(remaining.length).toBe(1);
    expect(remaining[0].name).toBe("Keep");
  });
});
