import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock readFileAsText from saveIO
vi.mock("@storage/saveIO", () => ({
  readFileAsText: vi.fn(),
  downloadJson: vi.fn(),
  saveFilename: vi.fn((name: string) => `${name}.json`),
  formatSaveDate: vi.fn(() => "Jan 1, 2025"),
}));

import { readFileAsText } from "@storage/saveIO";
import type { SaveDoc } from "@storage/types";
import { makeSaveDoc } from "@test/helpers/saves";

import { friendlyImportError, useImportSave } from "./useImportSave";

describe("friendlyImportError", () => {
  it("returns signature message for error containing 'signature'", () => {
    expect(friendlyImportError("Invalid signature")).toMatch(
      /not a valid BlipIt Baseball Legends save file/i,
    );
  });
  it("returns signature message for error containing 'corrupt'", () => {
    expect(friendlyImportError("File is corrupt")).toMatch(
      /not a valid BlipIt Baseball Legends save file/i,
    );
  });
  it("returns generic message for other errors", () => {
    expect(friendlyImportError("Network timeout")).toMatch(/Import failed/i);
  });
  it("passes through 'Cannot import save:' errors as-is", () => {
    const raw =
      'Cannot import save: missing custom team(s): "My Team" (ct_abc). Import the missing team(s) first.';
    expect(friendlyImportError(raw)).toBe(raw);
  });
});

describe("useImportSave", () => {
  const mockImportFn = vi.fn<(json: string) => Promise<SaveDoc>>();
  const mockOnSuccess = vi.fn<(save: SaveDoc) => void>();

  const renderImportHook = (overrides: Partial<Parameters<typeof useImportSave>[0]> = {}) =>
    renderHook(() =>
      useImportSave({
        importFn: mockImportFn,
        onSuccess: mockOnSuccess,
        ...overrides,
      }),
    );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes initial state", () => {
    const { result } = renderImportHook();
    expect(result.current.pasteJson).toBe("");
    expect(result.current.importError).toBeNull();
    expect(result.current.importing).toBe(false);
  });

  it("setPasteJson updates the textarea value", () => {
    const { result } = renderImportHook();
    act(() => result.current.setPasteJson('{"foo":"bar"}'));
    expect(result.current.pasteJson).toBe('{"foo":"bar"}');
  });

  describe("handlePasteImport", () => {
    it("sets importError when textarea is empty", () => {
      const { result } = renderImportHook();
      act(() => result.current.handlePasteImport());
      expect(result.current.importError).toMatch(/paste save json before importing/i);
      expect(mockImportFn).not.toHaveBeenCalled();
    });

    it("calls importFn with trimmed textarea value", async () => {
      mockImportFn.mockResolvedValue(makeSaveDoc());
      const { result } = renderImportHook();
      act(() => result.current.setPasteJson('  {"v":1}  '));
      act(() => result.current.handlePasteImport());
      await waitFor(() => expect(mockImportFn).toHaveBeenCalledWith('{"v":1}'));
    });

    it("sets importing=true while in-flight", async () => {
      let resolve!: (s: SaveDoc) => void;
      mockImportFn.mockReturnValue(new Promise((r) => (resolve = r)));
      const { result } = renderImportHook();
      act(() => result.current.setPasteJson('{"v":1}'));
      act(() => result.current.handlePasteImport());
      expect(result.current.importing).toBe(true);
      await act(async () => resolve(makeSaveDoc()));
    });

    it("calls onSuccess and resets importing after successful import", async () => {
      const save = makeSaveDoc();
      mockImportFn.mockResolvedValue(save);
      const { result } = renderImportHook();
      act(() => result.current.setPasteJson('{"v":1}'));
      act(() => result.current.handlePasteImport());
      await waitFor(() => expect(result.current.importing).toBe(false));
      expect(mockOnSuccess).toHaveBeenCalledWith(save);
      expect(result.current.pasteJson).toBe("");
    });

    it("resets importing and sets error on failure", async () => {
      mockImportFn.mockRejectedValue(new Error("invalid signature"));
      const { result } = renderImportHook();
      act(() => result.current.setPasteJson('{"v":1}'));
      act(() => result.current.handlePasteImport());
      await waitFor(() => expect(result.current.importing).toBe(false));
      expect(result.current.importError).toMatch(/not a valid BlipIt Baseball Legends save file/i);
      expect(mockOnSuccess).not.toHaveBeenCalled();
    });

    it("uses custom formatError when provided", async () => {
      mockImportFn.mockRejectedValue(new Error("Unexpected token"));
      const formatError = (raw: string) => raw; // pass-through
      const { result } = renderImportHook({ formatError });
      act(() => result.current.setPasteJson('{"v":1}'));
      act(() => result.current.handlePasteImport());
      await waitFor(() => expect(result.current.importError).toBe("Unexpected token"));
    });
  });

  describe("handleFileImport", () => {
    it("reads file and calls importFn on success", async () => {
      vi.mocked(readFileAsText).mockResolvedValue('{"file":true}');
      const save = makeSaveDoc({ id: "file_save" });
      mockImportFn.mockResolvedValue(save);
      const { result } = renderImportHook();
      const file = new File(["{}"], "save.json", { type: "application/json" });
      const event = {
        target: { files: [file], value: "" },
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      act(() => result.current.handleFileImport(event));
      await waitFor(() => expect(mockOnSuccess).toHaveBeenCalledWith(save));
      expect(mockImportFn).toHaveBeenCalledWith('{"file":true}');
    });

    it("sets 'Failed to read file' error when readFileAsText rejects", async () => {
      vi.mocked(readFileAsText).mockRejectedValue(new Error("Read error"));
      const { result } = renderImportHook();
      const file = new File(["{}"], "save.json");
      const event = {
        target: { files: [file], value: "" },
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      act(() => result.current.handleFileImport(event));
      await waitFor(() => expect(result.current.importError).toMatch(/failed to read file/i));
    });

    it("does nothing when no file is selected", () => {
      const { result } = renderImportHook();
      const event = {
        target: { files: [], value: "" },
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      act(() => result.current.handleFileImport(event));
      expect(mockImportFn).not.toHaveBeenCalled();
    });
  });

  describe("handlePasteFromClipboard", () => {
    it("reads clipboard and updates pasteJson", async () => {
      Object.assign(navigator, {
        clipboard: { readText: vi.fn().mockResolvedValue('{"clipboard":true}') },
      });
      const { result } = renderImportHook();
      await act(async () => result.current.handlePasteFromClipboard());
      expect(result.current.pasteJson).toBe('{"clipboard":true}');
    });

    it("sets error when clipboard read fails", async () => {
      Object.assign(navigator, {
        clipboard: { readText: vi.fn().mockRejectedValue(new Error("Permission denied")) },
      });
      const { result } = renderImportHook();
      await act(async () => result.current.handlePasteFromClipboard());
      expect(result.current.importError).toMatch(/could not read clipboard/i);
    });
  });
});
