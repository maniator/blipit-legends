import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { BallgameDb } from "@storage/db";
import type { CreateCustomTeamInput, TeamPlayer } from "@storage/types";
import { makePlayer } from "@test/helpers/customTeams";
import { createTestDb } from "@test/helpers/db";

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
  db = await createTestDb(getRxStorageMemory());
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
    expect(updated?.roster.bench?.some((p) => p.name === "Import Me")).toBe(true);
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
      pitching: { velocity: 60, control: 55, movement: 45, stamina: 60 },
      position: "P",
      handedness: "R",
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
      batting: { contact: 50, power: 50, speed: 50, stamina: 50 },
      position: "CF",
      handedness: "R",
    };
    const json = exportCustomPlayer(player);

    await store.importPlayer(targetId, json, "bench");

    const updated = await store.getCustomTeam(targetId);
    const imported = updated?.roster.bench?.find((p) => p.name === "GID Preserved");
    expect(imported).toBeDefined();
    expect(imported?.name).toBe("GID Preserved");
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
      batting: { contact: 50, power: 50, speed: 50, stamina: 50 },
      position: "CF",
      handedness: "R",
    };
    const json = exportCustomPlayer(player);

    await store.importPlayer(targetId, json, "bench");

    const updated = await store.getCustomTeam(targetId);
    const imported = updated?.roster.bench?.find((p) => p.name === "Seed Preserved");
    expect(imported).toBeDefined();
    expect(imported?.name).toBe("Seed Preserved");
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
    expect(after?.roster.bench ?? []).toHaveLength(0);
  });

  it("throws when target team does not exist", async () => {
    const player: TeamPlayer = {
      id: "p_no_team",
      name: "No Team Player",
      role: "batter",
      batting: { contact: 50, power: 50, speed: 50, stamina: 50 },
      position: "CF",
      handedness: "R",
    };
    const json = exportCustomPlayer(player);
    await expect(store.importPlayer("ct_nonexistent", json, "lineup")).rejects.toThrow(
      "Custom team not found",
    );
  });

  it("throws when player bundle lacks an id field", async () => {
    const id = await store.createCustomTeam(makeInput({ name: "No ID Team" }));
    await expect(store.importPlayer(id, "not valid json", "lineup")).rejects.toThrow();
  });

  it("throws when importing a pitcher into the lineup section", async () => {
    const targetId = await store.createCustomTeam(
      makeInput({
        name: "Section Guard Lineup",
        roster: {
          lineup: [makePlayer({ id: "p_sg_bat", name: "Batter" })],
          bench: [],
          pitchers: [],
        },
      }),
    );
    const pitcher: TeamPlayer = {
      id: "p_sg_pitcher",
      name: "Misplaced Pitcher",
      role: "pitcher",
      pitching: { velocity: 60, control: 55, movement: 45, stamina: 60 },
      position: "SP",
      handedness: "R",
    };
    const pitcherJson = exportCustomPlayer(pitcher);
    await expect(store.importPlayer(targetId, pitcherJson, "lineup")).rejects.toThrow(
      /cannot import a pitcher-role player into the lineup/i,
    );
    // Roster must be unchanged
    const team = await store.getCustomTeam(targetId);
    expect(team?.roster.lineup).toHaveLength(1);
  });

  it("throws when importing a pitcher into the bench section", async () => {
    const targetId = await store.createCustomTeam(
      makeInput({
        name: "Section Guard Bench",
        roster: {
          lineup: [makePlayer({ id: "p_sgb_bat", name: "Batter" })],
          bench: [],
          pitchers: [],
        },
      }),
    );
    const pitcher: TeamPlayer = {
      id: "p_sgb_pitcher",
      name: "Bench Pitcher",
      role: "pitcher",
      pitching: { velocity: 60, control: 55, movement: 45, stamina: 60 },
      position: "RP",
      handedness: "L",
    };
    const pitcherJson = exportCustomPlayer(pitcher);
    await expect(store.importPlayer(targetId, pitcherJson, "bench")).rejects.toThrow(
      /cannot import a pitcher-role player into the bench/i,
    );
  });

  it("throws when importing a non-pitcher into the pitchers section", async () => {
    const targetId = await store.createCustomTeam(
      makeInput({
        name: "Section Guard Pitchers",
        roster: {
          lineup: [makePlayer({ id: "p_sgp_bat", name: "Batter" })],
          bench: [],
          pitchers: [],
        },
      }),
    );
    const batter: TeamPlayer = {
      id: "p_sgp_batter",
      name: "Misplaced Batter",
      role: "batter",
      batting: { contact: 50, power: 50, speed: 50, stamina: 50 },
      position: "CF",
      handedness: "R",
    };
    const batterJson = exportCustomPlayer(batter);
    await expect(store.importPlayer(targetId, batterJson, "pitchers")).rejects.toThrow(
      /cannot import a non-pitcher player into the pitchers/i,
    );
    // Roster must be unchanged
    const team = await store.getCustomTeam(targetId);
    expect(team?.roster.pitchers).toHaveLength(0);
  });

  it("allows importing a pitcher into the pitchers section", async () => {
    const targetId = await store.createCustomTeam(
      makeInput({
        name: "Valid Pitcher Section",
        roster: {
          lineup: [makePlayer({ id: "p_vps_bat", name: "Batter" })],
          bench: [],
          pitchers: [],
        },
      }),
    );
    const pitcher: TeamPlayer = {
      id: "p_vps_pitcher",
      name: "Valid Pitcher",
      role: "pitcher",
      pitching: { velocity: 60, control: 55, movement: 45, stamina: 60 },
      position: "SP",
      handedness: "R",
    };
    const pitcherJson = exportCustomPlayer(pitcher);
    const result = await store.importPlayer(targetId, pitcherJson, "pitchers");
    expect(result.status).toBe("success");
    const team = await store.getCustomTeam(targetId);
    expect(team?.roster.pitchers.some((p) => p.name === "Valid Pitcher")).toBe(true);
  });

  it("allows importing a batter into the lineup section", async () => {
    const targetId = await store.createCustomTeam(
      makeInput({
        name: "Valid Batter Lineup",
        roster: {
          lineup: [makePlayer({ id: "p_vbl_existing", name: "Existing" })],
          bench: [],
          pitchers: [],
        },
      }),
    );
    const batter: TeamPlayer = {
      id: "p_vbl_new",
      name: "Valid Lineup Batter",
      role: "batter",
      batting: { contact: 50, power: 50, speed: 50, stamina: 50 },
      position: "LF",
      handedness: "L",
    };
    const batterJson = exportCustomPlayer(batter);
    const result = await store.importPlayer(targetId, batterJson, "lineup");
    expect(result.status).toBe("success");
    const team = await store.getCustomTeam(targetId);
    expect(team?.roster.lineup.some((p) => p.name === "Valid Lineup Batter")).toBe(true);
  });

  it("succeeds importing a free agent (teamId = FREE_AGENT_TEAM_ID) and moves them to the target team", async () => {
    // Create team, then detach player to make them a free agent
    const teamId = await store.createCustomTeam(
      makeInput({
        name: "Original Team",
        roster: {
          lineup: [makePlayer({ id: "p_free_agent", name: "Free Agent Fred" })],
          bench: [],
          pitchers: [],
        },
      }),
    );
    await store.deleteCustomTeam(teamId, { cascade: false });

    // Create a target team to import the free agent into
    const targetId = await store.createCustomTeam(
      makeInput({
        name: "Target Team",
        roster: {
          lineup: [makePlayer({ id: "p_other", name: "Other Player" })],
          bench: [],
          pitchers: [],
        },
      }),
    );

    // Verify Fred is a free agent
    const freePlayers = await store.listFreePlayers();
    const fredFreeAgent = freePlayers.find((p) => p.name === "Free Agent Fred");
    expect(fredFreeAgent).toBeDefined();

    // Export Fred and import into target team
    const fredJson = exportCustomPlayer(fredFreeAgent as unknown as TeamPlayer);
    const result = await store.importPlayer(targetId, fredJson, "bench");
    expect(result.status).toBe("success");

    // Verify Fred is now on the target team
    const updated = await store.getCustomTeam(targetId);
    expect(updated?.roster.bench?.some((p) => p.name === "Free Agent Fred")).toBe(true);

    // Verify Fred is no longer a free agent
    const freePlayersAfter = await store.listFreePlayers();
    expect(freePlayersAfter.some((p) => p.name === "Free Agent Fred")).toBe(false);
  });
});
