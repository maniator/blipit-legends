import * as React from "react";

import type { LeagueSeasonRecord } from "@feat/leagueMode/storage/types";

import { leagueSeasonStore } from "../storage/leagueSeasonStore";

export function useLeagueSeason(leagueSeasonId: string | null | undefined) {
  const [season, setSeason] = React.useState<LeagueSeasonRecord | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (!leagueSeasonId) {
      setSeason(null);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    leagueSeasonStore
      .getLeagueSeason(leagueSeasonId)
      .then((data) => {
        if (!cancelled) {
          setSeason(data);
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
  }, [leagueSeasonId]);

  return { season, isLoading, error };
}
