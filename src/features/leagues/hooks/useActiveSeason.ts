import * as React from "react";

import { useLiveRxQuery } from "rxdb/plugins/react";

import type { SeasonRecord } from "@storage/types";

const ACTIVE_SEASON_QUERY = { selector: { status: "active" as const } };

export interface ActiveSeasonHook {
  activeSeason: SeasonRecord | null;
  loading: boolean;
}

/**
 * Reactively returns the currently active season (status === "active"), if any.
 *
 * Requires `<RxDatabaseProvider>` to be present in the component tree.
 */
export const useActiveSeason = (): ActiveSeasonHook => {
  const { results, loading } = useLiveRxQuery<SeasonRecord>({
    collection: "seasons",
    query: ACTIVE_SEASON_QUERY,
  });

  const activeSeason = React.useMemo(
    () => (results[0] ? (results[0].toJSON() as unknown as SeasonRecord) : null),
    [results],
  );

  return { activeSeason, loading };
};
