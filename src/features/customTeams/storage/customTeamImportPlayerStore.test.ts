import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { _createTestDb, type BallgameDb } from "@storage/db";
import type { CreateCustomTeamInput, TeamPlayer } from "@storage/types";
import { makePlayer } from "@test/helpers/customTeams";

import { exportCustomPlayer } from "./customTeamExportImport";
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

describe("importPlayer", () => {
  it("adds the player to the target team's bench and returns success", async () => {
    const targetId = await store.createCustomTeam(
      makeInput({
        name: "Target Team",
        roster: {
          lineup: [makePlayer({ id: "p_existing", name: "Existing Batter" })],
          bench: [],
          pitchers: [],
        },
      }),
    );

    // Create a player in a separate team to export
    const sourceId = await store.createCustomTeam(
      makeInput({
        name: "Source Team",
        roster: {
          lineup: [makePlayer({ id: "p_src", name: "Import Me" })],
          bench: [],
          pitchers: [],
        },
      }),
    );
    const sourceTeam = await store.getCustomTeam(sourceId);
    if (!sourceTeam) throw new Error("Source team not found in test setup");
    const playerJson = exportCustomPlayer(sourceTeam.roster.lineup[0]);

    // Remove from source team first so no cross-team conflict
    await store.updateCustomTeam(sourceId, {
      roster: {
        lineup: [makePlayer({ id: "p_src_other", name: "Other Batter" })],
        bench: [],
        pitchers: [],
      },
    });

    const result = await store.importPlayer(targetId, playerJson, "bench");
    expect(result.status).toBe("success");

    const updated = await store.getCustomTeam(targetId);
    expect(updated?.roster.bench.some((p) => p.name === "Import Me")).toBe(true);
  });

  it("adds a pitcher to the pitchers section", async () => {
    const targetId = await store.createCustomTeam(
      makeInput({
        name: "Pitcher Target Team",
        roster: {
          lineup: [makePlayer({ id: "p_bat", name: "Batter" })],
          bench: [],
          pitchers: [],
        },
      }),
    );

    // Build a pitcher player JSON directly (not stored in any team)
    const pitcher: TeamPlayer = {
      id: "p_pitcher_src",
      name: "Import Pitcher",
      role: "pitcher",
      batting: { contact: 30, power: 20, speed: 25 },
      pitching: { velocity: 60, control: 55, movement: 45 },
      playerSeed: "pitcher-seed-unique",
      globalPlayerId: "pl_pitcher_unique_import",
    };
    const pitcherJson = exportCustomPlayer(pitcher);

    const result = await store.importPlayer(targetId, pitcherJson, "pitchers");
    expect(result.status).toBe("success");

    const updated = await store.getCustomTeam(targetId);
    expect(updated?.roster.pitchers.some((p) => p.name === "Import Pitcher")).toBe(true);
  });

  it("preserves globalPlayerId of imported player", async () => {
    const targetId = await store.createCustomTeam(
      makeInput({
        name: "Preserve GID Team",
        roster: {
          lineup: [makePlayer({ id: "p_preserve", name: "Existing" })],
          bench: [],
          pitchers: [],
        },
      }),
    );

    const player: TeamPlayer = {
      id: "p_gid_preserved",
      name: "GID Preserved",
      role: "batter",
      batting: { contact: 50, power: 50, speed: 50 },
      playerSeed: "preserve-gid-seed",
      globalPlayerId: "pl_preserved_gid_check",
    };
    const json = exportCustomPlayer(player);

    await store.importPlayer(targetId, json, "bench");

    const updated = await store.getCustomTeam(targetId);
    const imported = updated?.roster.bench.find((p) => p.name === "GID Preserved");
    expect(imported?.globalPlayerId).toBe("pl_preserved_gid_check");
    expect(imported?.playerSeed).toBe("preserve-gid-seed");
    expect(typeof imported?.fingerprint).toBe("string");
  });

  it("preserves playerSeed of imported player", async () => {
    const targetId = await store.createCustomTeam(
      makeInput({
        name: "Preserve Seed Team",
        roster: {
          lineup: [makePlayer({ id: "p_seed_pres", name: "Existing" })],
          bench: [],
          pitchers: [],
        },
      }),
    );

    const player: TeamPlayer = {
      id: "p_seed_check",
      name: "Seed Preserved",
      role: "batter",
      batting: { contact: 50, power: 50, speed: 50 },
      playerSeed: "my-exact-seed-value",
      globalPlayerId: "pl_seed_pres_check",
    };
    const json = exportCustomPlayer(player);

    await store.importPlayer(targetId, json, "bench");

    const updated = await store.getCustomTeam(targetId);
    const imported = updated?.roster.bench.find((p) => p.name === "Seed Preserved");
    expect(imported?.playerSeed).toBe("my-exact-seed-value");
    expect(imported?.globalPlayerId).toBe("pl_seed_pres_check");
    expect(typeof imported?.fingerprint).toBe("string");
  });

  it("blocks import when player's globalPlayerId already exists on a different team", async () => {
    // Create two teams; player starts on team A
    const teamAId = await store.createCustomTeam(
      makeInput({
        name: "Team A Block",
        roster: {
          lineup: [makePlayer({ id: "p_cross_team", name: "Cross Team Player" })],
          bench: [],
          pitchers: [],
        },
      }),
    );
    const teamA = await store.getCustomTeam(teamAId);
    const playerOnTeamA = teamA!.roster.lineup[0];
    // Export player from team A (has globalPlayerId)
    const playerJson = exportCustomPlayer(playerOnTeamA);

    const teamBId = await store.createCustomTeam(
      makeInput({
        name: "Team B Block",
        roster: {
          lineup: [makePlayer({ id: "p_other", name: "Other Player" })],
          bench: [],
          pitchers: [],
        },
      }),
    );

    // Attempt to import into Team B — must be blocked
    const result = await store.importPlayer(teamBId, playerJson, "lineup");
    expect(result.status).toBe("conflict");
    if (result.status === "conflict") {
      expect(result.conflictingTeamId).toBe(teamAId);
      expect(result.conflictingTeamName).toBe("Team A Block");
    }

    // Team B roster must be unchanged
    const teamB = await store.getCustomTeam(teamBId);
    expect(teamB?.roster.lineup.some((p) => p.name === "Cross Team Player")).toBe(false);
  });

  it("returns alreadyOnThisTeam when player's globalPlayerId exists on the target team", async () => {
    const teamId = await store.createCustomTeam(
      makeInput({
        name: "Same Team Check",
        roster: {
          lineup: [makePlayer({ id: "p_same_team", name: "Same Team Player" })],
          bench: [],
          pitchers: [],
        },
      }),
    );
    const team = await store.getCustomTeam(teamId);
    const existingPlayer = team!.roster.lineup[0];
    const playerJson = exportCustomPlayer(existingPlayer);

    const result = await store.importPlayer(teamId, playerJson, "bench");
    expect(result.status).toBe("alreadyOnThisTeam");

    // Roster must be unchanged
    const after = await store.getCustomTeam(teamId);
    expect(after?.roster.bench).toHaveLength(0);
  });

  it("throws when target team does not exist", async () => {
    const player: TeamPlayer = {
      id: "p_no_team",
      name: "No Team Player",
      role: "batter",
      batting: { contact: 50, power: 50, speed: 50 },
      playerSeed: "no-team-seed",
      globalPlayerId: "pl_no_team_gid",
    };
    const json = exportCustomPlayer(player);
    await expect(store.importPlayer("ct_nonexistent", json, "lineup")).rejects.toThrow(
      "Custom team not found",
    );
  });

  it("throws when player bundle lacks globalPlayerId", async () => {
    const id = await store.createCustomTeam(makeInput({ name: "No GID Team" }));
    // exportCustomPlayer does not add globalPlayerId when the player object omits it,
    // so this bundle will pass signature verification but fail the store guard.
    const player: TeamPlayer = {
      id: "p_no_gid",
      name: "No GID Player",
      role: "batter",
      batting: { contact: 50, power: 50, speed: 50 },
      playerSeed: "no-gid-seed",
      // globalPlayerId intentionally omitted
    };
    const bundleWithoutGid = exportCustomPlayer(player);
    await expect(store.importPlayer(id, bundleWithoutGid, "lineup")).rejects.toThrow(
      "globalPlayerId",
    );
  });

  it("throws on invalid player JSON", async () => {
    const id = await store.createCustomTeam(makeInput({ name: "Bad JSON Team" }));
    await expect(store.importPlayer(id, "not valid json", "lineup")).rejects.toThrow();
  });

  it("remaps player.id when the incoming id already exists in the target roster", async () => {
    const sharedId = "p_collision_id";
    const targetId = await store.createCustomTeam(
      makeInput({
        name: "Collision Target Team",
        roster: {
          lineup: [makePlayer({ id: sharedId, name: "Existing Player" })],
          bench: [],
          pitchers: [],
        },
      }),
    );

    // Create a different player that happens to have the same local id
    const incomingPlayer: TeamPlayer = {
      id: sharedId, // same local id as existing player
      name: "Incoming Collision Player",
      role: "batter",
      batting: { contact: 50, power: 45, speed: 55 },
      playerSeed: "collision-import-seed",
      globalPlayerId: "pl_collision_unique_gid",
    };
    const json = exportCustomPlayer(incomingPlayer);

    const result = await store.importPlayer(targetId, json, "bench");
    expect(result.status).toBe("success");

    const updated = await store.getCustomTeam(targetId);
    const importedPlayer = updated?.roster.bench.find(
      (p) => p.name === "Incoming Collision Player",
    );
    expect(importedPlayer).toBeDefined();
    // Local id must have been remapped — must not collide with the existing lineup player
    expect(importedPlayer?.id).not.toBe(sharedId);
    // Identity fields must be preserved despite the id remap
    expect(importedPlayer?.globalPlayerId).toBe("pl_collision_unique_gid");
    expect(importedPlayer?.playerSeed).toBe("collision-import-seed");
  });
});
