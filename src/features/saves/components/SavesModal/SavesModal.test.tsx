import * as React from "react";

import type { Strategy } from "@feat/gameplay/context/index";
import { GameContext } from "@feat/gameplay/context/index";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { downloadJson } from "@storage/saveIO";
import type { GameSaveSetup, SaveRecord } from "@storage/types";
import { makeSaveDoc } from "@test/helpers/saves";
import { makeContextValue, makeState } from "@test/testHelpers";

import SavesModal from ".";

HTMLDialogElement.prototype.showModal = vi.fn().mockImplementation(function (
  this: HTMLDialogElement,
) {
  this.setAttribute("open", "");
});
HTMLDialogElement.prototype.close = vi.fn().mockImplementation(function (this: HTMLDialogElement) {
  this.removeAttribute("open");
});

// jsdom doesn't implement window.confirm; stub it to return true so delete actions work.
const confirmMock = vi.fn(() => true);
vi.stubGlobal("confirm", confirmMock);
afterAll(() => vi.unstubAllGlobals());

const mockSetup: GameSaveSetup = {
  strategy: "balanced" as Strategy,
  managedTeam: null,
  managerMode: false,
  homeTeam: "Home",
  awayTeam: "Away",
};

/** SavesModal-specific defaults that differ from the shared makeSaveDoc defaults. */
const slotBase = { name: "Test save", setup: mockSetup } as const;

// Default no-op store returned by the hook mock.
const makeMockStore = (
  overrides: Partial<
    ReturnType<(typeof import("@feat/saves/hooks/useSaveStore"))["useSaveStore"]>
  > = {},
) => ({
  saves: [] as SaveRecord[],
  createSave: vi.fn().mockResolvedValue("save_1"),
  updateProgress: vi.fn().mockResolvedValue(undefined),
  deleteSave: vi.fn().mockResolvedValue(undefined),
  exportRxdbSave: vi.fn().mockResolvedValue('{"version":1,"sig":"abc","header":{},"events":[]}'),
  importRxdbSave: vi.fn().mockResolvedValue(makeSaveDoc({ ...slotBase })),
  appendEvents: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

vi.mock("@feat/saves/hooks/useSaveStore", () => ({
  useSaveStore: vi.fn(() => makeMockStore()),
}));

vi.mock("@shared/hooks/useCustomTeams", () => ({
  useCustomTeams: vi.fn(() => ({
    teams: [],
    loading: false,
    createTeam: vi.fn(),
    updateTeam: vi.fn(),
    deleteTeam: vi.fn(),
    refresh: vi.fn(),
  })),
}));

vi.mock("@shared/utils/rng", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@shared/utils/rng")>();
  return { ...actual, getRngState: vi.fn().mockReturnValue(42) };
});

vi.mock("@shared/utils/saves", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@shared/utils/saves")>();
  return { ...actual, currentSeedStr: vi.fn().mockReturnValue("abc") };
});

vi.mock("@storage/saveIO", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@storage/saveIO")>();
  return {
    ...actual,
    downloadJson: vi.fn(),
  };
});

const noop = vi.fn();

const renderModal = (
  props: Partial<React.ComponentProps<typeof SavesModal>> = {},
  ctxOverrides: Partial<ReturnType<typeof makeContextValue>> = {},
) =>
  render(
    <GameContext.Provider value={makeContextValue(ctxOverrides)}>
      <SavesModal
        strategy="balanced"
        managedTeam={0}
        managerMode={false}
        currentSaveId={null}
        onSaveIdChange={noop}
        {...props}
      />
    </GameContext.Provider>,
  );

/** Clicks the Saves button to open the dialog. */
const openPanel = () =>
  act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /open saves panel/i }));
  });

describe("SavesModal", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    confirmMock.mockReturnValue(true);
    const { useSaveStore } = await import("@feat/saves/hooks/useSaveStore");
    vi.mocked(useSaveStore).mockReturnValue(makeMockStore());
    // Restore showModal/close mock implementations after vi.clearAllMocks()
    HTMLDialogElement.prototype.showModal = vi.fn().mockImplementation(function (
      this: HTMLDialogElement,
    ) {
      this.setAttribute("open", "");
    });
    HTMLDialogElement.prototype.close = vi.fn().mockImplementation(function (
      this: HTMLDialogElement,
    ) {
      this.removeAttribute("open");
    });
  });

  it("renders the Saves button", () => {
    renderModal();
    expect(screen.getByRole("button", { name: /open saves panel/i })).toBeInTheDocument();
  });

  it("opens the dialog when Saves button is clicked", async () => {
    renderModal({ gameStarted: true });
    await openPanel();
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /save current game/i })).toBeInTheDocument();
  });

  it("shows 'Update save' when currentSaveId is provided", async () => {
    renderModal({ currentSaveId: "save_1", gameStarted: true });
    await openPanel();
    expect(screen.getByRole("button", { name: /update save/i })).toBeInTheDocument();
  });

  it("calls createSave and onSaveIdChange when save button is clicked", async () => {
    const { useSaveStore } = await import("@feat/saves/hooks/useSaveStore");
    const mockCreateSave = vi.fn().mockResolvedValue("save_1");
    vi.mocked(useSaveStore).mockReturnValue(makeMockStore({ createSave: mockCreateSave }));
    const onSaveIdChange = vi.fn();
    renderModal({ onSaveIdChange, gameStarted: true });
    await openPanel();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save current game/i }));
      await vi.waitFor(() => expect(mockCreateSave).toHaveBeenCalled());
    });
    expect(onSaveIdChange).toHaveBeenCalledWith("save_1");
  });

  it("shows saved slot name after opening", async () => {
    const { useSaveStore } = await import("@feat/saves/hooks/useSaveStore");
    vi.mocked(useSaveStore).mockReturnValue(
      makeMockStore({ saves: [makeSaveDoc({ ...slotBase })] }),
    );
    renderModal();
    await openPanel();
    expect(screen.getByText("Test save")).toBeInTheDocument();
  });

  it("calls onLoadSave and onSaveIdChange when Load is clicked", async () => {
    const { useSaveStore } = await import("@feat/saves/hooks/useSaveStore");
    const slot = makeSaveDoc({ ...slotBase, stateSnapshot: { state: makeState(), rngState: 42 } });
    vi.mocked(useSaveStore).mockReturnValue(makeMockStore({ saves: [slot] }));
    const onSaveIdChange = vi.fn();
    const onLoadSave = vi.fn();
    renderModal({ onSaveIdChange, onLoadSave });
    await openPanel();
    fireEvent.click(screen.getAllByRole("button", { name: /^load$/i })[0]);
    expect(onLoadSave).toHaveBeenCalledWith(slot);
    expect(onSaveIdChange).toHaveBeenCalledWith(slot.id);
  });

  it("passes the full slot (including setup) to onLoadSave when Load is clicked", async () => {
    const { useSaveStore } = await import("@feat/saves/hooks/useSaveStore");
    const slot = makeSaveDoc({
      ...slotBase,
      stateSnapshot: { state: makeState(), rngState: null },
      setup: { ...mockSetup, strategy: "aggressive" as Strategy, managedTeam: 1 as 0 | 1 },
    });
    vi.mocked(useSaveStore).mockReturnValue(makeMockStore({ saves: [slot] }));
    const onLoadSave = vi.fn();
    renderModal({ onLoadSave });
    await openPanel();
    fireEvent.click(screen.getAllByRole("button", { name: /^load$/i })[0]);
    expect(onLoadSave).toHaveBeenCalledWith(
      expect.objectContaining({ id: slot.id, setup: slot.setup }),
    );
  });

  it("falls back to same-seed save's snapshot when clicked slot has none", async () => {
    const { useSaveStore } = await import("@feat/saves/hooks/useSaveStore");
    const snapshotState = makeState({ inning: 3 });
    const slotWithSnapshot = makeSaveDoc({
      ...slotBase,
      id: "save_2",
      seed: "abc",
      updatedAt: 3000,
      stateSnapshot: { state: snapshotState, rngState: null },
    });
    const slotWithoutSnapshot = makeSaveDoc({
      ...slotBase,
      id: "save_1",
      seed: "abc",
      updatedAt: 1000,
    });
    vi.mocked(useSaveStore).mockReturnValue(
      makeMockStore({ saves: [slotWithoutSnapshot, slotWithSnapshot] }),
    );
    const onLoadSave = vi.fn();
    const onSaveIdChange = vi.fn();
    renderModal({ onLoadSave, onSaveIdChange });
    await openPanel();
    // Click Load on the slot that has no snapshot (first in list)
    fireEvent.click(screen.getAllByRole("button", { name: /^load$/i })[0]);
    // Should pass an enriched slot with the fallback snapshot filled in
    expect(onLoadSave).toHaveBeenCalledWith(
      expect.objectContaining({
        id: slotWithoutSnapshot.id,
        stateSnapshot: slotWithSnapshot.stateSnapshot,
      }),
    );
    expect(onSaveIdChange).toHaveBeenCalledWith(slotWithoutSnapshot.id);
  });

  it("shows error when no snapshot exists for any save", async () => {
    const { useSaveStore } = await import("@feat/saves/hooks/useSaveStore");
    const slot = makeSaveDoc({ ...slotBase, seed: "abc" }); // no stateSnapshot
    vi.mocked(useSaveStore).mockReturnValue(makeMockStore({ saves: [slot] }));
    const onLoadSave = vi.fn();
    renderModal({ onLoadSave });
    await openPanel();
    fireEvent.click(screen.getAllByRole("button", { name: /^load$/i })[0]);
    expect(onLoadSave).not.toHaveBeenCalled();
    // Error message logged to play-by-play (via dispatchLog)
  });

  it("calls deleteSave when ✕ is clicked", async () => {
    const { useSaveStore } = await import("@feat/saves/hooks/useSaveStore");
    const mockDeleteSave = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useSaveStore).mockReturnValue(
      makeMockStore({ saves: [makeSaveDoc({ ...slotBase })], deleteSave: mockDeleteSave }),
    );
    renderModal();
    await openPanel();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /delete save/i }));
    });
    expect(mockDeleteSave).toHaveBeenCalledWith("save_1");
  });

  it("shows an error message when import text is invalid", async () => {
    const { useSaveStore } = await import("@feat/saves/hooks/useSaveStore");
    vi.mocked(useSaveStore).mockReturnValue(
      makeMockStore({
        importRxdbSave: vi.fn().mockRejectedValue(new Error("Invalid JSON")),
      }),
    );
    renderModal();
    await openPanel();
    fireEvent.change(screen.getByRole("textbox", { name: /import save json/i }), {
      target: { value: "not-json" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /import from text/i }));
    });
    expect(screen.getByText("Invalid JSON")).toBeInTheDocument();
  });

  it("calls importRxdbSave on successful paste import", async () => {
    const { useSaveStore } = await import("@feat/saves/hooks/useSaveStore");
    const mockImport = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useSaveStore).mockReturnValue(makeMockStore({ importRxdbSave: mockImport }));
    renderModal();
    await openPanel();
    fireEvent.change(screen.getByRole("textbox", { name: /import save json/i }), {
      target: { value: '{"valid":"json"}' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /import from text/i }));
    });
    expect(mockImport).toHaveBeenCalledWith('{"valid":"json"}');
  });

  it("shows 'Failed to read file' when FileReader errors", async () => {
    const mockReader = {
      onload: null as ((e: ProgressEvent) => void) | null,
      onerror: null as (() => void) | null,
      readAsText: vi.fn().mockImplementation(function (this: typeof mockReader) {
        this.onerror?.();
      }),
    };
    vi.spyOn(global, "FileReader").mockImplementation(() => mockReader as unknown as FileReader);

    const { container } = renderModal();
    await openPanel();
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(fileInput, "files", {
      value: [new File(["bad"], "bad.json", { type: "application/json" })],
    });
    await act(async () => {
      fireEvent.change(fileInput);
    });
    expect(screen.getByText(/failed to read file/i)).toBeInTheDocument();
  });

  it("calls onSaveIdChange(null) when the current save is deleted", async () => {
    const { useSaveStore } = await import("@feat/saves/hooks/useSaveStore");
    const mockDeleteSave = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useSaveStore).mockReturnValue(
      makeMockStore({ saves: [makeSaveDoc({ ...slotBase })], deleteSave: mockDeleteSave }),
    );
    const onSaveIdChange = vi.fn();
    renderModal({ currentSaveId: "save_1", onSaveIdChange });
    await openPanel();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /delete save/i }));
    });
    expect(onSaveIdChange).toHaveBeenCalledWith(null);
  });

  it("calls exportRxdbSave and downloadJson when Export is clicked", async () => {
    const { useSaveStore } = await import("@feat/saves/hooks/useSaveStore");
    const slot = makeSaveDoc({ ...slotBase });
    const mockExport = vi
      .fn()
      .mockResolvedValue('{"version":1,"sig":"abc","header":{},"events":[]}');
    vi.mocked(useSaveStore).mockReturnValue(
      makeMockStore({ saves: [slot], exportRxdbSave: mockExport }),
    );
    renderModal();
    await openPanel();
    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: /^export$/i })[0]);
      await vi.waitFor(() => expect(downloadJson).toHaveBeenCalled());
    });
    expect(mockExport).toHaveBeenCalledWith(slot.id);
  });

  it("calls onLoadSave with the full slot when Load is clicked", async () => {
    const { useSaveStore } = await import("@feat/saves/hooks/useSaveStore");
    const slot = makeSaveDoc({
      ...slotBase,
      stateSnapshot: { state: makeState(), rngState: null },
    });
    vi.mocked(useSaveStore).mockReturnValue(makeMockStore({ saves: [slot] }));
    const onLoadSave = vi.fn();
    renderModal({ onLoadSave });
    await openPanel();
    fireEvent.click(screen.getAllByRole("button", { name: /^load$/i })[0]);
    expect(onLoadSave).toHaveBeenCalledWith(slot);
  });

  it("auto-loads imported save after successful paste import", async () => {
    const { useSaveStore } = await import("@feat/saves/hooks/useSaveStore");
    const importedSlot = makeSaveDoc({
      ...slotBase,
      id: "imported_1",
      stateSnapshot: { state: makeState({ inning: 6 }), rngState: null },
    });
    const mockImport = vi.fn().mockResolvedValue(importedSlot);
    vi.mocked(useSaveStore).mockReturnValue(makeMockStore({ importRxdbSave: mockImport }));
    const onLoadSave = vi.fn();
    renderModal({ onLoadSave });
    await openPanel();
    fireEvent.change(screen.getByRole("textbox", { name: /import save json/i }), {
      target: { value: '{"valid":"json"}' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /import from text/i }));
      await vi.waitFor(() => expect(onLoadSave).toHaveBeenCalled());
    });
    expect(onLoadSave).toHaveBeenCalledWith(importedSlot);
  });

  it("auto-loads imported save after successful file import", async () => {
    const { useSaveStore } = await import("@feat/saves/hooks/useSaveStore");
    const importedSlot = makeSaveDoc({
      ...slotBase,
      id: "imported_2",
      stateSnapshot: { state: makeState({ inning: 7 }), rngState: null },
    });
    const mockImport = vi.fn().mockResolvedValue(importedSlot);
    vi.mocked(useSaveStore).mockReturnValue(makeMockStore({ importRxdbSave: mockImport }));

    const mockReader = {
      onload: null as ((e: ProgressEvent) => void) | null,
      onerror: null as (() => void) | null,
      readAsText: vi.fn().mockImplementation(function (this: typeof mockReader) {
        this.onload?.({ target: { result: '{"valid":"json"}' } } as unknown as ProgressEvent);
      }),
    };
    vi.spyOn(global, "FileReader").mockImplementation(() => mockReader as unknown as FileReader);

    const onLoadSave = vi.fn();
    const { container } = renderModal({ onLoadSave });
    await openPanel();
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(fileInput, "files", {
      value: [new File(['{"valid":"json"}'], "import.json", { type: "application/json" })],
    });
    await act(async () => {
      fireEvent.change(fileInput);
      await vi.waitFor(() => expect(onLoadSave).toHaveBeenCalled());
    });
    expect(onLoadSave).toHaveBeenCalledWith(importedSlot);
  });

  it("defaults close button label to 'Close'", async () => {
    renderModal();
    await openPanel();
    expect(screen.getByTestId("saves-modal-close-button")).toHaveTextContent("Close");
  });

  it("does not close twice when dialog is already closed (post-programmatic-close click bubbling guard)", async () => {
    // Regression guard: when a child button handler calls close() programmatically,
    // the original click event continues to bubble up to the <dialog> element.
    // At that point dialog.open is false so getBoundingClientRect() returns all-zeros,
    // making every screen coordinate appear "outside" — which would falsely trigger
    // close() again. The guard must prevent this.
    const { container } = renderModal();
    await openPanel();
    const dialog = container.querySelector('[data-testid="saves-modal"]') as HTMLDialogElement;
    expect(dialog.open).toBe(true);
    // Simulate dialog.close(): remove the `open` attribute (matching our mock impl).
    dialog.removeAttribute("open");
    expect(dialog.open).toBe(false);
    // Simulate the bubbled click that arrives after the dialog was already closed.
    // Should not throw and should not call showModal/close again.
    fireEvent.click(dialog, { clientX: 200, clientY: 200 });
    // The close mock should only have been called 0 times (we removed the attr manually above).
    expect(HTMLDialogElement.prototype.close).not.toHaveBeenCalled();
  });

  it("hides 'Save current game' when gameStarted is false (passive load-saves entry)", async () => {
    renderModal({ gameStarted: false });
    await openPanel();
    expect(screen.queryByTestId("save-game-button")).not.toBeInTheDocument();
  });

  it("shows 'Save current game' when gameStarted is true", async () => {
    renderModal({ gameStarted: true });
    await openPanel();
    expect(screen.getByTestId("save-game-button")).toBeInTheDocument();
  });

  it("handleSave stores no function fields in the state snapshot (regression: DataCloneError)", async () => {
    const { useSaveStore } = await import("@feat/saves/hooks/useSaveStore");
    const mockUpdateProgress = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useSaveStore).mockReturnValue(makeMockStore({ updateProgress: mockUpdateProgress }));
    renderModal({ currentSaveId: "save_1", gameStarted: true });
    await openPanel();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /update save/i }));
      await vi.waitFor(() => expect(mockUpdateProgress).toHaveBeenCalled());
    });
    const [, , summary] = mockUpdateProgress.mock.calls[0];
    const storedState = (summary as { stateSnapshot?: { state?: unknown } }).stateSnapshot?.state;
    expect(storedState).toBeDefined();
    // Every value in the stored state must be serializable (no functions).
    const hasFunction = (obj: unknown): boolean => {
      if (typeof obj === "function") return true;
      if (obj !== null && typeof obj === "object") {
        return Object.values(obj as Record<string, unknown>).some(hasFunction);
      }
      return false;
    };
    expect(hasFunction(storedState)).toBe(false);
  });

  it("preserves custom team IDs in snapshot state when onLoadSave is called (resolved only at presentation time)", async () => {
    const { useSaveStore } = await import("@feat/saves/hooks/useSaveStore");
    const snapState = makeState({ teams: ["custom:ct_abc", "Home"] as [string, string] });
    const slot = makeSaveDoc({ ...slotBase, stateSnapshot: { state: snapState, rngState: null } });
    vi.mocked(useSaveStore).mockReturnValue(makeMockStore({ saves: [slot] }));
    const onLoadSave = vi.fn();
    renderModal({ onLoadSave });
    await openPanel();
    fireEvent.click(screen.getAllByRole("button", { name: /^load$/i })[0]);
    const calledSlot = onLoadSave.mock.calls[0]?.[0] as SaveRecord;
    expect(calledSlot).toBeDefined();
    const teams: [string, string] = calledSlot.stateSnapshot?.state?.teams as [string, string];
    // custom: ID must be preserved so GameInner can resolve it at restore time
    expect(teams[0]).toBe("custom:ct_abc");
    expect(teams[1]).toBe("Home");
  });
});
