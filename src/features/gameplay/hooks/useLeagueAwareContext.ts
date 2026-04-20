import * as React from "react";

import type { LeagueGameContext } from "@storage/types";

export interface UseLeagueAwareContextReturn {
  loadedSaveLeagueId: string | null;
  setLoadedSaveLeagueId: (id: string | null) => void;
  backToLeagueId: string | null;
  isLeagueSave: boolean;
}

export const useLeagueAwareContext = (
  leagueGameContext: LeagueGameContext | null | undefined,
): UseLeagueAwareContextReturn => {
  const [loadedSaveLeagueId, setLoadedSaveLeagueId] = React.useState<string | null>(null);
  const backToLeagueId = leagueGameContext?.leagueId ?? loadedSaveLeagueId;
  const isLeagueSave = !!loadedSaveLeagueId;

  return { loadedSaveLeagueId, setLoadedSaveLeagueId, backToLeagueId, isLeagueSave };
};
