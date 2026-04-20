import * as React from "react";

import type { ScheduledGameRecord } from "@feat/leagueMode/storage/types";

import { scheduledGameStore } from "../storage/scheduledGameStore";

export function useScheduledGames(leagueSeasonId: string | null | undefined, refreshKey?: number) {
  const [games, setGames] = React.useState<ScheduledGameRecord[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (!leagueSeasonId) {
      setGames([]);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    scheduledGameStore
      .listGamesForSeason(leagueSeasonId)
      .then((data) => {
        if (!cancelled) {
          setGames(data);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [leagueSeasonId, refreshKey]);

  return { games, isLoading, error };
}
