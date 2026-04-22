import * as React from "react";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Outlet, Route, Routes } from "react-router";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Mock SaveStore so tests don't need IndexedDB
vi.mock("@feat/saves/storage/saveStore", () => ({
  SaveStore: {
    listSaves: vi.fn().mockResolvedValue([]),
    deleteSave: vi.fn().mockResolvedValue(undefined),
    exportRxdbSave: vi.fn().mockResolvedValue("{}"),
    importRxdbSave: vi.fn(),
  },
}));

// Mock teamsCollection so tests don't need IndexedDB
vi.mock("@storage/db", () => ({
  teamsCollection: vi.fn().mockResolvedValue({
    find: () => ({ exec: () => Promise.resolve([]) }),
  }),
}));

vi.mock("@storage/saveIO", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@storage/saveIO")>();
  return {
    ...actual,
    downloadJson: vi.fn(),
  };
});

// jsdom doesn't implement window.confirm; stub it to return true so delete actions work.
const confirmMock = vi.fn(() => true);
vi.stubGlobal("confirm", confirmMock);
afterAll(() => vi.unstubAllGlobals());

import { SaveStore } from "@feat/saves/storage/saveStore";

import { downloadJson } from "@storage/saveIO";
import { makeSaveDoc } from "@test/helpers/saves";

import SavesPage from "./index";

const mockOnLoadSave = vi.fn();

/** Wraps SavesPage inside a MemoryRouter with outlet context. */
function renderSavesPage(initialPath = "/saves") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/"
          element={<Outlet context={{ onLoadSave: mockOnLoadSave, onStartGame: vi.fn() }} />}
        >
          <Route path="saves" element={<SavesPage />} />
          <Route index element={<div data-testid="home-screen" />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

/** SavesPage-specific defaults that differ from the shared makeSaveDoc defaults. */
const pageDefaults = {
  name: "Team A vs Team B",
  seed: "abc123",
  homeTeamId: "TeamB",
  awayTeamId: "TeamA",
  createdAt: 1000000,
  updatedAt: 1000000,
} as const;

describe("SavesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    confirmMock.mockReturnValue(true);
    vi.mocked(SaveStore.listSaves).mockResolvedValue([]);
    vi.mocked(SaveStore.importRxdbSave).mockResolvedValue(
      makeSaveDoc({ ...pageDefaults, id: "imported_save" }),
    );
  });

  it("renders the saves page", async () => {
    renderSavesPage();
    await waitFor(() => expect(screen.getByTestId("saves-page")).toBeInTheDocument());
  });

  it("shows empty state when no saves exist", async () => {
    renderSavesPage();
    await waitFor(() => expect(screen.getByTestId("saves-page-empty")).toBeInTheDocument());
    expect(screen.getByText(/no saves yet/i)).toBeInTheDocument();
  });

  it("shows saves list when saves exist", async () => {
    vi.mocked(SaveStore.listSaves).mockResolvedValue([makeSaveDoc({ ...pageDefaults })]);
    renderSavesPage();
    await waitFor(() => expect(screen.getByTestId("saves-list")).toBeInTheDocument());
    expect(screen.getByText("Team A vs Team B")).toBeInTheDocument();
  });

  it("calls onLoadSave when Load button is clicked", async () => {
    const save = makeSaveDoc({ ...pageDefaults });
    vi.mocked(SaveStore.listSaves).mockResolvedValue([save]);
    const user = userEvent.setup();
    renderSavesPage();
    await waitFor(() => expect(screen.getByTestId("load-save-button")).toBeInTheDocument());
    await user.click(screen.getByTestId("load-save-button"));
    expect(mockOnLoadSave).toHaveBeenCalledWith(save);
  });

  it("deletes a save when Delete button is clicked", async () => {
    const save = makeSaveDoc({ ...pageDefaults });
    vi.mocked(SaveStore.listSaves).mockResolvedValue([save]);
    const user = userEvent.setup();
    renderSavesPage();
    await waitFor(() => expect(screen.getByTestId("delete-save-button")).toBeInTheDocument());
    await user.click(screen.getByTestId("delete-save-button"));
    expect(SaveStore.deleteSave).toHaveBeenCalledWith("save_1");
  });

  it("shows import file input", async () => {
    renderSavesPage();
    await waitFor(() => expect(screen.getByTestId("saves-page")).toBeInTheDocument());
    expect(screen.getByTestId("import-save-file-input")).toBeInTheDocument();
  });

  it("shows paste save textarea and import button", async () => {
    renderSavesPage();
    await waitFor(() => expect(screen.getByTestId("saves-page")).toBeInTheDocument());
    expect(screen.getByTestId("paste-save-textarea")).toBeInTheDocument();
    expect(screen.getByTestId("paste-save-button")).toBeInTheDocument();
  });

  it("disables the import button while the textarea is empty", async () => {
    renderSavesPage();
    await waitFor(() => expect(screen.getByTestId("paste-save-button")).toBeInTheDocument());
    expect(screen.getByTestId("paste-save-button")).toBeDisabled();
  });

  it("calls onLoadSave after successful paste import", async () => {
    const importedSave = makeSaveDoc({ ...pageDefaults, id: "pasted_save" });
    vi.mocked(SaveStore.importRxdbSave).mockResolvedValue(importedSave);
    const user = userEvent.setup();
    renderSavesPage();
    await waitFor(() => expect(screen.getByTestId("paste-save-textarea")).toBeInTheDocument());
    fireEvent.change(screen.getByTestId("paste-save-textarea"), {
      target: { value: '{"version":1,"header":{}}' },
    });
    await waitFor(() => expect(screen.getByTestId("paste-save-button")).not.toBeDisabled());
    await user.click(screen.getByTestId("paste-save-button"));
    await waitFor(() => expect(mockOnLoadSave).toHaveBeenCalledWith(importedSave));
  });

  it("shows import error when paste import fails", async () => {
    vi.mocked(SaveStore.importRxdbSave).mockRejectedValue(new Error("Invalid signature"));
    const user = userEvent.setup();
    renderSavesPage();
    await waitFor(() => expect(screen.getByTestId("paste-save-textarea")).toBeInTheDocument());
    fireEvent.change(screen.getByTestId("paste-save-textarea"), {
      target: { value: '{"version":1,"header":{}}' },
    });
    await waitFor(() => expect(screen.getByTestId("paste-save-button")).not.toBeDisabled());
    await user.click(screen.getByTestId("paste-save-button"));
    await waitFor(() => expect(screen.getByTestId("import-error")).toBeInTheDocument());
    expect(screen.getByText(/not a valid BlipIt Baseball Legends save file/i)).toBeInTheDocument();
  });

  it("Back to Home button navigates to /", async () => {
    renderSavesPage();
    await waitFor(() => expect(screen.getByTestId("saves-page-back-button")).toBeInTheDocument());
    const user = userEvent.setup();
    await user.click(screen.getByTestId("saves-page-back-button"));
    expect(screen.getByTestId("home-screen")).toBeInTheDocument();
  });

  it("shows import error when import fails", async () => {
    vi.mocked(SaveStore.importRxdbSave).mockRejectedValue(new Error("Invalid signature"));
    const user = userEvent.setup();
    renderSavesPage();
    await waitFor(() => expect(screen.getByTestId("saves-page")).toBeInTheDocument());

    const file = new File(['{"invalid": true}'], "save.json", { type: "application/json" });
    const input = screen.getByTestId("import-save-file-input");
    await user.upload(input, file);

    await waitFor(() => expect(screen.getByTestId("import-error")).toBeInTheDocument());
    expect(screen.getByText(/not a valid BlipIt Baseball Legends save file/i)).toBeInTheDocument();
  });

  it("calls onLoadSave after successful file import", async () => {
    const importedSave = makeSaveDoc({ ...pageDefaults, id: "imported_save" });
    vi.mocked(SaveStore.importRxdbSave).mockResolvedValue(importedSave);
    const user = userEvent.setup();
    renderSavesPage();
    await waitFor(() => expect(screen.getByTestId("saves-page")).toBeInTheDocument());

    const file = new File(['{"valid": true}'], "save.json", { type: "application/json" });
    const input = screen.getByTestId("import-save-file-input");
    await user.upload(input, file);

    await waitFor(() => expect(mockOnLoadSave).toHaveBeenCalledWith(importedSave));
  });

  it("calls exportRxdbSave when Export button is clicked", async () => {
    const save = makeSaveDoc({ ...pageDefaults });
    vi.mocked(SaveStore.listSaves).mockResolvedValue([save]);
    vi.mocked(SaveStore.exportRxdbSave).mockResolvedValue(JSON.stringify({ test: "data" }));
    const user = userEvent.setup();
    renderSavesPage();
    await waitFor(() => expect(screen.getByTestId("export-save-button")).toBeInTheDocument());
    await user.click(screen.getByTestId("export-save-button"));
    await waitFor(() => expect(SaveStore.exportRxdbSave).toHaveBeenCalledWith("save_1"));
    await waitFor(() =>
      expect(downloadJson).toHaveBeenCalledWith(
        JSON.stringify({ test: "data" }),
        expect.stringMatching(/^ballgame-team-a-vs-team-b-\d{8}T\d{6}\.json$/),
      ),
    );
  });
});
