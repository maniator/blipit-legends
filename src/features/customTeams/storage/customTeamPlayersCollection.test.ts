import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { BallgameDb } from "@storage/db";
import type { CreateCustomTeamInput, TeamWithRoster } from "@storage/types";
import { makePlayer } from "@test/helpers/customTeams";
import { createTestDb } from "@test/helpers/db";

import { makeCustomTeamStore } from "./customTeamStore";

/** Adds the required `nameLowercase` field to an inline team fixture. */
const withNL = <T extends { name: string }>(t: T): T & { nameLowercase: string } => ({
  ...t,
  nameLowercase: t.name.toLowerCase(),
});

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
  db = await createTestDb(getRxStorageMemory());
  store = makeCustomTeamStore(() => Promise.resolve(db));
});

afterEach(async () => {
  await db.close();
});

describe("players collection integration", () => {
  it("creates player docs in the players collection after createCustomTeam", async () => {
    const lineup = [makePlayer({ id: "p_l1", name: "Lineup One" })];
    const bench = [makePlayer({ id: "p_b1", name: "Bench One" })];
    const pitchers = [
      makePlayer({
        id: "p_p1",
        name: "Pitcher One",
        role: "pitcher",
        pitching: { velocity: 55, control: 55, movement: 50, stamina: 60 },
      }),
    ];
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

  it("team doc has no embedded roster after createCustomTeam — players live in players collection", async () => {
    const id = await store.createCustomTeam(
      makeInput({
        name: "Empty Embedded Team",
        roster: { lineup: [makePlayer()], bench: [makePlayer({ name: "Bench" })], pitchers: [] },
      }),
    );
    const rawDoc = await db.teams.findOne(id).exec();
    const raw = rawDoc?.toJSON() as Record<string, unknown>;
    // In v1, TeamRecord has no embedded roster — players are stored separately.
    expect(raw["roster"]).toBeUndefined();
    // Players are in the players collection.
    const players = await db.players.find({ selector: { teamId: id } }).exec();
    expect(players).toHaveLength(2);
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
          pitchers: [
            makePlayer({
              id: "pa4",
              name: "Pitcher D",
              role: "pitcher",
              pitching: { velocity: 55, control: 55, movement: 50, stamina: 60 },
            }),
          ],
        },
      }),
    );
    const team = await store.getCustomTeam(id);
    expect(team?.roster.lineup).toHaveLength(2);
    expect(team?.roster.lineup[0].name).toBe("Batter A");
    expect(team?.roster.lineup[1].name).toBe("Batter B");
    expect(team?.roster.bench).toHaveLength(1);
    expect(team?.roster.bench?.[0]?.name).toBe("Bench C");
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

    // In v1, team docs have no embedded roster — players are always in the players collection.
    const rawDoc = await db.teams.findOne(id).exec();
    const raw = rawDoc?.toJSON() as Record<string, unknown>;
    expect(raw["roster"]).toBeUndefined();
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
      roster: {
        schemaVersion: 1,
        lineup: [
          {
            id: "imp_p1",
            name: "Imported Batter",
            role: "batter" as const,
            batting: { contact: 50, power: 50, speed: 50, stamina: 50 },
            position: "CF",
            handedness: "R" as const,
          },
        ],
        bench: [
          {
            id: "imp_p2",
            name: "Imported Bench",
            role: "batter" as const,
            batting: { contact: 60, power: 50, speed: 40, stamina: 50 },
            position: "LF",
            handedness: "L" as const,
          },
        ],
        pitchers: [],
      },
      metadata: { archived: false },
    };
    const json = exportFn([withNL(teamToImport) as TeamWithRoster]);
    await store.importCustomTeams(json);

    const playerDocs = await db.players.find({ selector: { teamId: "ct_import_players" } }).exec();
    expect(playerDocs).toHaveLength(2);
    const sections = playerDocs.map((p) => p.section).sort();
    expect(sections).toEqual(["bench", "lineup"]);
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
          pitchers: [
            makePlayer({
              id: "oi_p0",
              name: "Pitcher 0",
              role: "pitcher",
              pitching: { velocity: 55, control: 55, movement: 50, stamina: 60 },
            }),
          ],
        },
      }),
    );
    const team = await store.getCustomTeam(id);
    expect(team?.roster.lineup.map((p) => p.name)).toEqual(["Lineup 0", "Lineup 1", "Lineup 2"]);
    expect((team?.roster.bench ?? []).map((p) => p.name)).toEqual(["Bench 0", "Bench 1"]);
    expect(team?.roster.pitchers.map((p) => p.name)).toEqual(["Pitcher 0"]);
  });

  it("TeamPlayer fields (no teamId/section/orderIndex) are returned by getCustomTeam", async () => {
    const player = makePlayer({
      id: "tp_check",
      name: "Field Checker",
      role: "pitcher",
      pitching: { velocity: 60, control: 55, movement: 45, stamina: 60 },
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
    // schemaVersion is a PlayerRecord-only field and must also be stripped
    expect("schemaVersion" in returned).toBe(false);
    expect(returned["name"]).toBe("Field Checker");
    expect(returned["role"]).toBe("pitcher");
  });
});
