/**
 * Tests for the roster-edit lock in customTeamStore.updateCustomTeam.
 * Verifies that writes are blocked when a team is in an active season,
 * and that `SANCTIONED_WRITE_CTX` bypasses the lock.
 */
import "fake-indexeddb/auto";

import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { BallgameDb } from "@storage/db";
import { SANCTIONED_WRITE_CTX } from "@storage/sanctionedWrite";
import type { CreateCustomTeamInput } from "@storage/types";
import { makePlayer } from "@test/helpers/customTeams";
import { createTestDb } from "@test/helpers/db";

import { makeCustomTeamStore } from "./customTeamStore";
import { CustomTeamLockedError } from "./errors";

const makeTeamInput = (name = "Test Team"): CreateCustomTeamInput => ({
  name,
  roster: {
    lineup: [makePlayer()],
    bench: [],
    pitchers: [],
  },
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

/** Helper: inserts a season that marks a team as active. */
async function insertActiveSeason(teamId: string, seasonId = "s_activetest"): Promise<void> {
  await db.seasons.insert({
    id: seasonId,
    name: "Active Season",
    status: "active",
    createdAt: Date.now(),
    preset: "mini",
    seasonLength: "sprint",
    masterSeed: "ms_test",
    leagues: [{ id: "lg_test", name: "Test League", teamIds: [teamId], dhEnabled: false }],
    currentGameDay: 0,
    rulesetVersion: 1,
  });
}

describe("customTeamStore lock — active season guard", () => {
  it("throws CustomTeamLockedError when updating a team in an active season (no ctx)", async () => {
    const teamId = await store.createCustomTeam(makeTeamInput("Locked Team"));
    await insertActiveSeason(teamId);

    await expect(store.updateCustomTeam(teamId, { name: "Changed Name" })).rejects.toThrow(
      CustomTeamLockedError,
    );
  });

  it("includes the teamId in the error message", async () => {
    const teamId = await store.createCustomTeam(makeTeamInput("Another Team"));
    await insertActiveSeason(teamId);

    await expect(store.updateCustomTeam(teamId, { name: "Changed" })).rejects.toThrow(teamId);
  });

  it("write succeeds when SANCTIONED_WRITE_CTX is passed", async () => {
    const teamId = await store.createCustomTeam(makeTeamInput("Sanctioned Team"));
    await insertActiveSeason(teamId);

    // Should not throw.
    await expect(
      store.updateCustomTeam(teamId, { name: "Sanctioned Change" }, SANCTIONED_WRITE_CTX),
    ).resolves.toBeUndefined();

    const updated = await store.getCustomTeam(teamId);
    expect(updated?.name).toBe("Sanctioned Change");
  });

  it("write succeeds when team is not in any active season", async () => {
    const teamId = await store.createCustomTeam(makeTeamInput("Free Team"));
    // No season inserted — team is not locked.

    await expect(store.updateCustomTeam(teamId, { name: "Free Change" })).resolves.toBeUndefined();

    const updated = await store.getCustomTeam(teamId);
    expect(updated?.name).toBe("Free Change");
  });

  it("write succeeds when the only season containing the team is complete (not active)", async () => {
    const teamId = await store.createCustomTeam(makeTeamInput("Retired Team"));
    // Insert a completed season — team should not be locked.
    await db.seasons.insert({
      id: "s_complete01",
      name: "Complete Season",
      status: "complete",
      createdAt: Date.now(),
      preset: "mini",
      seasonLength: "sprint",
      masterSeed: "ms_c",
      leagues: [{ id: "lg_c", name: "Test", teamIds: [teamId], dhEnabled: false }],
      currentGameDay: 10,
      rulesetVersion: 1,
    });

    await expect(
      store.updateCustomTeam(teamId, { name: "Retired Change" }),
    ).resolves.toBeUndefined();
  });

  it("team not in the active season's teamIds is not locked", async () => {
    const lockedTeamId = await store.createCustomTeam(makeTeamInput("Locked"));
    const freeTeamId = await store.createCustomTeam(makeTeamInput("Free"));
    await insertActiveSeason(lockedTeamId);

    // freeTeamId is not in the season — should succeed.
    await expect(
      store.updateCustomTeam(freeTeamId, { name: "Updated Free" }),
    ).resolves.toBeUndefined();
  });
});

describe("customTeamStore autogen collision — reuse vs delete", () => {
  it("reuses existing unlocked autogen team when name collision detected — returns existing id, does not delete", async () => {
    const autogenMarker = {
      version: 1 as const,
      theme: "classic" as const,
      parity: "mixed" as const,
      baseSeed: "seed_a",
    };
    const teamId = await store.createCustomTeam({
      ...makeTeamInput("Waco Rockets"),
      autogen: autogenMarker,
    });

    // Attempt to create another autogen team with the same name.
    const returnedId = await store.createCustomTeam(
      {
        ...makeTeamInput("Waco Rockets"),
        autogen: autogenMarker,
      },
      { id: "ct_new_id" },
    );

    // Should return the existing team's ID, not the proposed ID.
    expect(returnedId).toBe(teamId);

    // The team should still exist in the DB.
    const team = await store.getCustomTeam(teamId);
    expect(team).not.toBeNull();
    expect(team?.name).toBe("Waco Rockets");

    // No new team should have been created.
    const allTeams = await store.listCustomTeams();
    expect(allTeams).toHaveLength(1);
  });

  it("throws when colliding autogen team is locked in active season", async () => {
    const autogenMarker = {
      version: 1 as const,
      theme: "classic" as const,
      parity: "mixed" as const,
      baseSeed: "seed_b",
    };
    const teamId = await store.createCustomTeam({
      ...makeTeamInput("Locked Rockets"),
      autogen: autogenMarker,
    });
    await insertActiveSeason(teamId);

    await expect(
      store.createCustomTeam(
        {
          ...makeTeamInput("Locked Rockets"),
          autogen: autogenMarker,
        },
        { id: "ct_new_id2" },
      ),
    ).rejects.toThrow(/already exists and is locked/);
  });

  it("does not reuse when existing team is not autogen (throws unique name error instead)", async () => {
    // Create a user-created (non-autogen) team.
    await store.createCustomTeam(makeTeamInput("Custom Team"));

    // Attempt to create an autogen team with the same name.
    await expect(
      store.createCustomTeam({
        ...makeTeamInput("Custom Team"),
        autogen: {
          version: 1 as const,
          theme: "classic" as const,
          parity: "mixed" as const,
          baseSeed: "seed_c",
        },
      }),
    ).rejects.toThrow(/already exists.*unique/);
  });

  it("deleteCustomTeam throws when team is in active season", async () => {
    const teamId = await store.createCustomTeam(makeTeamInput("Season Team"));
    await insertActiveSeason(teamId);

    await expect(store.deleteCustomTeam(teamId)).rejects.toThrow(/Cannot delete.*active season/);

    // Team should still exist.
    const team = await store.getCustomTeam(teamId);
    expect(team).not.toBeNull();
  });
});
