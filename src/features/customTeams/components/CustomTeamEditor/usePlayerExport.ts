import * as React from "react";

import { exportCustomPlayer } from "@feat/customTeams/storage/customTeamExportImport";

import { downloadJson, playerFilename } from "@storage/saveIO";

import { type EditorPlayer, editorPlayerToTeamPlayer } from "./editorState";

/**
 * Returns a stable callback that serialises an in-editor player to a signed
 * JSON bundle and triggers a browser download.
 */
export function usePlayerExport(): (p: EditorPlayer) => void {
  return React.useCallback((p: EditorPlayer) => {
    const teamPlayer = editorPlayerToTeamPlayer(p);
    const json = exportCustomPlayer(teamPlayer);
    downloadJson(json, playerFilename(teamPlayer.name || "player"));
  }, []);
}
