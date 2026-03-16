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

describe("deleteCustomTeam", () => {
  it("removes the team document", async () => {
    const id = await store.createCustomTeam(makeInput({ name: "Doomed" }));
    await store.deleteCustomTeam(id);
    const team = await store.getCustomTeam(id);
    expect(team).toBeNull();
  });

  it("does not throw when deleting a non-existent team", async () => {
    await expect(store.deleteCustomTeam("nonexistent")).resolves.not.toThrow();
  });

  it("removes team from list", async () => {
    const id1 = await store.createCustomTeam(makeInput({ name: "Keep" }));
    const id2 = await store.createCustomTeam(makeInput({ name: "Delete Me" }));
    await store.deleteCustomTeam(id2);
    const teams = await store.listCustomTeams({ includeArchived: true });
    expect(teams.map((t) => t.id)).toContain(id1);
    expect(teams.map((t) => t.id)).not.toContain(id2);
  });
});

describe("deleteCustomTeam — cascade: false (free agents)", () => {
  it("detaches player docs when cascade is false", async () => {
    const player = makePlayer({ name: "Free Agent Fred" });
    const id = await store.createCustomTeam(
      makeInput({
        name: "Cascade-Off Team",
        roster: { lineup: [player], bench: [], pitchers: [] },
      }),
    );
    await store.deleteCustomTeam(id, { cascade: false });
    const freePlayers = await store.listFreePlayers();
    expect(freePlayers.some((p) => p.name === "Free Agent Fred")).toBe(true);
    expect(freePlayers.every((p) => p.teamId == null)).toBe(true);
  });

  it("removes team doc even when cascade is false", async () => {
    const id = await store.createCustomTeam(makeInput({ name: "Cascade-Off Check" }));
    await store.deleteCustomTeam(id, { cascade: false });
    const team = await store.getCustomTeam(id);
    expect(team).toBeNull();
  });

  it("cascade true (default) deletes player docs", async () => {
    const player = makePlayer({ name: "Cascade Delete Player" });
    const id = await store.createCustomTeam(
      makeInput({
        name: "Cascade-On Team",
        roster: { lineup: [player], bench: [], pitchers: [] },
      }),
    );
    await store.deleteCustomTeam(id);
    const freePlayers = await store.listFreePlayers();
    expect(freePlayers.some((p) => p.name === "Cascade Delete Player")).toBe(false);
  });
});

describe("listFreePlayers", () => {
  it("returns empty array when there are no free agents", async () => {
    const freePlayers = await store.listFreePlayers();
    expect(freePlayers).toEqual([]);
  });

  it("does not include players belonging to active teams", async () => {
    const player = makePlayer({ name: "Active Player" });
    await store.createCustomTeam(
      makeInput({ name: "Active Team", roster: { lineup: [player], bench: [], pitchers: [] } }),
    );
    const freePlayers = await store.listFreePlayers();
    expect(freePlayers).toHaveLength(0);
  });
});
