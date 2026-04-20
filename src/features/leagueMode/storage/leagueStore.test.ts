import "fake-indexeddb/auto";

import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { BallgameDb } from "@storage/db";
import { createTestDb } from "@test/helpers/db";

import { buildLeagueStore } from "./leagueStore";

let db: BallgameDb;

beforeEach(async () => {
  db = await createTestDb(getRxStorageMemory());
});

afterEach(async () => {
  await db.close();
});

describe("leagueStore", () => {
  it("createLeague returns a record with a generated id", async () => {
    const store = buildLeagueStore(() => Promise.resolve(db));
    const league = await store.createLeague({
      name: "Pacific Legends",
      teamIds: ["ct_team1", "ct_team2"],
      divisionCount: 2,
      status: "active",
    });

    expect(league.id).toMatch(/^league_/);
    expect(league.name).toBe("Pacific Legends");
    expect(league.teamIds).toEqual(["ct_team1", "ct_team2"]);
    expect(league.divisionCount).toBe(2);
    expect(league.status).toBe("active");
    expect(league.schemaVersion).toBe(0);
    expect(typeof league.createdAt).toBe("number");
    expect(typeof league.updatedAt).toBe("number");
  });

  it("getLeague returns null for a missing id", async () => {
    const store = buildLeagueStore(() => Promise.resolve(db));
    const result = await store.getLeague("league_nonexistent");
    expect(result).toBeNull();
  });

  it("listLeagues with status filter returns only matching leagues", async () => {
    const store = buildLeagueStore(() => Promise.resolve(db));
    await store.createLeague({
      name: "Active League",
      teamIds: [],
      divisionCount: 1,
      status: "active",
    });
    await store.createLeague({
      name: "Archived League",
      teamIds: [],
      divisionCount: 1,
      status: "archived",
    });

    const activeLeagues = await store.listLeagues("active");
    expect(activeLeagues).toHaveLength(1);
    expect(activeLeagues[0].name).toBe("Active League");

    const archivedLeagues = await store.listLeagues("archived");
    expect(archivedLeagues).toHaveLength(1);
    expect(archivedLeagues[0].name).toBe("Archived League");

    const allLeagues = await store.listLeagues();
    expect(allLeagues).toHaveLength(2);
  });

  it("archiveLeague sets status to archived", async () => {
    const store = buildLeagueStore(() => Promise.resolve(db));
    const league = await store.createLeague({
      name: "Test League",
      teamIds: [],
      divisionCount: 1,
      status: "active",
    });

    await store.archiveLeague(league.id);

    const updated = await store.getLeague(league.id);
    expect(updated?.status).toBe("archived");
  });
});
