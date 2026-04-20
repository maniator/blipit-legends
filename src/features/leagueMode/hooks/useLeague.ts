import * as React from "react";

import type { LeagueRecord } from "@feat/leagueMode/storage/types";

import { leagueStore } from "../storage/leagueStore";

export function useLeague(leagueId: string | null | undefined) {
  const [league, setLeague] = React.useState<LeagueRecord | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (!leagueId) {
      setLeague(null);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    leagueStore
      .getLeague(leagueId)
      .then((data) => {
        if (!cancelled) {
          setLeague(data);
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
  }, [leagueId]);

  return { league, isLoading, error };
}
