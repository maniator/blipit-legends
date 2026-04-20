import * as React from "react";

import type { LeagueRecord, LeagueStatus } from "@feat/leagueMode/storage/types";

import { leagueStore } from "../storage/leagueStore";

export function useLeagues(status?: LeagueStatus) {
  const [leagues, setLeagues] = React.useState<LeagueRecord[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    leagueStore
      .listLeagues(status)
      .then((data) => {
        if (!cancelled) {
          setLeagues(data);
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
  }, [status]);

  return { leagues, isLoading, error };
}
