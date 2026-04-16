import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { BallgameDb } from "@storage/db";
import type { CreateCustomTeamInput, TeamRecord } from "@storage/types";
import { makePlayer } from "@test/helpers/customTeams";
import { createTestDb } from "@test/helpers/db";

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
  db = await createTestDb(getRxStorageMemory());
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
    expect((team!.roster.bench ?? []).map((p) => p.name)).toContain("Charlie");
  });

  it("returns empty roster when no player docs exist", async () => {
    const id = await store.createCustomTeam(makeInput({ name: "Empty Team" }));

    // Manually empty all player docs to simulate a team with no players
    const playerDocs = await db.players.find({ selector: { teamId: id } }).exec();
    await Promise.all(playerDocs.map((p) => p.remove()));

    const reloaded = await db.teams.findOne(id).exec();
    const reloadedTeam = reloaded!.toJSON() as TeamRecord;
    const result = await populateRoster(db, reloadedTeam);
    expect(result.roster.lineup).toEqual([]);
    expect(result.roster.bench).toEqual([]);
    expect(result.roster.pitchers).toEqual([]);
  });
});
