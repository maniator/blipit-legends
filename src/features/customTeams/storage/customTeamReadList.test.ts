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

describe("getCustomTeam", () => {
  it("returns the team by id", async () => {
    const id = await store.createCustomTeam(makeInput({ name: "Falcons" }));
    const team = await store.getCustomTeam(id);
    expect(team?.name).toBe("Falcons");
  });

  it("returns null when not found", async () => {
    const team = await store.getCustomTeam("nonexistent");
    expect(team).toBeNull();
  });
});

describe("listCustomTeams", () => {
  it("returns all non-archived teams by default", async () => {
    await store.createCustomTeam(makeInput({ name: "Active Team" }));
    await store.createCustomTeam(
      makeInput({ name: "Archived Team", metadata: { archived: true } }),
    );
    const teams = await store.listCustomTeams();
    expect(teams).toHaveLength(1);
    expect(teams[0].name).toBe("Active Team");
  });

  it("returns archived teams when includeArchived is true", async () => {
    await store.createCustomTeam(makeInput({ name: "Active" }));
    await store.createCustomTeam(makeInput({ name: "Archived", metadata: { archived: true } }));
    const teams = await store.listCustomTeams({ includeArchived: true });
    expect(teams).toHaveLength(2);
  });

  it("returns empty array when no teams exist", async () => {
    const teams = await store.listCustomTeams();
    expect(teams).toEqual([]);
  });

  it("returns teams ordered by updatedAt descending", async () => {
    const id1 = await store.createCustomTeam(makeInput({ name: "First" }), {
      id: "ct_first",
    });
    const id2 = await store.createCustomTeam(makeInput({ name: "Second" }), {
      id: "ct_second",
    });
    // touch id1 so it has a newer updatedAt
    await store.updateCustomTeam(id1, { name: "First Updated" });
    const teams = await store.listCustomTeams();
    expect(teams[0].id).toBe(id1);
    expect(teams[1].id).toBe(id2);
  });
});
