import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { _createTestDb, type BallgameDb } from "@storage/db";
import type { CreateCustomTeamInput } from "@storage/types";
import { makePlayer } from "@test/helpers/customTeams";

import { resolvePlayerConflict } from "./customTeamIdentity";
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

describe("resolvePlayerConflict", () => {
  it("returns noConflict when globalPlayerId does not exist", async () => {
    const result = await resolvePlayerConflict(db, "pl_nonexistent", "team1");
    expect(result.status).toBe("noConflict");
  });

  it("returns alreadyOnThisTeam when globalPlayerId is on the target team", async () => {
    const teamId = await store.createCustomTeam(makeInput({ name: "Target Team" }));
    const team = await store.getCustomTeam(teamId);
    const player = team!.roster.lineup[0];

    const result = await resolvePlayerConflict(db, player.globalPlayerId!, teamId);
    expect(result.status).toBe("alreadyOnThisTeam");
  });

  it("returns conflict when globalPlayerId exists on a different team", async () => {
    const teamAId = await store.createCustomTeam(makeInput({ name: "Team A" }));
    const teamBId = await store.createCustomTeam(makeInput({ name: "Team B" }));

    const teamA = await store.getCustomTeam(teamAId);
    const playerOnA = teamA!.roster.lineup[0];

    const result = await resolvePlayerConflict(db, playerOnA.globalPlayerId!, teamBId);
    expect(result.status).toBe("conflict");
    if (result.status === "conflict") {
      expect(result.conflictingTeamId).toBe(teamAId);
      expect(result.conflictingTeamName).toBe("Team A");
    }
  });

  it("returns noConflict when player doc has null teamId (free agent)", async () => {
    const teamId = await store.createCustomTeam(makeInput({ name: "Old Team" }));
    const team = await store.getCustomTeam(teamId);
    const player = team!.roster.lineup[0];

    // Delete the team with cascade: false to detach the player
    await store.deleteCustomTeam(teamId, { cascade: false });

    const result = await resolvePlayerConflict(db, player.globalPlayerId!, "new-team-id");
    expect(result.status).toBe("noConflict");
  });
});
