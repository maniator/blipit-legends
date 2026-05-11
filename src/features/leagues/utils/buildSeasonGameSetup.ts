/**
 * Builds an ExhibitionGameSetup from a season game and its two season teams.
 *
 * Loads the live custom team docs from the DB and populates rosters so the
 * game engine receives the full player data it needs for a live game session.
 */
import {
  customTeamToBenchRoster,
  customTeamToDisplayName,
  customTeamToHandednessMap,
  customTeamToLineupOrder,
  customTeamToPitcherRoster,
  customTeamToPlayerOverrides,
} from "@feat/customTeams/adapters/customTeamAdapter";
import { populateRoster } from "@feat/customTeams/storage/customTeamRosterPersistence";
import type { SeasonGameRecord, SeasonTeamRecord } from "@feat/league/storage/types";
import { reinitSeed } from "@shared/utils/rng";

import type { BallgameDb } from "@storage/db";
import type { ExhibitionGameSetup, TeamRecord } from "@storage/types";

export async function buildSeasonGameSetup(
  db: BallgameDb,
  game: SeasonGameRecord,
  homeSeasonTeam: SeasonTeamRecord,
  awaySeasonTeam: SeasonTeamRecord,
  managedTeam: 0 | 1 | null,
): Promise<ExhibitionGameSetup> {
  const [homeDoc, awayDoc] = await Promise.all([
    db.teams.findOne(homeSeasonTeam.customTeamId).exec(),
    db.teams.findOne(awaySeasonTeam.customTeamId).exec(),
  ]);

  if (!homeDoc || !awayDoc) {
    throw new Error(
      `Could not load team docs for game ${game.id}. ` +
        `home=${homeSeasonTeam.customTeamId} away=${awaySeasonTeam.customTeamId}`,
    );
  }

  const [homeTeam, awayTeam] = await Promise.all([
    populateRoster(db, homeDoc.toJSON() as unknown as TeamRecord),
    populateRoster(db, awayDoc.toJSON() as unknown as TeamRecord),
  ]);

  // Reinit the PRNG with the game's derived seed so results are consistent.
  reinitSeed(game.derivedSeed);

  return {
    homeTeam: homeSeasonTeam.customTeamId,
    awayTeam: awaySeasonTeam.customTeamId,
    homeTeamLabel: customTeamToDisplayName(homeTeam),
    awayTeamLabel: customTeamToDisplayName(awayTeam),
    managedTeam,
    playerOverrides: {
      away: customTeamToPlayerOverrides(awayTeam),
      home: customTeamToPlayerOverrides(homeTeam),
      awayOrder: customTeamToLineupOrder(awayTeam),
      homeOrder: customTeamToLineupOrder(homeTeam),
      awayBench: customTeamToBenchRoster(awayTeam),
      homeBench: customTeamToBenchRoster(homeTeam),
      awayPitchers: customTeamToPitcherRoster(awayTeam),
      homePitchers: customTeamToPitcherRoster(homeTeam),
      awayHandedness: customTeamToHandednessMap(awayTeam),
      homeHandedness: customTeamToHandednessMap(homeTeam),
    },
  };
}
