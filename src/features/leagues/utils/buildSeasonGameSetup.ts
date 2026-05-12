/**
 * Builds an ExhibitionGameSetup from a season game and its two season teams.
 *
 * Loads the live custom team docs from the DB and populates rosters so the
 * game engine receives the full player data it needs for a live game session.
 *
 * NOTE: This function does NOT call reinitSeed. The returned `seed` field is
 * set to `game.derivedSeed` so that GameInner can reinitSeed at the correct
 * point in the game bootstrap sequence (after navigation, before handleStart).
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
import { appLog } from "@shared/utils/logger";

import type { BallgameDb } from "@storage/db";
import type { ExhibitionGameSetup, TeamPlayer, TeamRecord, TeamWithRoster } from "@storage/types";

/**
 * Helper to reconstruct a TeamWithRoster from a rosterSnapshot when the team
 * doc is missing from the database (legacy data or deleted team).
 */
function teamFromSnapshot(customTeamId: string, snapshot: Record<string, unknown>): TeamWithRoster {
  const now = new Date().toISOString();
  const name = typeof snapshot.name === "string" ? snapshot.name : customTeamId;
  return {
    id: typeof snapshot.id === "string" ? snapshot.id : customTeamId,
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
    name,
    nameLowercase: name.toLowerCase(),
    abbreviation: typeof snapshot.abbreviation === "string" ? snapshot.abbreviation : undefined,
    city: typeof snapshot.city === "string" ? snapshot.city : undefined,
    nickname: typeof snapshot.nickname === "string" ? snapshot.nickname : undefined,
    slug: typeof snapshot.slug === "string" ? snapshot.slug : undefined,
    metadata: {},
    roster: {
      schemaVersion: 1,
      lineup: Array.isArray(snapshot.lineup) ? (snapshot.lineup as TeamPlayer[]) : [],
      bench: Array.isArray(snapshot.bench) ? (snapshot.bench as TeamPlayer[]) : [],
      pitchers: Array.isArray(snapshot.pitchers) ? (snapshot.pitchers as TeamPlayer[]) : [],
    },
  };
}

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
    appLog.warn(
      `[buildSeasonGameSetup] Team doc(s) missing for game ${game.id}. ` +
        `home=${homeSeasonTeam.customTeamId} found=${!!homeDoc}, ` +
        `away=${awaySeasonTeam.customTeamId} found=${!!awayDoc}. ` +
        `Falling back to roster snapshots.`,
    );
  }

  const homeTeam = homeDoc
    ? await populateRoster(db, homeDoc.toJSON() as unknown as TeamRecord)
    : teamFromSnapshot(homeSeasonTeam.customTeamId, homeSeasonTeam.rosterSnapshot);

  const awayTeam = awayDoc
    ? await populateRoster(db, awayDoc.toJSON() as unknown as TeamRecord)
    : teamFromSnapshot(awaySeasonTeam.customTeamId, awaySeasonTeam.rosterSnapshot);

  return {
    homeTeam: homeSeasonTeam.customTeamId,
    awayTeam: awaySeasonTeam.customTeamId,
    homeTeamLabel: customTeamToDisplayName(homeTeam),
    awayTeamLabel: customTeamToDisplayName(awayTeam),
    managedTeam,
    // Pass seed through so GameInner can reinitSeed at the correct point.
    seed: game.derivedSeed,
    // League season games are tracked via seasonGames records — skip the
    // general-purpose save slot so they don't appear in Load Saved Game.
    disableSave: true,
    // Pass the season game ID so GameInner can mark the game completed in the
    // seasonGames collection and advance currentGameDay when the game ends.
    seasonGameId: game.id,
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
