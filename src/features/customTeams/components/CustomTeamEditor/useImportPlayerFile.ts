import * as React from "react";

import {
  buildPlayerSig,
  parseExportedCustomPlayer,
} from "@feat/customTeams/storage/customTeamExportImport";
import {
  DEFAULT_BATTING_STAMINA,
  DEFAULT_PITCHING_STAMINA,
} from "@feat/customTeams/storage/customTeamSanitizers";
import { CustomTeamStore } from "@feat/customTeams/storage/customTeamStore";

import type { TeamPlayer, TeamWithRoster } from "@storage/types";

import type { EditorAction, EditorPlayer } from "./editorState";
import { makePlayerId } from "./editorState";

export type PendingPlayerImport = {
  player: EditorPlayer;
  section: "lineup" | "bench" | "pitchers";
  warning: string;
  /** Called when the user clicks "Import Anyway". Handles persistence (edit) or state (create). */
  onConfirm: () => void | Promise<void>;
};

type Options = {
  teamId: string | undefined;
  allTeams: TeamWithRoster[];
  lineup: EditorPlayer[];
  bench: EditorPlayer[];
  pitchers: EditorPlayer[];
  dispatch: React.Dispatch<EditorAction>;
  setPendingPlayerImport: React.Dispatch<React.SetStateAction<PendingPlayerImport | null>>;
};

/**
 * Returns a curried file-change handler for importing signed player JSON bundles.
 * Call with `"lineup"`, `"bench"`, or `"pitchers"` to get the concrete `onChange`
 * handler for that section's hidden file input.
 *
 * Edit mode (teamId set): delegates to `CustomTeamStore.importPlayer` for the hard
 *   conflict check and DB persistence.
 * Create mode (no teamId): uses the in-memory allTeams list for the fingerprint
 *   check and dispatches ADD_PLAYER to editor state only.
 *
 * Duplicate detection is fingerprint-based only.
 */
export function useImportPlayerFile({
  teamId,
  allTeams,
  lineup,
  bench,
  pitchers,
  dispatch,
  setPendingPlayerImport,
}: Options): (
  section: "lineup" | "bench" | "pitchers",
) => (e: React.ChangeEvent<HTMLInputElement>) => void {
  return React.useCallback(
    (section: "lineup" | "bench" | "pitchers") => (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const playerJson = reader.result as string;
          const importedPlayer = parseExportedCustomPlayer(playerJson);

          // Reject mismatched role → section imports early with a clear error.
          const expectedRole: "batter" | "pitcher" = section === "pitchers" ? "pitcher" : "batter";
          if (importedPlayer.role !== expectedRole) {
            const sectionLabel = section === "pitchers" ? "Pitchers" : "Lineup/Bench";
            dispatch({
              type: "SET_ERROR",
              error: `"${importedPlayer.name}" is a ${importedPlayer.role} and cannot be imported into the ${sectionLabel} section.`,
            });
            return;
          }

          // Remap the ID to avoid local roster collisions.
          const editorPlayer: EditorPlayer =
            expectedRole === "pitcher"
              ? {
                  id: makePlayerId(),
                  name: importedPlayer.name,
                  role: "pitcher",
                  position: importedPlayer.position ?? "",
                  handedness: importedPlayer.handedness ?? "R",
                  velocity: importedPlayer.pitching?.velocity ?? 60,
                  control: importedPlayer.pitching?.control ?? 60,
                  movement: importedPlayer.pitching?.movement ?? 60,
                  stamina: importedPlayer.pitching?.stamina,
                  ...(importedPlayer.pitchingRole && { pitchingRole: importedPlayer.pitchingRole }),
                }
              : {
                  id: makePlayerId(),
                  name: importedPlayer.name,
                  role: "batter",
                  position: importedPlayer.position ?? "",
                  handedness: importedPlayer.handedness ?? "R",
                  contact: importedPlayer.batting?.contact ?? 40,
                  power: importedPlayer.batting?.power ?? 40,
                  speed: importedPlayer.batting?.speed ?? 40,
                  stamina: importedPlayer.batting?.stamina,
                };

          /**
           * Core import action — called immediately (globalPlayerId present) or
           * after the user confirms a fingerprint-based soft-duplicate warning.
           */
          const performImport = async () => {
            if (teamId) {
              // Edit mode: store API handles hard block + DB persistence.
              const result = await CustomTeamStore.importPlayer(teamId, playerJson, section);
              if (result.status === "conflict") {
                dispatch({
                  type: "SET_ERROR",
                  error: `"${importedPlayer.name}" already belongs to team "${result.conflictingTeamName}". Import cancelled. Remove that player from their current team before importing here.`,
                });
                return;
              }
              if (result.status === "alreadyOnThisTeam") {
                dispatch({
                  type: "SET_ERROR",
                  error: `"${importedPlayer.name}" is already on this team.`,
                });
                return;
              }
              // Store persisted the player; mirror to editor state for immediate UI update.
              // Use finalLocalId (the id the store chose, which may differ from editorPlayer.id
              // if a local id collision was remapped) to keep editor state aligned with the DB.
              const alignedPlayer =
                result.finalLocalId === editorPlayer.id
                  ? editorPlayer
                  : { ...editorPlayer, id: result.finalLocalId };
              dispatch({ type: "ADD_PLAYER", section, player: alignedPlayer });
            } else {
              // Create mode: manual cross-team check using stable player id.
              const owningTeam = allTeams.find((t: TeamWithRoster) =>
                [...t.roster.lineup, ...(t.roster.bench ?? []), ...t.roster.pitchers].some(
                  (p: TeamPlayer) => p.id === importedPlayer.id,
                ),
              );
              if (owningTeam) {
                dispatch({
                  type: "SET_ERROR",
                  error: `"${importedPlayer.name}" already belongs to team "${owningTeam.name}". Import cancelled. Remove that player from their current team before importing here.`,
                });
                return;
              }
              dispatch({ type: "ADD_PLAYER", section, player: editorPlayer });
            }
          };

          // Soft fingerprint duplicate check.
          // Build the sig from the same normalized stats used for the editorPlayer.
          const sectionRole: "batter" | "pitcher" = section === "pitchers" ? "pitcher" : "batter";
          const incomingFp =
            sectionRole === "pitcher"
              ? buildPlayerSig({
                  name: importedPlayer.name,
                  role: "pitcher",
                  pitching: {
                    velocity: importedPlayer.pitching?.velocity ?? 60,
                    control: importedPlayer.pitching?.control ?? 60,
                    movement: importedPlayer.pitching?.movement ?? 60,
                    stamina: importedPlayer.pitching?.stamina ?? DEFAULT_PITCHING_STAMINA,
                  },
                })
              : buildPlayerSig({
                  name: importedPlayer.name,
                  role: "batter",
                  batting: {
                    contact: importedPlayer.batting?.contact ?? 40,
                    power: importedPlayer.batting?.power ?? 40,
                    speed: importedPlayer.batting?.speed ?? 40,
                    stamina: importedPlayer.batting?.stamina ?? DEFAULT_BATTING_STAMINA,
                  },
                });

          const editorPlayerFp = (p: EditorPlayer): string => {
            if (p.role === "pitcher") {
              return buildPlayerSig({
                name: p.name,
                role: "pitcher",
                pitching: {
                  velocity: p.velocity ?? 60,
                  control: p.control ?? 60,
                  movement: p.movement ?? 60,
                  stamina: p.stamina ?? DEFAULT_PITCHING_STAMINA,
                },
              });
            }
            return buildPlayerSig({
              name: p.name,
              role: "batter",
              batting: {
                contact: p.contact,
                power: p.power,
                speed: p.speed,
                stamina: p.stamina ?? DEFAULT_BATTING_STAMINA,
              },
            });
          };

          const existingTeamWithPlayer = allTeams.find((t: TeamWithRoster) =>
            [...t.roster.lineup, ...(t.roster.bench ?? []), ...t.roster.pitchers].some(
              (p: TeamPlayer) => (p.fingerprint ?? buildPlayerSig(p)) === incomingFp,
            ),
          );
          const duplicateTeamName =
            existingTeamWithPlayer?.name ??
            ([...lineup, ...bench, ...pitchers].some((p) => editorPlayerFp(p) === incomingFp)
              ? "this team"
              : null);

          if (duplicateTeamName !== null) {
            setPendingPlayerImport({
              player: editorPlayer,
              section,
              warning: `"${importedPlayer.name}" may already exist on team "${duplicateTeamName}". Import anyway?`,
              onConfirm: performImport,
            });
          } else {
            performImport().catch((error: unknown) => {
              dispatch({
                type: "SET_ERROR",
                error:
                  error instanceof Error
                    ? `Import failed: ${error.message}`
                    : "Import failed due to an unexpected error.",
              });
            });
          }
        } catch (err) {
          dispatch({
            type: "SET_ERROR",
            error: `Failed to import player: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      };
      reader.onerror = () => {
        dispatch({
          type: "SET_ERROR",
          error: "Failed to read player file. Please try again with a valid JSON export.",
        });
      };
      reader.readAsText(file);
    },
    [teamId, allTeams, lineup, bench, pitchers, dispatch, setPendingPlayerImport],
  );
}
