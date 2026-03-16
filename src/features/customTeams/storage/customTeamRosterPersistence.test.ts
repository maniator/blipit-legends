import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { _createTestDb, type BallgameDb } from "@storage/db";
import type { CreateCustomTeamInput } from "@storage/types";
import { makePlayer } from "@test/helpers/customTeams";

import { populateRoster } from "./customTeamRosterPersistence";
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

describe("populateRoster — hydration from players collection", () => {
  it("hydrates roster from player docs when they exist", async () => {
    const id = await store.createCustomTeam(
      makeInput({
        name: "Hydration Team",
        roster: {
          lineup: [makePlayer({ name: "Alice" }), makePlayer({ name: "Bob" })],
          bench: [makePlayer({ name: "Charlie" })],
          pitchers: [],
        },
      }),
    );
    const team = await store.getCustomTeam(id);
    expect(team!.roster.lineup.map((p) => p.name)).toContain("Alice");
    expect(team!.roster.lineup.map((p) => p.name)).toContain("Bob");
    expect(team!.roster.bench.map((p) => p.name)).toContain("Charlie");
  });

  it("returns team unchanged when roster is empty", async () => {
    // Create with minimal roster
    const id = await store.createCustomTeam(makeInput({ name: "Empty Team" }));
    const doc = await db.customTeams.findOne(id).exec();
    const team = doc!.toJSON() as Parameters<typeof populateRoster>[1];

    // Manually empty all player docs to simulate a team with no players
    const playerDocs = await db.players.find({ selector: { teamId: id } }).exec();
    await Promise.all(playerDocs.map((p) => p.remove()));

    // Also clear the embedded arrays
    await doc!.patch({ roster: { schemaVersion: 1, lineup: [], bench: [], pitchers: [] } });

    const reloaded = await db.customTeams.findOne(id).exec();
    const reloadedTeam = reloaded!.toJSON() as Parameters<typeof populateRoster>[1];
    const result = await populateRoster(db, reloadedTeam);
    expect(result.roster.lineup).toEqual([]);
    expect(result.roster.bench).toEqual([]);
    expect(result.roster.pitchers).toEqual([]);
  });

  it("backfills player docs from embedded roster for legacy teams", async () => {
    // Simulate a legacy team with embedded roster but no player docs
    const id = await store.createCustomTeam(makeInput({ name: "Legacy Team" }));
    const doc = await db.customTeams.findOne(id).exec();

    // Remove player docs to simulate legacy state
    const playerDocs = await db.players.find({ selector: { teamId: id } }).exec();
    await Promise.all(playerDocs.map((p) => p.remove()));

    // Patch the embedded roster back (legacy format)
    const legacyPlayer = makePlayer({ name: "Legacy Player" });
    await doc!.patch({
      roster: { schemaVersion: 1, lineup: [legacyPlayer], bench: [], pitchers: [] },
    });

    const legacyTeam = (await db.customTeams.findOne(id).exec())!.toJSON() as Parameters<
      typeof populateRoster
    >[1];
    const result = await populateRoster(db, legacyTeam);

    expect(result.roster.lineup.map((p) => p.name)).toContain("Legacy Player");

    // After backfill, player docs should exist
    const newPlayerDocs = await db.players.find({ selector: { teamId: id } }).exec();
    expect(newPlayerDocs.length).toBe(1);

    // And embedded roster should be cleared
    const finalDoc = await db.customTeams.findOne(id).exec();
    expect(finalDoc!.roster.lineup).toEqual([]);
  });
});
