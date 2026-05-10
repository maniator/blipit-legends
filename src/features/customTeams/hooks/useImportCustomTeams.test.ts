import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@storage/saveIO", () => ({
  readFileAsText: vi.fn(),
  downloadJson: vi.fn(),
  saveFilename: vi.fn((name: string) => `${name}.json`),
  teamsFilename: vi.fn(() => "ballgame-teams-test.json"),
  formatSaveDate: vi.fn(() => "Jan 1, 2025"),
}));

import type {
  ImportCustomTeamsOptions,
  ImportCustomTeamsResult,
} from "@feat/customTeams/storage/customTeamExportImport";

import { readFileAsText } from "@storage/saveIO";

import { useImportCustomTeams } from "./useImportCustomTeams";

const makeResult = (overrides: Partial<ImportCustomTeamsResult> = {}): ImportCustomTeamsResult => ({
  teams: [],
  created: 1,
  remapped: 0,
  skipped: 0,
  duplicateWarnings: [],
  duplicatePlayerWarnings: [],
  requiresDuplicateConfirmation: false,
  ...overrides,
});

describe("useImportCustomTeams", () => {
  const mockImportFn =
    vi.fn<(json: string, options?: ImportCustomTeamsOptions) => Promise<ImportCustomTeamsResult>>();
  const mockOnSuccess = vi.fn<(result: ImportCustomTeamsResult) => void>();

  const renderHookUnderTest = () =>
    renderHook(() => useImportCustomTeams({ importFn: mockImportFn, onSuccess: mockOnSuccess }));

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes initial state", () => {
    const { result } = renderHookUnderTest();
    expect(result.current.pasteJson).toBe("");
    expect(result.current.importError).toBeNull();
    expect(result.current.importing).toBe(false);
  });

  it("setPasteJson updates the textarea value", () => {
    const { result } = renderHookUnderTest();
    act(() => result.current.setPasteJson('{"type":"customTeams"}'));
    expect(result.current.pasteJson).toBe('{"type":"customTeams"}');
  });

  describe("handlePasteImport", () => {
    it("sets importError when textarea is empty", () => {
      const { result } = renderHookUnderTest();
      act(() => result.current.handlePasteImport());
      expect(result.current.importError).toMatch(/paste team json before importing/i);
      expect(mockImportFn).not.toHaveBeenCalled();
    });

    it("calls importFn with trimmed textarea value", async () => {
      mockImportFn.mockResolvedValue(makeResult());
      const { result } = renderHookUnderTest();
      act(() => result.current.setPasteJson('  {"type":"customTeams"}  '));
      act(() => result.current.handlePasteImport());
      await waitFor(() =>
        expect(mockImportFn).toHaveBeenCalledWith('{"type":"customTeams"}', undefined),
      );
    });

    it("sets importing=true while in-flight", async () => {
      let resolve!: (r: ImportCustomTeamsResult) => void;
      mockImportFn.mockReturnValue(new Promise((r) => (resolve = r)));
      const { result } = renderHookUnderTest();
      act(() => result.current.setPasteJson('{"v":1}'));
      act(() => result.current.handlePasteImport());
      expect(result.current.importing).toBe(true);
      await act(async () => resolve(makeResult()));
    });

    it("calls onSuccess and clears paste after successful import", async () => {
      const res = makeResult();
      mockImportFn.mockResolvedValue(res);
      const { result } = renderHookUnderTest();
      act(() => result.current.setPasteJson('{"v":1}'));
      act(() => result.current.handlePasteImport());
      await waitFor(() => expect(result.current.importing).toBe(false));
      expect(mockOnSuccess).toHaveBeenCalledWith(res);
      expect(result.current.pasteJson).toBe("");
    });

    it("sets importError on failure", async () => {
      mockImportFn.mockRejectedValue(new Error("Invalid JSON: could not parse custom teams file"));
      const { result } = renderHookUnderTest();
      act(() => result.current.setPasteJson("bad json"));
      act(() => result.current.handlePasteImport());
      await waitFor(() => expect(result.current.importing).toBe(false));
      expect(result.current.importError).toMatch(/Invalid JSON/i);
      expect(mockOnSuccess).not.toHaveBeenCalled();
    });
  });

  describe("handleFileImport", () => {
    it("reads file and calls importFn on success", async () => {
      vi.mocked(readFileAsText).mockResolvedValue('{"type":"customTeams"}');
      const res = makeResult();
      mockImportFn.mockResolvedValue(res);
      const { result } = renderHookUnderTest();
      const file = new File(['{"type":"customTeams"}'], "teams.json", { type: "application/json" });
      const event = {
        target: { files: [file], value: "" },
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      act(() => result.current.handleFileImport(event));
      await waitFor(() => expect(mockOnSuccess).toHaveBeenCalledWith(res));
    });

    it("sets 'Failed to read file' when readFileAsText rejects", async () => {
      vi.mocked(readFileAsText).mockRejectedValue(new Error("disk error"));
      const { result } = renderHookUnderTest();
      const file = new File(["{}"], "teams.json");
      const event = {
        target: { files: [file], value: "" },
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      act(() => result.current.handleFileImport(event));
      await waitFor(() => expect(result.current.importError).toMatch(/failed to read file/i));
    });

    it("does nothing when no file is selected", () => {
      const { result } = renderHookUnderTest();
      const event = {
        target: { files: [], value: "" },
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      act(() => result.current.handleFileImport(event));
      expect(mockImportFn).not.toHaveBeenCalled();
    });
  });

  describe("handlePasteFromClipboard", () => {
    it("reads clipboard and updates pasteJson", async () => {
      Object.defineProperty(navigator, "clipboard", {
        value: { readText: vi.fn().mockResolvedValue('{"type":"customTeams"}') },
        configurable: true,
        writable: true,
      });
      const { result } = renderHookUnderTest();
      await act(async () => result.current.handlePasteFromClipboard());
      expect(result.current.pasteJson).toBe('{"type":"customTeams"}');
    });

    it("sets error when clipboard read fails", async () => {
      Object.defineProperty(navigator, "clipboard", {
        value: { readText: vi.fn().mockRejectedValue(new Error("Permission denied")) },
        configurable: true,
        writable: true,
      });
      const { result } = renderHookUnderTest();
      await act(async () => result.current.handlePasteFromClipboard());
      expect(result.current.importError).toMatch(/could not read clipboard/i);
    });
  });

  describe("duplicate player confirmation flow", () => {
    it("sets pendingDuplicateImport when importFn returns requiresDuplicateConfirmation", async () => {
      const blockedResult = makeResult({
        created: 0,
        teams: [],
        duplicatePlayerWarnings: ['Player "Alice" in "Team B" may already exist.'],
        requiresDuplicateConfirmation: true,
      });
      mockImportFn.mockResolvedValue(blockedResult);
      const { result } = renderHookUnderTest();
      act(() => result.current.setPasteJson('{"v":1}'));
      act(() => result.current.handlePasteImport());
      await waitFor(() => expect(result.current.pendingDuplicateImport).not.toBeNull());
      expect(result.current.pendingDuplicateImport?.warnings).toHaveLength(1);
      expect(mockOnSuccess).not.toHaveBeenCalled();
    });

    it("confirmDuplicateImport re-calls importFn with allowDuplicatePlayers:true", async () => {
      const blockedResult = makeResult({
        created: 0,
        teams: [],
        duplicatePlayerWarnings: ["Player dup"],
        requiresDuplicateConfirmation: true,
      });
      const successResult = makeResult();
      mockImportFn.mockResolvedValueOnce(blockedResult).mockResolvedValueOnce(successResult);

      const { result } = renderHookUnderTest();
      act(() => result.current.setPasteJson('{"v":1}'));
      act(() => result.current.handlePasteImport());
      await waitFor(() => expect(result.current.pendingDuplicateImport).not.toBeNull());

      act(() => result.current.confirmDuplicateImport());
      await waitFor(() => expect(mockOnSuccess).toHaveBeenCalledWith(successResult));
      expect(mockImportFn).toHaveBeenCalledWith('{"v":1}', { allowDuplicatePlayers: true });
      expect(result.current.pendingDuplicateImport).toBeNull();
    });

    it("cancelDuplicateImport clears the pending state without importing", async () => {
      const blockedResult = makeResult({
        created: 0,
        teams: [],
        duplicatePlayerWarnings: ["dup"],
        requiresDuplicateConfirmation: true,
      });
      mockImportFn.mockResolvedValue(blockedResult);
      const { result } = renderHookUnderTest();
      act(() => result.current.setPasteJson('{"v":1}'));
      act(() => result.current.handlePasteImport());
      await waitFor(() => expect(result.current.pendingDuplicateImport).not.toBeNull());
      act(() => result.current.cancelDuplicateImport());
      expect(result.current.pendingDuplicateImport).toBeNull();
      expect(mockOnSuccess).not.toHaveBeenCalled();
    });
  });
});
