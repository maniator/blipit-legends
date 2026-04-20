import * as React from "react";

import type { LeagueSeasonRecord } from "@feat/leagueMode/storage/types";
import { simulateGameDay } from "@feat/leagueMode/utils/simulateGameDay";

export interface UseLeagueSimulationReturn {
  simulatingDay: boolean;
  simulateDayError: string | null;
  handleSimulateDay: () => Promise<void>;
}

export const useLeagueSimulation = (
  season: LeagueSeasonRecord | null | undefined,
  onSuccess: () => void,
): UseLeagueSimulationReturn => {
  const [simulatingDay, setSimulatingDay] = React.useState(false);
  const [simulateDayError, setSimulateDayError] = React.useState<string | null>(null);

  const handleSimulateDay = React.useCallback(async () => {
    if (!season) return;
    setSimulatingDay(true);
    setSimulateDayError(null);
    try {
      await simulateGameDay(season, season.currentGameDay);
      onSuccess();
    } catch (err: unknown) {
      setSimulateDayError(err instanceof Error ? err.message : String(err));
    } finally {
      setSimulatingDay(false);
    }
  }, [season, onSuccess]);

  return { simulatingDay, simulateDayError, handleSimulateDay };
};
