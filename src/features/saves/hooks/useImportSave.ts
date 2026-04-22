import * as React from "react";

import { readFileAsText } from "@storage/saveIO";
import type { SaveRecord } from "@storage/types";

const SIGNATURE_RE = /signature|invalid|corrupt/i;
/** Errors that are already descriptive and should be shown as-is. */
const PASS_THROUGH_RE = /^Cannot import save:/i;

/** Default user-friendly error formatter used by SavesPage. */
export const friendlyImportError = (raw: string): string => {
  if (PASS_THROUGH_RE.test(raw)) return raw;
  return SIGNATURE_RE.test(raw)
    ? "The file you selected is not a valid BlipIt Baseball Legends save file."
    : "Import failed. Please check the file and try again.";
};

/** Result of the cheap client-side enablement parse. */
export type ImportParseState = "empty" | "valid" | "invalid-json" | "wrong-shape";

/**
 * Helper-text microcopy keyed on parse state. Surfaces should render the
 * appropriate string in a `role="status"` node so screen-reader users hear
 * the reason the import CTA is disabled.
 */
export const IMPORT_HELPER_NEUTRAL = "Paste exported saves JSON to enable import.";
export const IMPORT_HELPER_INVALID_JSON =
  "That doesn't look like valid saves JSON. Check the brackets and try again.";
export const IMPORT_HELPER_WRONG_SHAPE = "JSON parsed, but it isn't a saves export.";

/**
 * Cheap, client-side shape pre-check for the export envelope. We only need
 * enough confidence to *enable* the CTA — full signature/version validation
 * still runs server-side on click. Lenient on purpose: any object with a
 * `version` plus a `header`/`saves` collection is treated as an export.
 */
export const computeImportParseState = (text: string): ImportParseState => {
  const trimmed = text.trim();
  if (!trimmed) return "empty";
  // Cheap pre-check: avoid running JSON.parse on obvious garbage. Save
  // exports are JSON objects (or, leniently, arrays for bundles).
  const first = trimmed[0];
  if (first !== "{" && first !== "[") return "invalid-json";
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return "invalid-json";
  }
  if (!parsed || typeof parsed !== "object") return "wrong-shape";
  // Be lenient — the modal/page only need to know whether *enabling* the
  // CTA is reasonable. Server-side import does the strict validation.
  const obj = parsed as Record<string, unknown>;
  if ("version" in obj && ("header" in obj || "saves" in obj)) return "valid";
  return "wrong-shape";
};

interface UseImportSaveOptions {
  /** Called to perform the actual import; receives raw JSON string. */
  importFn: (json: string) => Promise<SaveRecord>;
  /** Called with the imported SaveRecord on success. */
  onSuccess: (save: SaveRecord) => void;
  /**
   * Optional error message formatter.
   * Defaults to {@link friendlyImportError} (user-facing friendly messages).
   * Pass `(raw) => raw` to preserve the original error message (e.g. in SavesModal).
   */
  formatError?: (raw: string) => string;
}

export interface UseImportSaveReturn {
  /** Current value of the paste-JSON textarea. */
  pasteJson: string;
  setPasteJson: (v: string) => void;
  /** Non-null when the last import attempt failed. */
  importError: string | null;
  /**
   * True while an import is in-flight.
   * Use to disable import buttons and prevent accidental duplicate submissions.
   */
  importing: boolean;
  /** Handle a file-input change event — reads the selected file and imports it. */
  handleFileImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Validate the paste textarea and trigger an import. */
  handlePasteImport: () => void;
  /** Read text from the system clipboard and put it in the textarea. */
  handlePasteFromClipboard: () => Promise<void>;
  /**
   * Result of the cheap envelope-shape pre-check, debounced 150 ms after the
   * last keystroke (or applied immediately on paste/blur). Drives the import
   * CTA's enabled state and the helper-text microcopy.
   */
  parseState: ImportParseState;
  /**
   * True after the user has blurred the textarea OR pasted into it. Surfaces
   * gate the visible "invalid" affordance (red border, error helper text)
   * behind this flag so we don't yell at the user mid-typing.
   */
  showValidity: boolean;
  /** Surfaces should call this from the textarea's onBlur. */
  markBlurred: () => void;
  /**
   * Surfaces should call this from the textarea's onPaste. Promotes the
   * next setPasteJson() call to bypass the typing debounce so paste feels
   * instant and reveals validity immediately.
   */
  notePaste: () => void;
  /** True when the parsed envelope passed the cheap shape check and no import is in-flight. */
  canImport: boolean;
  /** Microcopy for the always-present helper status node. */
  helperText: string;
  /** "neutral" or "error" — drives helper-text color. */
  helperTone: "neutral" | "error";
  /** Live-region announcement after a successful import (e.g. "Imported 1 saves"). */
  importAnnouncement: string | null;
}

/**
 * Shared import logic used by both SavesPage (full-page) and SavesModal (in-game dialog).
 *
 * Handles paste-JSON input, file upload, clipboard paste, in-flight loading state,
 * and error formatting. The caller supplies the actual import function and a success
 * callback so each consumer can react appropriately (navigate vs close dialog).
 */
export const useImportSave = ({
  importFn,
  onSuccess,
  formatError = friendlyImportError,
}: UseImportSaveOptions): UseImportSaveReturn => {
  const [pasteJson, setPasteJsonRaw] = React.useState("");
  const [importError, setImportError] = React.useState<string | null>(null);
  const [importing, setImporting] = React.useState(false);
  const [parseState, setParseState] = React.useState<ImportParseState>("empty");
  const [showValidity, setShowValidity] = React.useState(false);
  const [importAnnouncement, setImportAnnouncement] = React.useState<string | null>(null);

  // Debounce + paste-immediate plumbing for the enablement parse. We schedule
  // a 150 ms validation pass after each keystroke so we don't run JSON.parse
  // on every character; on paste/blur we flush synchronously so the user
  // sees immediate feedback after a deliberate action.
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pasteImmediateRef = React.useRef(false);

  const cancelPending = React.useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, []);

  React.useEffect(() => () => cancelPending(), [cancelPending]);

  const setPasteJson = React.useCallback(
    (v: string) => {
      setPasteJsonRaw(v);
      cancelPending();
      // Empty input always resolves to neutral immediately so the helper
      // text doesn't lag while the user clears the field.
      if (!v.trim()) {
        setParseState("empty");
        return;
      }
      if (pasteImmediateRef.current) {
        pasteImmediateRef.current = false;
        setParseState(computeImportParseState(v));
        return;
      }
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        setParseState(computeImportParseState(v));
      }, 150);
    },
    [cancelPending],
  );

  const markBlurred = React.useCallback(() => {
    setShowValidity(true);
    // Flush any pending debounced parse so blur reveals the verdict instantly.
    if (debounceRef.current) {
      cancelPending();
      setParseState(computeImportParseState(pasteJson));
    }
  }, [cancelPending, pasteJson]);

  const notePaste = React.useCallback(() => {
    setShowValidity(true);
    pasteImmediateRef.current = true;
  }, []);

  const applyImport = (json: string) => {
    setImportError(null);
    setImportAnnouncement(null);
    setImporting(true);
    importFn(json)
      .then((importedSave) => {
        cancelPending();
        setPasteJsonRaw("");
        setParseState("empty");
        setShowValidity(false);
        setImporting(false);
        // Spec calls for `Imported {N} saves`. Single-record import → N=1.
        setImportAnnouncement("Imported 1 saves");
        onSuccess(importedSave);
      })
      .catch((err: unknown) => {
        setImporting(false);
        const raw = err instanceof Error ? err.message : String(err);
        setImportError(formatError(raw));
      });
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    readFileAsText(file)
      .then(applyImport)
      .catch(() => setImportError("Failed to read file"));
    e.target.value = "";
  };

  const handlePasteImport = () => {
    const trimmed = pasteJson.trim();
    if (!trimmed) {
      setImportError("Please paste save JSON before importing.");
      return;
    }
    applyImport(trimmed);
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      // Treat clipboard-paste like a textarea paste: bypass debounce and
      // surface validity immediately. Order matters: notePaste() must set
      // the immediate flag *before* setPasteJson() reads it.
      notePaste();
      setPasteJson(text);
    } catch {
      setImportError("Could not read clipboard. Please paste manually.");
    }
  };

  const canImport = parseState === "valid" && !importing;

  const isInvalidVisible =
    showValidity && (parseState === "invalid-json" || parseState === "wrong-shape");

  const helperText = isInvalidVisible
    ? parseState === "invalid-json"
      ? IMPORT_HELPER_INVALID_JSON
      : IMPORT_HELPER_WRONG_SHAPE
    : IMPORT_HELPER_NEUTRAL;

  const helperTone: "neutral" | "error" = isInvalidVisible ? "error" : "neutral";

  return {
    pasteJson,
    setPasteJson,
    importError,
    importing,
    handleFileImport,
    handlePasteImport,
    handlePasteFromClipboard,
    parseState,
    showValidity,
    markBlurred,
    notePaste,
    canImport,
    helperText,
    helperTone,
    importAnnouncement,
  };
};
