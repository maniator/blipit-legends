import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { _createTestDb, type BallgameDb } from "@storage/db";
import type { CreateCustomTeamInput } from "@storage/types";
import { makePlayer } from "@test/helpers/customTeams";

import { makeCustomTeamStore } from "./customTeamStore";

const makeInput = (overrides: Partial<CreateCustomTeamInput> = {}): CreateCustomTeamInput => ({
  name: "Test Team",
  roster: {
    lineup: [makePlayer()],
    bench: [],
    pitchers: [],
  },
  ...overrides,
});

let db: BallgameDb;
let store: ReturnType<typeof makeCustomTeamStore>;

beforeEach(async () => {
  db = await _createTestDb(getRxStorageMemory());
  store = makeCustomTeamStore(() => Promise.resolve(db));
});

afterEach(async () => {
  await db.close();
});

describe("players collection integration", () => {
  it("creates player docs in the players collection after createCustomTeam", async () => {
    const lineup = [makePlayer({ id: "p_l1", name: "Lineup One" })];
    const bench = [makePlayer({ id: "p_b1", name: "Bench One" })];
    const pitchers = [makePlayer({ id: "p_p1", name: "Pitcher One", role: "pitcher" })];
    const id = await store.createCustomTeam(
      makeInput({ name: "Players Test Team", roster: { lineup, bench, pitchers } }),
    );
    const playerDocs = await db.players.find({ selector: { teamId: id } }).exec();
    expect(playerDocs).toHaveLength(3);
    const sections = playerDocs.map((p) => p.section).sort();
    expect(sections).toEqual(["bench", "lineup", "pitchers"]);
    const lineupDoc = playerDocs.find((p) => p.section === "lineup");
    expect(lineupDoc?.name).toBe("Lineup One");
    expect(lineupDoc?.teamId).toBe(id);
    expect(lineupDoc?.orderIndex).toBe(0);
    const benchDoc = playerDocs.find((p) => p.section === "bench");
    expect(benchDoc?.name).toBe("Bench One");
    const pitcherDoc = playerDocs.find((p) => p.section === "pitchers");
    expect(pitcherDoc?.name).toBe("Pitcher One");
  });

  it("embedded roster in customTeams doc has empty arrays after createCustomTeam", async () => {
    const id = await store.createCustomTeam(
      makeInput({
        name: "Empty Embedded Team",
        roster: { lineup: [makePlayer()], bench: [makePlayer({ name: "Bench" })], pitchers: [] },
      }),
    );
    const rawDoc = await db.customTeams.findOne(id).exec();
    const raw = rawDoc?.toJSON() as unknown as {
      roster: { lineup: unknown[]; bench: unknown[]; pitchers: unknown[] };
    };
    expect(raw.roster.lineup).toHaveLength(0);
    expect(raw.roster.bench).toHaveLength(0);
    expect(raw.roster.pitchers).toHaveLength(0);
  });

  it("getCustomTeam assembles roster from players collection", async () => {
    const id = await store.createCustomTeam(
      makeInput({
        name: "Assembled Team",
        roster: {
          lineup: [
            makePlayer({ id: "pa1", name: "Batter A" }),
            makePlayer({ id: "pa2", name: "Batter B" }),
          ],
          bench: [makePlayer({ id: "pa3", name: "Bench C" })],
          pitchers: [makePlayer({ id: "pa4", name: "Pitcher D", role: "pitcher" })],
        },
      }),
    );
    const team = await store.getCustomTeam(id);
    expect(team?.roster.lineup).toHaveLength(2);
    expect(team?.roster.lineup[0].name).toBe("Batter A");
    expect(team?.roster.lineup[1].name).toBe("Batter B");
    expect(team?.roster.bench).toHaveLength(1);
    expect(team?.roster.bench[0].name).toBe("Bench C");
    expect(team?.roster.pitchers).toHaveLength(1);
    expect(team?.roster.pitchers[0].name).toBe("Pitcher D");
  });

  it("updateCustomTeam replaces player docs when roster changes", async () => {
    const id = await store.createCustomTeam(
      makeInput({
        name: "Roster Update Team",
        roster: {
          lineup: [makePlayer({ id: "old1", name: "Old Player" })],
          bench: [],
          pitchers: [],
        },
      }),
    );
    // Verify old player doc exists
    const oldDocs = await db.players.find({ selector: { teamId: id } }).exec();
    expect(oldDocs).toHaveLength(1);
    expect(oldDocs[0].name).toBe("Old Player");

    // Update roster
    await store.updateCustomTeam(id, {
      roster: { lineup: [makePlayer({ id: "new1", name: "New Player" })] },
    });

    // Old player docs should be gone, new ones should exist
    const newDocs = await db.players.find({ selector: { teamId: id } }).exec();
    expect(newDocs).toHaveLength(1);
    expect(newDocs[0].name).toBe("New Player");

    // Embedded roster arrays in customTeams doc must remain empty after update
    const rawDoc = await db.customTeams.findOne(id).exec();
    const raw = rawDoc?.toJSON() as unknown as {
      roster: { lineup: unknown[]; bench: unknown[]; pitchers: unknown[] };
    };
    expect(raw.roster.lineup).toHaveLength(0);
    expect(raw.roster.bench).toHaveLength(0);
    expect(raw.roster.pitchers).toHaveLength(0);
  });

  it("deleteCustomTeam removes all player docs for the team", async () => {
    const id = await store.createCustomTeam(
      makeInput({
        name: "Delete Players Team",
        roster: {
          lineup: [makePlayer({ id: "dp1" }), makePlayer({ id: "dp2" })],
          bench: [makePlayer({ id: "dp3" })],
          pitchers: [],
        },
      }),
    );
    // Verify player docs exist before delete
    const beforeDocs = await db.players.find({ selector: { teamId: id } }).exec();
    expect(beforeDocs).toHaveLength(3);

    await store.deleteCustomTeam(id);

    // All player docs should be gone
    const afterDocs = await db.players.find({ selector: { teamId: id } }).exec();
    expect(afterDocs).toHaveLength(0);
  });

  it("importCustomTeams inserts player docs into the players collection", async () => {
    const { exportCustomTeams: exportFn } = await import("./customTeamExportImport");
    const teamToImport = {
      id: "ct_import_players",
      schemaVersion: 1,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      name: "Import Players Team",
      source: "custom" as const,
      roster: {
        schemaVersion: 1,
        lineup: [
          {
            id: "imp_p1",
            name: "Imported Batter",
            role: "batter" as const,
            batting: { contact: 50, power: 50, speed: 50 },
          },
        ],
        bench: [
          {
            id: "imp_p2",
            name: "Imported Bench",
            role: "batter" as const,
            batting: { contact: 60, power: 50, speed: 40 },
          },
        ],
        pitchers: [],
      },
      metadata: { archived: false },
    };
    const json = exportFn([teamToImport]);
    await store.importCustomTeams(json);

    const playerDocs = await db.players.find({ selector: { teamId: "ct_import_players" } }).exec();
    expect(playerDocs).toHaveLength(2);
    const sections = playerDocs.map((p) => p.section).sort();
    expect(sections).toEqual(["bench", "lineup"]);
  });

  it("importCustomTeams backfills globalPlayerId for legacy bundle players that lack the field", async () => {
    // Simulate the real-world case: fixture-teams.json was created before globalPlayerId
    // was added to sanitizePlayer. Players have playerSeed+fingerprint but no globalPlayerId.
    // The v4 players schema has required: ["globalPlayerId"], so without the backfill in
    // toPlayerDoc, bulkUpsert throws a validation error and the import fails entirely.
    const { exportCustomTeams: exportFn } = await import("./customTeamExportImport");
    const legacyTeam = {
      id: "ct_legacy_no_gpid",
      schemaVersion: 1,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      name: "Legacy No GlobalPlayerId",
      source: "custom" as const,
      roster: {
        schemaVersion: 1,
        lineup: [
          {
            id: "lgcy_p1",
            name: "Legacy Batter",
            role: "batter" as const,
            batting: { contact: 50, power: 50, speed: 50 },
            // Explicitly no globalPlayerId — simulates fixture-teams.json format
            playerSeed: "seed_legacy_p1",
            fingerprint: "aabbccdd",
          },
        ],
        bench: [],
        pitchers: [],
      },
      metadata: { archived: false },
    };
    const json = exportFn([legacyTeam]);
    // Should not throw even though the bundle player lacks globalPlayerId
    await store.importCustomTeams(json);
    const playerDocs = await db.players.find({ selector: { teamId: "ct_legacy_no_gpid" } }).exec();
    expect(playerDocs).toHaveLength(1);
    // globalPlayerId must be backfilled — it should be the fnv1a of playerSeed
    expect(playerDocs[0].globalPlayerId).toMatch(/^pl_[0-9a-f]{8}$/);
  });

  it("legacy team with embedded roster is backfilled into players collection on getCustomTeam", async () => {
    // Simulate a legacy team with embedded roster (no player docs in players collection)
    const legacyTeamDoc = {
      id: "ct_legacy_backfill",
      schemaVersion: 1,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      name: "Legacy Backfill Team",
      source: "custom" as const,
      roster: {
        schemaVersion: 1,
        lineup: [
          {
            id: "leg_p1",
            name: "Legacy Batter",
            role: "batter" as const,
            batting: { contact: 50, power: 50, speed: 50 },
          },
        ],
        bench: [],
        pitchers: [],
      },
      metadata: { archived: false },
    };
    // Insert directly into DB (bypassing the store) to simulate legacy data
    await db.customTeams.insert(legacyTeamDoc);

    // No player docs should exist yet
    const before = await db.players.find({ selector: { teamId: "ct_legacy_backfill" } }).exec();
    expect(before).toHaveLength(0);

    // getCustomTeam should backfill and return the roster
    const team = await store.getCustomTeam("ct_legacy_backfill");
    expect(team?.roster.lineup).toHaveLength(1);
    expect(team?.roster.lineup[0].name).toBe("Legacy Batter");

    // After backfill, player docs should now exist in the players collection
    const after = await db.players.find({ selector: { teamId: "ct_legacy_backfill" } }).exec();
    expect(after).toHaveLength(1);
    expect(after[0].section).toBe("lineup");
    expect(after[0].name).toBe("Legacy Batter");
    expect(after[0].orderIndex).toBe(0);
  });

  it("orderIndex is preserved correctly across sections", async () => {
    const id = await store.createCustomTeam(
      makeInput({
        name: "Order Index Team",
        roster: {
          lineup: [
            makePlayer({ id: "oi_l0", name: "Lineup 0" }),
            makePlayer({ id: "oi_l1", name: "Lineup 1" }),
            makePlayer({ id: "oi_l2", name: "Lineup 2" }),
          ],
          bench: [
            makePlayer({ id: "oi_b0", name: "Bench 0" }),
            makePlayer({ id: "oi_b1", name: "Bench 1" }),
          ],
          pitchers: [makePlayer({ id: "oi_p0", name: "Pitcher 0", role: "pitcher" })],
        },
      }),
    );
    const team = await store.getCustomTeam(id);
    expect(team?.roster.lineup.map((p) => p.name)).toEqual(["Lineup 0", "Lineup 1", "Lineup 2"]);
    expect(team?.roster.bench.map((p) => p.name)).toEqual(["Bench 0", "Bench 1"]);
    expect(team?.roster.pitchers.map((p) => p.name)).toEqual(["Pitcher 0"]);
  });

  it("TeamPlayer fields (no teamId/section/orderIndex) are returned by getCustomTeam", async () => {
    const player = makePlayer({
      id: "tp_check",
      name: "Field Checker",
      role: "pitcher",
      pitching: { velocity: 60, control: 55, movement: 45 },
    });
    const id = await store.createCustomTeam(
      makeInput({
        name: "Field Check Team",
        roster: { lineup: [player], bench: [], pitchers: [] },
      }),
    );
    const team = await store.getCustomTeam(id);
    const returned = team?.roster.lineup[0] as unknown as Record<string, unknown>;
    expect(returned).toBeDefined();
    expect("teamId" in returned).toBe(false);
    expect("section" in returned).toBe(false);
    expect("orderIndex" in returned).toBe(false);
    // schemaVersion is a PlayerDoc-only field and must also be stripped
    expect("schemaVersion" in returned).toBe(false);
    expect(returned["name"]).toBe("Field Checker");
    expect(returned["role"]).toBe("pitcher");
  });
});
