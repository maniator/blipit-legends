import {
  batterGameStatsV1CollectionConfig,
  completedGamesV1CollectionConfig,
  pitcherGameStatsV1CollectionConfig,
} from "@feat/careerStats/storage/schemaV1";
import {
  playersV1CollectionConfig,
  teamsV1CollectionConfig,
} from "@feat/customTeams/storage/schemaV1";
import {
  leagueSeasonsV1CollectionConfig,
  leaguesV1CollectionConfig,
  scheduledGamesV1CollectionConfig,
} from "@feat/leagueMode/storage/schemaV1";
import { eventsV1CollectionConfig, savesV1CollectionConfig } from "@feat/saves/storage/schemaV1";
import { addRxPlugin, createRxDatabase, type RxStorage } from "rxdb";
import { RxDBMigrationSchemaPlugin } from "rxdb/plugins/migration-schema";

import type { BallgameDb, DbCollections } from "@storage/db";

addRxPlugin(RxDBMigrationSchemaPlugin);

export const createTestDb = async (
  storage: RxStorage<unknown, unknown>,
  name = `ballgame_test_${Math.random().toString(36).slice(2, 14)}`,
): Promise<BallgameDb> => {
  const db = await createRxDatabase<DbCollections>({
    name,
    storage: storage as RxStorage<object, object>,
    multiInstance: false,
  });

  await db.addCollections({
    saves: savesV1CollectionConfig,
    events: eventsV1CollectionConfig,
    teams: teamsV1CollectionConfig,
    players: playersV1CollectionConfig,
    completedGames: completedGamesV1CollectionConfig,
    batterGameStats: batterGameStatsV1CollectionConfig,
    pitcherGameStats: pitcherGameStatsV1CollectionConfig,
    leagues: leaguesV1CollectionConfig,
    leagueSeasons: leagueSeasonsV1CollectionConfig,
    scheduledGames: scheduledGamesV1CollectionConfig,
  });

  return db;
};
