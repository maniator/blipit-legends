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

describe("importCustomTeams", () => {
  it("upserts incoming teams into the DB", async () => {
    const { exportCustomTeams: exportFn } = await import("./customTeamExportImport");
    const teamA = {
      id: "ct_import_a",
      schemaVersion: 1,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      name: "Import A",
      roster: {
        schemaVersion: 1,
        lineup: [
          {
            id: "p_ia",
            name: "Player",
            role: "batter" as const,
            batting: { contact: 50, power: 50, speed: 50, stamina: 50 },
            position: "CF",
            handedness: "R" as const,
          },
        ],
        bench: [],
        pitchers: [],
      },
      metadata: { archived: false },
    };
    const json = exportFn([withNL(teamA) as TeamWithRoster]);
    const result = await store.importCustomTeams(json);
    expect(result.created + result.remapped).toBe(1);
    const found = await store.getCustomTeam("ct_import_a");
    expect(found?.name).toBe("Import A");
  });

  it("returns ImportCustomTeamsResult", async () => {
    const { exportCustomTeams: exportFn } = await import("./customTeamExportImport");
    const teamB = {
      id: "ct_import_b",
      schemaVersion: 1,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      name: "Import B",
      roster: {
        schemaVersion: 1,
        lineup: [
          {
            id: "p_ib",
            name: "Player",
            role: "batter" as const,
            batting: { contact: 50, power: 50, speed: 50, stamina: 50 },
            position: "CF",
            handedness: "R" as const,
          },
        ],
        bench: [],
        pitchers: [],
      },
      metadata: { archived: false },
    };
    const json = exportFn([withNL(teamB) as TeamWithRoster]);
    const result = await store.importCustomTeams(json);
    expect(typeof result.created).toBe("number");
    expect(typeof result.remapped).toBe("number");
    expect(typeof result.skipped).toBe("number");
    expect(Array.isArray(result.duplicateWarnings)).toBe(true);
  });

  it("recomputes fingerprint from content on import (stale fingerprint is replaced)", async () => {
    const { exportCustomTeams: exportFn } = await import("./customTeamExportImport");
    const { buildPlayerSig } = await import("./customTeamSignatures");
    const playerFields = {
      name: "Identity Player",
      role: "batter" as const,
      batting: { contact: 50, power: 50, speed: 50, stamina: 50 },
      position: "CF",
      handedness: "R" as const,
    };
    // In v1, fingerprint is purely content-based (name+role+batting+pitching, no id entropy)
    const expectedFingerprint = buildPlayerSig(playerFields);
    // Use a stale value that differs from the expected fingerprint
    const staleFingerprint = expectedFingerprint + "_stale";
    const player = {
      id: "p_id_test",
      ...playerFields,
      fingerprint: staleFingerprint,
    };
    const teamWithIdentity = {
      id: "ct_identity_test",
      schemaVersion: 1,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      name: "Identity Team",
      roster: { schemaVersion: 1, lineup: [player], bench: [], pitchers: [] },
      metadata: { archived: false },
    };

    const json = exportFn([withNL(teamWithIdentity) as TeamWithRoster]);

    // Import into a fresh in-memory DB (simulates a different install)
    const freshDb = await createTestDb(getRxStorageMemory());
    const freshStore = makeCustomTeamStore(() => Promise.resolve(freshDb));

    try {
      await freshStore.importCustomTeams(json);
      const importedTeam = await freshStore.getCustomTeam("ct_identity_test");
      expect(importedTeam).not.toBeNull();
      const importedPlayer = importedTeam!.roster.lineup[0];
      // Fingerprint is recomputed from content on import (not preserved verbatim)
      expect(importedPlayer.fingerprint).toBe(expectedFingerprint);
      // The stale fingerprint must NOT be persisted
      expect(importedPlayer.fingerprint).not.toBe(staleFingerprint);
    } finally {
      await freshDb.close();
    }
  });
});

describe("importCustomTeams — stat cap enforcement", () => {
  it("rejects a bundle with over-cap batting stats and does not persist the team", async () => {
    const { exportCustomTeams: exportFn } = await import("./customTeamExportImport");
    const overCapTeam = {
      id: "ct_overcap_bat_test",
      schemaVersion: 1,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      name: "Over Cap Bat Import",
      roster: {
        schemaVersion: 1,
        lineup: [
          {
            id: "p_overcap_bat",
            name: "Over Cap Batter",
            role: "batter" as const,
            batting: { contact: 60, power: 55, speed: 50, stamina: 50 }, // 165 > 150
            position: "CF",
            handedness: "R" as const,
          },
        ],
        bench: [],
        pitchers: [],
      },
      metadata: { archived: false },
    };
    const json = exportFn([withNL(overCapTeam) as TeamWithRoster]);
    await expect(store.importCustomTeams(json)).rejects.toThrow(/stat cap/i);
    // The team must not have been persisted
    const found = await store.getCustomTeam("ct_overcap_bat_test");
    expect(found).toBeNull();
  });

  it("rejects a bundle with over-cap pitching stats", async () => {
    const { exportCustomTeams: exportFn } = await import("./customTeamExportImport");
    const overCapTeam = {
      id: "ct_overcap_pitch_test",
      schemaVersion: 1,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      name: "Over Cap Pitch Import",
      roster: {
        schemaVersion: 1,
        lineup: [
          {
            id: "p_overcap_pitch",
            name: "Over Cap Pitcher",
            role: "pitcher" as const,
            batting: { contact: 30, power: 20, speed: 25, stamina: 50 },
            pitching: { velocity: 70, control: 60, movement: 55, stamina: 60 }, // 185 > 160
            position: "P",
            handedness: "R" as const,
          },
        ],
        bench: [],
        pitchers: [],
      },
      metadata: { archived: false },
    };
    const json = exportFn([withNL(overCapTeam) as TeamWithRoster]);
    await expect(store.importCustomTeams(json)).rejects.toThrow(/stat cap/i);
  });

  it("clamps per-stat values above 100 before writing to the DB", async () => {
    const { exportCustomTeams: exportFn } = await import("./customTeamExportImport");
    const overStatTeam = {
      id: "ct_overstat_clamp_test",
      schemaVersion: 1,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      name: "Over Stat Clamp Import",
      roster: {
        schemaVersion: 1,
        lineup: [
          {
            id: "p_overstat_clamp",
            name: "Over Stat Player",
            role: "batter" as const,
            // contact=120 is above STAT_MAX=100; after clamping → 100+20+10=130 ≤ 150
            batting: { contact: 120, power: 20, speed: 10, stamina: 50 },
            position: "CF",
            handedness: "R" as const,
          },
        ],
        bench: [],
        pitchers: [],
      },
      metadata: { archived: false },
    };
    const json = exportFn([withNL(overStatTeam) as TeamWithRoster]);
    await store.importCustomTeams(json);
    const imported = await store.getCustomTeam("ct_overstat_clamp_test");
    expect(imported).not.toBeNull();
    const player = imported!.roster.lineup[0];
    // contact was clamped from 120 → 100
    expect(player.batting.contact).toBe(100);
    expect(player.batting.power).toBe(20);
    expect(player.batting.speed).toBe(10);
  });
});
