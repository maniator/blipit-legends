import * as React from "react";

import { appLog } from "@shared/utils/logger";
import { useParams } from "react-router";
import { RxDatabaseProvider, useLiveRxQuery } from "rxdb/plugins/react";

import type { BallgameDb } from "@storage/db";
import { getDb } from "@storage/db";
import type { SeasonRecord, SeasonTeamRecord } from "@storage/types";

export interface SeasonContextValue {
  season: SeasonRecord | null;
  seasonTeams: SeasonTeamRecord[];
  loading: boolean;
  error: string | null;
}

const SeasonContext = React.createContext<SeasonContextValue | null>(null);

const SeasonContextInner: React.FunctionComponent<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { seasonId } = useParams<{ seasonId: string }>();

  const seasonQuery = React.useMemo(() => ({ selector: { id: seasonId ?? "" } }), [seasonId]);

  const seasonTeamsQuery = React.useMemo(
    () => ({ selector: { seasonId: seasonId ?? "" } }),
    [seasonId],
  );

  const {
    results: seasonResults,
    loading: seasonLoading,
    error: seasonError,
  } = useLiveRxQuery<SeasonRecord>({
    collection: "seasons",
    query: seasonQuery,
  });

  const { results: teamResults, loading: teamsLoading } = useLiveRxQuery<SeasonTeamRecord>({
    collection: "seasonTeams",
    query: seasonTeamsQuery,
  });

  const season = React.useMemo(
    () => (seasonResults[0] ? (seasonResults[0].toJSON() as unknown as SeasonRecord) : null),
    [seasonResults],
  );

  const seasonTeams = React.useMemo(
    () => teamResults.map((d) => d.toJSON() as unknown as SeasonTeamRecord),
    [teamResults],
  );

  const value = React.useMemo<SeasonContextValue>(
    () => ({
      season,
      seasonTeams,
      loading: seasonLoading || teamsLoading,
      error: seasonError,
    }),
    [season, seasonTeams, seasonLoading, teamsLoading, seasonError],
  );

  return <SeasonContext.Provider value={value}>{children}</SeasonContext.Provider>;
};

export const SeasonContextProvider: React.FunctionComponent<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [db, setDb] = React.useState<BallgameDb | null>(null);

  React.useEffect(() => {
    getDb()
      .then(setDb)
      .catch((err: unknown) => appLog.error("[SeasonContext] DB init failed:", err));
  }, []);

  if (!db) return null;

  return (
    <RxDatabaseProvider
      database={db as unknown as Parameters<typeof RxDatabaseProvider>[0]["database"]}
    >
      <SeasonContextInner>{children}</SeasonContextInner>
    </RxDatabaseProvider>
  );
};

export const useSeasonContext = (): SeasonContextValue => {
  const ctx = React.useContext(SeasonContext);
  if (ctx === null) {
    throw new Error("useSeasonContext must be used within a SeasonContextProvider");
  }
  return ctx;
};
