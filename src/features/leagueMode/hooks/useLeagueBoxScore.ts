import * as React from "react";

import { getDb } from "@storage/db";
import type { SaveRecord } from "@storage/types";

export interface UseLeagueBoxScoreReturn {
  isExpanded: (gameId: string) => boolean;
  toggleBoxScore: (
    gameId: string,
    completedGameId: string | null | undefined,
    hasInlineData: boolean,
  ) => void;
  getBoxScore: (gameId: string) => SaveRecord | null | undefined;
}

export const useLeagueBoxScore = (): UseLeagueBoxScoreReturn => {
  const [expandedBoxScores, setExpandedBoxScores] = React.useState<Set<string>>(new Set());
  const [loadedBoxScores, setLoadedBoxScores] = React.useState<Map<string, SaveRecord | null>>(
    new Map(),
  );

  const isExpanded = React.useCallback(
    (gameId: string) => expandedBoxScores.has(gameId),
    [expandedBoxScores],
  );

  const toggleBoxScore = React.useCallback(
    (gameId: string, completedGameId: string | null | undefined, hasInlineData: boolean) => {
      const expanded = expandedBoxScores.has(gameId);
      setExpandedBoxScores((prev) => {
        const next = new Set(prev);
        if (expanded) {
          next.delete(gameId);
        } else {
          next.add(gameId);
        }
        return next;
      });
      if (!expanded && !loadedBoxScores.has(gameId)) {
        if (hasInlineData || !completedGameId) {
          // Game has inning-by-inning data stored on the record (headless-simulated games),
          // or no save record exists — mark as null so the panel renders inline score data.
          setLoadedBoxScores((prev) => {
            const next = new Map(prev);
            next.set(gameId, null);
            return next;
          });
          return;
        }
        getDb()
          .then(async (db) => {
            const doc = await db.saves.findOne(completedGameId).exec();
            const save = doc ? (doc.toJSON() as unknown as SaveRecord) : null;
            setLoadedBoxScores((prev) => {
              const next = new Map(prev);
              next.set(gameId, save);
              return next;
            });
          })
          .catch(() => {
            setLoadedBoxScores((prev) => {
              const next = new Map(prev);
              next.set(gameId, null);
              return next;
            });
          });
      }
    },
    [expandedBoxScores, loadedBoxScores],
  );

  const getBoxScore = React.useCallback(
    (gameId: string): SaveRecord | null | undefined => {
      if (!loadedBoxScores.has(gameId)) return undefined;
      return loadedBoxScores.get(gameId) ?? null;
    },
    [loadedBoxScores],
  );

  return { isExpanded, toggleBoxScore, getBoxScore };
};
