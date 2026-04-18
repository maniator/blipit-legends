import * as React from "react";

import { exportCustomPlayer } from "@feat/customTeams/storage/customTeamExportImport";
import { fnv1a } from "@storage/hash";
import { CustomTeamStore } from "@feat/customTeams/storage/customTeamStore";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  TeamBatterPlayer,
  TeamPitcherPlayer,
  TeamPlayer,
  TeamWithRoster,
} from "@storage/types";
import {
  buildPlayerSig,
  PLAYER_EXPORT_KEY,
} from "@feat/customTeams/storage/customTeamExportImport";

import type { EditorAction, EditorPlayer } from "./editorState";
import type { PendingPlayerImport } from "./useImportPlayerFile";
import { useImportPlayerFile } from "./useImportPlayerFile";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@feat/customTeams/storage/customTeamStore", () => ({
  CustomTeamStore: {
    importPlayer: vi.fn().mockResolvedValue({ status: "success", finalLocalId: "mock-player-id" }),
  },
}));

// Stub FileReader to call onload synchronously with preset content.
let _fileContent = "";
const MockFileReader = vi.fn().mockImplementation(() => {
  const instance = {
    result: "",
    onload: null as ((e: Event) => void) | null,
    onerror: null as (() => void) | null,
    readAsText(_file: File) {
      instance.result = _fileContent;
      queueMicrotask(() => instance.onload?.({} as Event));
    },
  };
  return instance;
});
vi.stubGlobal("FileReader", MockFileReader);
afterAll(() => vi.unstubAllGlobals());

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePlayerJson(overrides?: Partial<TeamBatterPlayer> & { role?: "batter" }): string;
function makePlayerJson(overrides: Partial<TeamPitcherPlayer> & { role: "pitcher" }): string;
function makePlayerJson(overrides: Partial<TeamPlayer> = {}): string {
  const player: TeamPlayer =
    overrides.role === "pitcher"
      ? {
          id: "p_src",
          name: "Imported Pitcher",
          role: "pitcher",
          position: "P",
          handedness: "R" as const,
          pitching: { velocity: 70, control: 60, movement: 55, stamina: 60 },
          ...(overrides as Partial<TeamPitcherPlayer>),
        }
      : {
          id: "p_src",
          name: "Imported Batter",
          role: "batter",
          position: "C",
          handedness: "R" as const,
          batting: { contact: 70, power: 60, speed: 55, stamina: 50 },
          ...(overrides as Partial<TeamBatterPlayer>),
        };
  return exportCustomPlayer(player);
}

const makeTeamDoc = (id: string, name: string, players: TeamPlayer[] = []): TeamWithRoster => ({
  id,
  schemaVersion: 1,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  name,
  nameLowercase: name.toLowerCase(),
  abbreviation: "TST",
  roster: { schemaVersion: 1, lineup: players, bench: [], pitchers: [] },
  metadata: { archived: false },
});

const makeFile = (content: string) =>
  new File([content], "player.json", { type: "application/json" });

const makeLegacyMissingStaminaPlayerJson = (
  playerJson: string,
  role: "batter" | "pitcher",
): string => {
  const bundle = JSON.parse(playerJson) as {
    payload: { player: Record<string, unknown> };
    sig: string;
  };
  const player = bundle.payload.player;
  if (role === "batter") {
    const batting = player["batting"] as Record<string, unknown>;
    delete batting["stamina"];
  } else {
    const pitching = player["pitching"] as Record<string, unknown>;
    delete pitching["stamina"];
  }
  player["sig"] = buildPlayerSig(player as Parameters<typeof buildPlayerSig>[0]);
  bundle.sig = fnv1a(PLAYER_EXPORT_KEY + JSON.stringify(bundle.payload));
  return JSON.stringify(bundle);
};

const makeChangeEvent = (content: string): React.ChangeEvent<HTMLInputElement> => {
  const file = makeFile(content);
  return {
    target: { files: [file], value: "" } as unknown as EventTarget & HTMLInputElement,
  } as React.ChangeEvent<HTMLInputElement>;
};

type HookOptions = {
  teamId?: string;
  allTeams?: TeamWithRoster[];
  lineup?: EditorPlayer[];
  bench?: EditorPlayer[];
  pitchers?: EditorPlayer[];
};

const renderImportHook = (opts: HookOptions = {}) => {
  const dispatch = vi.fn();
  const setPendingPlayerImport = vi.fn();
  const { result } = renderHook(() =>
    useImportPlayerFile({
      teamId: opts.teamId,
      allTeams: opts.allTeams ?? [],
      lineup: opts.lineup ?? [],
      bench: opts.bench ?? [],
      pitchers: opts.pitchers ?? [],
      dispatch: dispatch as React.Dispatch<EditorAction>,
      setPendingPlayerImport: setPendingPlayerImport as React.Dispatch<
        React.SetStateAction<PendingPlayerImport | null>
      >,
    }),
  );
  return { result, dispatch, setPendingPlayerImport };
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useImportPlayerFile — edit mode (teamId set)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls CustomTeamStore.importPlayer and dispatches ADD_PLAYER on success", async () => {
    vi.mocked(CustomTeamStore.importPlayer).mockResolvedValue({
      status: "success",
      finalLocalId: "mock-player-id",
    });
    const playerJson = makePlayerJson({ name: "New Player" });
    _fileContent = playerJson;

    const { result, dispatch } = renderImportHook({ teamId: "ct_edit" });
    const handler = result.current("lineup");

    act(() => {
      handler(makeChangeEvent(playerJson));
    });

    await waitFor(() => {
      expect(CustomTeamStore.importPlayer).toHaveBeenCalledWith("ct_edit", playerJson, "lineup");
    });
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: "ADD_PLAYER", section: "lineup" }),
      );
    });
  });

  it("dispatches SET_ERROR with owning team name on conflict", async () => {
    vi.mocked(CustomTeamStore.importPlayer).mockResolvedValue({
      status: "conflict",
      conflictingTeamId: "ct_other",
      conflictingTeamName: "Other Team",
    });
    const playerJson = makePlayerJson({ name: "Contested" });
    _fileContent = playerJson;

    const { result, dispatch } = renderImportHook({ teamId: "ct_edit" });
    act(() => {
      result.current("lineup")(makeChangeEvent(playerJson));
    });

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "SET_ERROR",
          error: expect.stringContaining('"Other Team"'),
        }),
      );
    });
  });

  it("dispatches SET_ERROR when player is already on this team", async () => {
    vi.mocked(CustomTeamStore.importPlayer).mockResolvedValue({ status: "alreadyOnThisTeam" });
    const playerJson = makePlayerJson();
    _fileContent = playerJson;

    const { result, dispatch } = renderImportHook({ teamId: "ct_edit" });
    act(() => {
      result.current("lineup")(makeChangeEvent(playerJson));
    });

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "SET_ERROR",
          error: expect.stringMatching(/already on this team/i),
        }),
      );
    });
  });
});

describe("useImportPlayerFile — create mode (no teamId)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dispatches ADD_PLAYER when no conflict exists", async () => {
    const playerJson = makePlayerJson({ name: "Fresh Player" });
    _fileContent = playerJson;

    const { result, dispatch } = renderImportHook({ allTeams: [] });
    act(() => {
      result.current("bench")(makeChangeEvent(playerJson));
    });

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: "ADD_PLAYER", section: "bench" }),
      );
    });
    expect(CustomTeamStore.importPlayer).not.toHaveBeenCalled();
  });

  it("shows soft fingerprint warning when fingerprint matches", async () => {
    // A player that has the same stats as an existing player.
    const playerWithoutGid: TeamPlayer = {
      id: "p_nogid",
      name: "No GID Player",
      role: "batter",
      position: "C",
      handedness: "R" as const,
      batting: { contact: 60, power: 50, speed: 40, stamina: 50 },
    };
    const playerJson = exportCustomPlayer(playerWithoutGid);
    _fileContent = playerJson;

    // allTeams has a team with a player with the exact same fingerprint
    const teamWithDuplicate = makeTeamDoc("ct_dup", "Dup Team", [
      {
        id: "p_dup",
        name: "No GID Player",
        role: "batter",
        position: "C",
        handedness: "R" as const,
        batting: { contact: 60, power: 50, speed: 40, stamina: 50 },
        // same stats, so buildPlayerSig will produce the same fingerprint
      },
    ]);

    const { result, setPendingPlayerImport } = renderImportHook({
      allTeams: [teamWithDuplicate],
    });
    act(() => {
      result.current("lineup")(makeChangeEvent(playerJson));
    });

    await waitFor(() => {
      expect(setPendingPlayerImport).toHaveBeenCalledWith(
        expect.objectContaining({
          section: "lineup",
          warning: expect.stringContaining("Dup Team"),
        }),
      );
    });
  });

  it("calling onConfirm from pending import dispatches ADD_PLAYER", async () => {
    const playerWithoutGid: TeamPlayer = {
      id: "p_confirm",
      name: "Confirm Player",
      role: "batter",
      position: "C",
      handedness: "R" as const,
      batting: { contact: 65, power: 45, speed: 55, stamina: 50 },
    };
    const playerJson = exportCustomPlayer(playerWithoutGid);
    _fileContent = playerJson;

    const teamWithDuplicate = makeTeamDoc("ct_conf", "Conf Team", [
      {
        id: "p_c2",
        name: "Confirm Player",
        role: "batter",
        position: "C",
        handedness: "R" as const,
        batting: { contact: 65, power: 45, speed: 55, stamina: 50 },
      },
    ]);

    let capturedPending: PendingPlayerImport | null = null;
    const setPendingPlayerImport = vi.fn(
      (val: React.SetStateAction<PendingPlayerImport | null>) => {
        capturedPending = typeof val === "function" ? val(null) : val;
      },
    );
    const dispatch = vi.fn();
    const { result } = renderHook(() =>
      useImportPlayerFile({
        teamId: undefined,
        allTeams: [teamWithDuplicate],
        lineup: [],
        bench: [],
        pitchers: [],
        dispatch: dispatch as React.Dispatch<EditorAction>,
        setPendingPlayerImport: setPendingPlayerImport as React.Dispatch<
          React.SetStateAction<PendingPlayerImport | null>
        >,
      }),
    );

    act(() => {
      result.current("lineup")(makeChangeEvent(playerJson));
    });

    await waitFor(() => {
      expect(capturedPending).not.toBeNull();
    });

    // Call onConfirm — should dispatch ADD_PLAYER.
    await act(async () => {
      await capturedPending?.onConfirm();
    });

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "ADD_PLAYER", section: "lineup" }),
    );
  });

  it("shows soft fingerprint warning when imported pitcher fingerprint matches existing pitcher (no batting block)", async () => {
    // The imported pitcher has no batting block — its fingerprint is computed from
    // {name, role, pitching} only, matching how the DB stores pitcher fingerprints.
    const importedPitcher: TeamPitcherPlayer = {
      id: "p_pitch_import",
      name: "Ace Pitcher",
      role: "pitcher",
      position: "P",
      handedness: "R" as const,
      pitching: { velocity: 85, control: 70, movement: 65, stamina: 60 },
    };
    const pitcherJson = exportCustomPlayer(importedPitcher);
    _fileContent = pitcherJson;

    // Existing team has a pitcher with the exact same name + pitching stats
    // (stored with no batting block, as sanitizePlayer enforces for pitchers).
    const existingPitcher: TeamPitcherPlayer = {
      id: "p_pitch_existing",
      name: "Ace Pitcher",
      role: "pitcher",
      position: "P",
      handedness: "R" as const,
      pitching: { velocity: 85, control: 70, movement: 65, stamina: 60 },
    };
    const teamWithDuplicate: TeamWithRoster = {
      id: "ct_dup_pitcher",
      schemaVersion: 1,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
      name: "Rival Squad",
      nameLowercase: "rival squad",
      abbreviation: "RIV",
      roster: { schemaVersion: 1, lineup: [], bench: [], pitchers: [existingPitcher] },
      metadata: { archived: false },
    };

    const { result, setPendingPlayerImport } = renderImportHook({
      allTeams: [teamWithDuplicate],
    });
    act(() => {
      result.current("pitchers")(makeChangeEvent(pitcherJson));
    });

    await waitFor(() => {
      expect(setPendingPlayerImport).toHaveBeenCalledWith(
        expect.objectContaining({
          section: "pitchers",
          warning: expect.stringContaining("Rival Squad"),
        }),
      );
    });
  });

  it("shows soft fingerprint warning for legacy batter import missing stamina when defaulted to 50", async () => {
    const playerJson = makeLegacyMissingStaminaPlayerJson(
      makePlayerJson({
        name: "Legacy Batter",
        role: "batter",
        batting: { contact: 60, power: 50, speed: 40, stamina: 50 },
      }),
      "batter",
    );
    _fileContent = playerJson;

    const teamWithDuplicate = makeTeamDoc("ct_dup_legacy_batter", "Legacy Dup Team", [
      {
        id: "p_dup_legacy_batter",
        name: "Legacy Batter",
        role: "batter",
        position: "C",
        handedness: "R" as const,
        batting: { contact: 60, power: 50, speed: 40, stamina: 50 },
      },
    ]);

    const { result, setPendingPlayerImport } = renderImportHook({
      allTeams: [teamWithDuplicate],
    });
    act(() => {
      result.current("lineup")(makeChangeEvent(playerJson));
    });

    await waitFor(() => {
      expect(setPendingPlayerImport).toHaveBeenCalledWith(
        expect.objectContaining({
          section: "lineup",
          warning: expect.stringContaining("Legacy Dup Team"),
        }),
      );
    });
  });

  it("shows soft fingerprint warning for legacy pitcher import missing stamina when defaulted to 60", async () => {
    const playerJson = makeLegacyMissingStaminaPlayerJson(
      makePlayerJson({
        role: "pitcher",
        name: "Legacy Pitcher",
        pitching: { velocity: 85, control: 70, movement: 65, stamina: 60 },
      }),
      "pitcher",
    );
    _fileContent = playerJson;

    const teamWithDuplicate = makeTeamDoc("ct_dup_legacy_pitcher", "Legacy Pitch Dup", []);
    teamWithDuplicate.roster.pitchers = [
      {
        id: "p_dup_legacy_pitcher",
        name: "Legacy Pitcher",
        role: "pitcher",
        position: "P",
        handedness: "R" as const,
        pitching: { velocity: 85, control: 70, movement: 65, stamina: 60 },
      },
    ];

    const { result, setPendingPlayerImport } = renderImportHook({
      allTeams: [teamWithDuplicate],
    });
    act(() => {
      result.current("pitchers")(makeChangeEvent(playerJson));
    });

    await waitFor(() => {
      expect(setPendingPlayerImport).toHaveBeenCalledWith(
        expect.objectContaining({
          section: "pitchers",
          warning: expect.stringContaining("Legacy Pitch Dup"),
        }),
      );
    });
  });

  it("dispatches ADD_PLAYER directly when no fingerprint match found", async () => {
    // No duplicates anywhere → straight to ADD_PLAYER without showing duplicate warning.
    const playerWithoutGid: TeamPlayer = {
      id: "p_unique",
      name: "Unique Player",
      role: "batter",
      position: "C",
      handedness: "R" as const,
      batting: { contact: 55, power: 45, speed: 35, stamina: 50 },
    };
    const playerJson = exportCustomPlayer(playerWithoutGid);
    _fileContent = playerJson;

    const { result, dispatch, setPendingPlayerImport } = renderImportHook({ allTeams: [] });
    act(() => {
      result.current("lineup")(makeChangeEvent(playerJson));
    });

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: "ADD_PLAYER", section: "lineup" }),
      );
    });
    expect(setPendingPlayerImport).not.toHaveBeenCalled();
  });
});

describe("useImportPlayerFile — error paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dispatches SET_ERROR on invalid JSON", async () => {
    _fileContent = "not valid json at all";

    const { result, dispatch } = renderImportHook();
    act(() => {
      result.current("lineup")(makeChangeEvent("not valid json at all"));
    });

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "SET_ERROR",
          error: expect.stringContaining("Failed to import player"),
        }),
      );
    });
  });

  it("dispatches SET_ERROR when FileReader fires onerror", async () => {
    // Override mock to fire onerror instead of onload.
    MockFileReader.mockImplementationOnce(() => {
      const instance = {
        result: "",
        onload: null as ((e: Event) => void) | null,
        onerror: null as (() => void) | null,
        readAsText(_file: File) {
          queueMicrotask(() => instance.onerror?.());
        },
      };
      return instance;
    });

    const { result, dispatch } = renderImportHook();
    act(() => {
      result.current("lineup")(makeChangeEvent("anything"));
    });

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "SET_ERROR",
          error: expect.stringContaining("Failed to read player file"),
        }),
      );
    });
  });

  it("does nothing when no file is selected", () => {
    const { result, dispatch } = renderImportHook();
    act(() => {
      result.current("lineup")({
        target: { files: [], value: "" } as unknown as EventTarget & HTMLInputElement,
      } as React.ChangeEvent<HTMLInputElement>);
    });
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe("useImportPlayerFile — role/section mismatch", () => {
  it("rejects a pitcher exported into the lineup section", async () => {
    const pitcherJson = makePlayerJson({ role: "pitcher", name: "Ace Pitcher" });
    _fileContent = pitcherJson;

    const { result, dispatch } = renderImportHook();
    act(() => {
      result.current("lineup")(makeChangeEvent(pitcherJson));
    });

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "SET_ERROR",
          error: expect.stringContaining('"Ace Pitcher" is a pitcher'),
        }),
      );
    });
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("Lineup/Bench") }),
    );
  });

  it("rejects a pitcher exported into the bench section", async () => {
    const pitcherJson = makePlayerJson({ role: "pitcher", name: "Relief Pitcher" });
    _fileContent = pitcherJson;

    const { result, dispatch } = renderImportHook();
    act(() => {
      result.current("bench")(makeChangeEvent(pitcherJson));
    });

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "SET_ERROR",
          error: expect.stringContaining('"Relief Pitcher" is a pitcher'),
        }),
      );
    });
  });

  it("rejects a batter exported into the pitchers section", async () => {
    const batterJson = makePlayerJson({ role: "batter", name: "Slugger" });
    _fileContent = batterJson;

    const { result, dispatch } = renderImportHook();
    act(() => {
      result.current("pitchers")(makeChangeEvent(batterJson));
    });

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "SET_ERROR",
          error: expect.stringContaining('"Slugger" is a batter'),
        }),
      );
    });
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("Pitchers") }),
    );
  });

  it("allows a pitcher into the pitchers section (no rejection)", async () => {
    const pitcherJson = makePlayerJson({ role: "pitcher", name: "Valid Pitcher" });
    _fileContent = pitcherJson;

    const { result, dispatch } = renderImportHook();
    act(() => {
      result.current("pitchers")(makeChangeEvent(pitcherJson));
    });

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: "ADD_PLAYER", section: "pitchers" }),
      );
    });
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: "SET_ERROR" }));
  });
});
