import * as React from "react";

import { DEMO_TEAMS } from "@feat/customTeams/generation/demoTeams";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the CustomTeamStore and logger before importing the hook so they are
// intercepted before any module-level code runs.
vi.mock("@feat/customTeams/storage/customTeamStore", () => ({
  CustomTeamStore: {
    listCustomTeams: vi.fn(),
    createCustomTeam: vi.fn(),
  },
}));

vi.mock("@shared/utils/logger", () => ({
  appLog: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import { CustomTeamStore } from "@feat/customTeams/storage/customTeamStore";
import { appLog } from "@shared/utils/logger";

const mockStore = CustomTeamStore as unknown as {
  listCustomTeams: ReturnType<typeof vi.fn>;
  createCustomTeam: ReturnType<typeof vi.fn>;
};

const mockLog = appLog as unknown as {
  warn: ReturnType<typeof vi.fn>;
};

let useSeedDemoTeamsFn: () => void;
let demoSeedDoneKey = "ballgame:demoSeedDone";

beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();
  const mod = await import("./useSeedDemoTeams");
  useSeedDemoTeamsFn = mod.useSeedDemoTeams;
  demoSeedDoneKey = mod.DEMO_SEED_DONE_KEY;
  localStorage.removeItem(demoSeedDoneKey);
  mockStore.createCustomTeam.mockResolvedValue("ct_some_id");
}, 20000);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useSeedDemoTeams", () => {
  it("does nothing when custom teams already exist", async () => {
    mockStore.listCustomTeams.mockResolvedValue([{ id: "ct_existing", name: "Some Team" }]);

    renderHook(() => useSeedDemoTeamsFn());

    await waitFor(() => expect(mockStore.listCustomTeams).toHaveBeenCalledOnce());
    expect(mockStore.createCustomTeam).not.toHaveBeenCalled();
  });

  it("does nothing when only archived teams exist (includeArchived: true)", async () => {
    mockStore.listCustomTeams.mockResolvedValue([
      { id: "ct_archived", name: "Old Team", metadata: { archived: true } },
    ]);

    renderHook(() => useSeedDemoTeamsFn());

    await waitFor(() => expect(mockStore.listCustomTeams).toHaveBeenCalledOnce());
    expect(mockStore.createCustomTeam).not.toHaveBeenCalled();
    // Must pass includeArchived: true so archived-only installs are not treated as empty
    expect(mockStore.listCustomTeams).toHaveBeenCalledWith({
      withRoster: false,
      includeArchived: true,
    });
  });

  it("creates all demo teams when the collection is empty", async () => {
    mockStore.listCustomTeams.mockResolvedValue([]);

    renderHook(() => useSeedDemoTeamsFn());

    await waitFor(() =>
      expect(mockStore.createCustomTeam).toHaveBeenCalledTimes(DEMO_TEAMS.length),
    );
  });

  it("sets the localStorage done-flag after seeding", async () => {
    mockStore.listCustomTeams.mockResolvedValue([]);

    renderHook(() => useSeedDemoTeamsFn());

    await waitFor(() =>
      expect(mockStore.createCustomTeam).toHaveBeenCalledTimes(DEMO_TEAMS.length),
    );
    expect(localStorage.getItem(demoSeedDoneKey)).toBe("1");
  });

  it("skips seeding when the localStorage done-flag is already set (E2E suppression)", async () => {
    localStorage.setItem(demoSeedDoneKey, "1");

    renderHook(() => useSeedDemoTeamsFn());

    // Use waitFor (which wraps in act) so React effects are fully flushed before
    // asserting. Avoids the flakiness of a fixed-duration setTimeout.
    await waitFor(() => {
      expect(mockStore.listCustomTeams).not.toHaveBeenCalled();
      expect(mockStore.createCustomTeam).not.toHaveBeenCalled();
    });
  });

  it("continues to seed when localStorage.getItem throws (unavailable storage)", async () => {
    // Simulate a browser where localStorage is blocked/unavailable.
    const getItemSpy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Storage blocked");
    });
    mockStore.listCustomTeams.mockResolvedValue([]);

    renderHook(() => useSeedDemoTeamsFn());

    // Should still fall through to the DB check and seed the teams.
    await waitFor(() =>
      expect(mockStore.createCustomTeam).toHaveBeenCalledTimes(DEMO_TEAMS.length),
    );

    getItemSpy.mockRestore();
  });

  it("passes correct team info and deterministic ID to createCustomTeam", async () => {
    mockStore.listCustomTeams.mockResolvedValue([]);

    renderHook(() => useSeedDemoTeamsFn());

    await waitFor(() =>
      expect(mockStore.createCustomTeam).toHaveBeenCalledTimes(DEMO_TEAMS.length),
    );

    DEMO_TEAMS.forEach((def, i) => {
      const [input, meta] = mockStore.createCustomTeam.mock.calls[i] as [
        { name: string; city: string; abbreviation: string },
        { id: string },
      ];
      expect(input.name).toBe(def.name);
      expect(input.city).toBe(def.city);
      expect(input.abbreviation).toBe(def.abbreviation);
      expect(meta.id).toBe(def.demoId);
    });
  });

  it("forwards position, handedness, and pitchingRole to every roster player", async () => {
    mockStore.listCustomTeams.mockResolvedValue([]);

    renderHook(() => useSeedDemoTeamsFn());

    await waitFor(() =>
      expect(mockStore.createCustomTeam).toHaveBeenCalledTimes(DEMO_TEAMS.length),
    );

    DEMO_TEAMS.forEach((def, i) => {
      const [input] = mockStore.createCustomTeam.mock.calls[i] as [
        {
          roster: {
            lineup: Array<{ position?: string; handedness?: string; pitchingRole?: string }>;
            bench: Array<{ position?: string; handedness?: string }>;
            pitchers: Array<{ position?: string; handedness?: string; pitchingRole?: string }>;
          };
        },
        unknown,
      ];

      // Every lineup player must have a position and handedness.
      input.roster.lineup.forEach((p, j) => {
        expect(p.position, `${def.name} lineup[${j}].position`).toBeDefined();
        expect(p.position, `${def.name} lineup[${j}].position non-empty`).not.toBe("");
        expect(p.handedness, `${def.name} lineup[${j}].handedness`).toBeDefined();
        expect(p.handedness, `${def.name} lineup[${j}].handedness non-empty`).not.toBe("");
      });

      // Every bench player must have a position and handedness.
      input.roster.bench.forEach((p, j) => {
        expect(p.position, `${def.name} bench[${j}].position`).toBeDefined();
        expect(p.position, `${def.name} bench[${j}].position non-empty`).not.toBe("");
        expect(p.handedness, `${def.name} bench[${j}].handedness`).toBeDefined();
        expect(p.handedness, `${def.name} bench[${j}].handedness non-empty`).not.toBe("");
      });

      // Every pitcher must have a position, handedness, and pitchingRole.
      input.roster.pitchers.forEach((p, j) => {
        expect(p.position, `${def.name} pitcher[${j}].position`).toBeDefined();
        expect(p.position, `${def.name} pitcher[${j}].position non-empty`).not.toBe("");
        expect(p.handedness, `${def.name} pitcher[${j}].handedness`).toBeDefined();
        expect(p.handedness, `${def.name} pitcher[${j}].handedness non-empty`).not.toBe("");
        expect(p.pitchingRole, `${def.name} pitcher[${j}].pitchingRole`).toBeDefined();
        expect(p.pitchingRole, `${def.name} pitcher[${j}].pitchingRole non-empty`).not.toBe("");
      });
    });
  });

  it("does not re-seed when the hook mounts a second time in the same page load", async () => {
    mockStore.listCustomTeams.mockResolvedValue([]);

    renderHook(() => useSeedDemoTeamsFn());
    await waitFor(() =>
      expect(mockStore.createCustomTeam).toHaveBeenCalledTimes(DEMO_TEAMS.length),
    );

    // Second mount — must reuse the in-flight promise and not trigger more calls.
    renderHook(() => useSeedDemoTeamsFn());
    await new Promise((r) => setTimeout(r, 0));
    expect(mockStore.createCustomTeam).toHaveBeenCalledTimes(DEMO_TEAMS.length);
  });

  it("treats a per-team error as a graceful skip and continues seeding", async () => {
    mockStore.listCustomTeams.mockResolvedValue([]);
    // First team fails (e.g. duplicate from another tab); second succeeds.
    mockStore.createCustomTeam
      .mockRejectedValueOnce(new Error(`A team named "${DEMO_TEAMS[0].name}" already exists`))
      .mockResolvedValue("ct_some_id");

    renderHook(() => useSeedDemoTeamsFn());

    await waitFor(() =>
      expect(mockStore.createCustomTeam).toHaveBeenCalledTimes(DEMO_TEAMS.length),
    );
    expect(mockLog.warn).toHaveBeenCalled();
    // At least one succeeded → done-flag must be set.
    expect(localStorage.getItem(demoSeedDoneKey)).toBe("1");
  });

  it("does NOT set the done-flag and clears _seedPromise when ALL inserts fail", async () => {
    mockStore.listCustomTeams.mockResolvedValue([]);
    const dbError = new Error("transient DB error");
    mockStore.createCustomTeam.mockRejectedValue(dbError);

    renderHook(() => useSeedDemoTeamsFn());

    await waitFor(() => expect(mockLog.warn).toHaveBeenCalled());
    // All inserts failed → done-flag must NOT be set so the next mount can retry.
    expect(localStorage.getItem(demoSeedDoneKey)).toBeNull();
    // _seedPromise was cleared by the catch handler — a new mount retries seeding.
    mockStore.createCustomTeam.mockResolvedValue("ct_some_id");
    renderHook(() => useSeedDemoTeamsFn());
    await waitFor(() =>
      expect(mockStore.createCustomTeam).toHaveBeenCalledTimes(
        DEMO_TEAMS.length * 2, // first round (all failed) + second round (all succeed)
      ),
    );
    expect(localStorage.getItem(demoSeedDoneKey)).toBe("1");
  });

  it("clears the in-flight promise on transient listCustomTeams failure so the next mount retries", async () => {
    // First mount: DB unavailable — the catch handler automatically clears _seedPromise.
    mockStore.listCustomTeams.mockRejectedValueOnce(new Error("DB unavailable"));

    renderHook(() => useSeedDemoTeamsFn());
    await waitFor(() => expect(mockLog.warn).toHaveBeenCalled());

    // No manual reset needed — the catch handler already cleared _seedPromise.
    // Second mount: DB recovered — should now seed teams.
    mockStore.listCustomTeams.mockResolvedValue([]);

    renderHook(() => useSeedDemoTeamsFn());
    await waitFor(() =>
      expect(mockStore.createCustomTeam).toHaveBeenCalledTimes(DEMO_TEAMS.length),
    );
  });
});
