import type { ExhibitionGameSetup } from "@storage/types";

import type { GameSessionContextValue } from "../context/GameSessionContext";

/**
 * Derives the session context value for an exhibition game setup.
 * Exhibition games always allow manager mode and always persist saves.
 */
export const deriveExhibitionSession = (setup: ExhibitionGameSetup): GameSessionContextValue => ({
  sessionType: "exhibition",
  managerModeAllowed: true,
  disableSave: false,
  seasonGameId: null,
  managedTeam: setup.managedTeam,
  sessionReady: true,
});

/**
 * Derives the session context value for a league season game.
 * League games disable saves and gate manager mode on whether a team is managed.
 */
export const deriveLeagueSession = (
  seasonGameId: string,
  managedTeamIdx: 0 | 1 | null,
): GameSessionContextValue => ({
  sessionType: "league",
  managerModeAllowed: managedTeamIdx !== null,
  disableSave: true,
  seasonGameId,
  managedTeam: managedTeamIdx,
  sessionReady: true,
});
