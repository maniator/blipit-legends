import {
  batterGameStatsV1CollectionConfig,
  completedGamesV1CollectionConfig,
  pitcherGameStatsV1CollectionConfig,
} from "@feat/careerStats/storage/schemaV1";
import {
  playersV1CollectionConfig,
  teamsV1CollectionConfig,
} from "@feat/customTeams/storage/schemaV1";
import { seasonGamesCollectionConfig } from "@feat/league/storage/seasonGamesSchema";
import { seasonPlayerStateCollectionConfig } from "@feat/league/storage/seasonPlayerStateSchema";
import { seasonsCollectionConfig } from "@feat/league/storage/seasonsSchema";
import { seasonTeamsCollectionConfig } from "@feat/league/storage/seasonTeamsSchema";
import { eventsV1CollectionConfig, savesV1CollectionConfig } from "@feat/saves/storage/schemaV1";
import { createRxDatabase, type RxStorage } from "rxdb";

import type { BallgameDb, DbCollections } from "@storage/db";

export const createTestDb = async (
  storage: RxStorage<unknown, unknown>,
  name = `ballgame_test_${Math.random().toString(36).slice(2, 14)}`,
): Promise<BallgameDb> => {
  const db = await createRxDatabase<DbCollections>({
    name,
    storage: storage as RxStorage<object, object>,
    multiInstance: false,
  });

  try {
    await db.addCollections({
      saves: savesV1CollectionConfig,
      events: eventsV1CollectionConfig,
      teams: teamsV1CollectionConfig,
      players: playersV1CollectionConfig,
      completedGames: completedGamesV1CollectionConfig,
      batterGameStats: batterGameStatsV1CollectionConfig,
      pitcherGameStats: pitcherGameStatsV1CollectionConfig,
      seasons: seasonsCollectionConfig,
      seasonTeams: seasonTeamsCollectionConfig,
      seasonGames: seasonGamesCollectionConfig,
      seasonPlayerState: seasonPlayerStateCollectionConfig,
    });
  } catch (err) {
    // Best-effort cleanup: close partially-initialized collection slots so that
    // subsequent tests don't accumulate stale OPEN_COLLECTIONS entries.
    await db.close().catch(() => undefined);
    throw err;
  }

  return db;
};