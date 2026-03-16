import type { SaveDoc } from "@storage/types";

/**
 * Builds a minimal valid SaveDoc fixture for unit tests.
 * Pass `overrides` to adjust any field from the defaults.
 */
export const makeSaveDoc = (overrides: Partial<SaveDoc> = {}): SaveDoc =>
  ({
    id: "save_1",
    name: "Test Save",
    seed: "abc",
    homeTeamId: "Home",
    awayTeamId: "Away",
    createdAt: 1000,
    updatedAt: 2000,
    progressIdx: 0,
    schemaVersion: 1,
    setup: {
      strategy: "balanced",
      managedTeam: null,
      managerMode: false,
      homeTeam: "Home",
      awayTeam: "Away",
    },
    ...overrides,
  }) as SaveDoc;
