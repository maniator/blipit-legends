import { GameHistoryStore } from "@feat/careerStats/storage/gameHistoryStore";
import { computePitcherGameStats } from "@feat/careerStats/utils/computePitcherGameStats";
import {
  customTeamToBenchRoster,
  customTeamToDisplayName,
  customTeamToHandednessMap,
  customTeamToLineupOrder,
  customTeamToPitcherRoster,
  customTeamToPlayerOverrides,
} from "@feat/customTeams/adapters/customTeamAdapter";
import { CustomTeamStore } from "@feat/customTeams/storage/customTeamStore";
import type { State } from "@feat/gameplay/context/gameStateTypes";
import { appLog } from "@shared/utils/logger";
import { computeBattingStatsFromLogs } from "@shared/utils/stats/computeBattingStatsFromLogs";

import type { BatterGameStatRecord, PitcherGameStatRecord } from "@storage/types";

import { scheduledGameStore } from "../storage/scheduledGameStore";
import type { LeagueSeasonRecord } from "../storage/types";
import { advanceGameDayIfComplete } from "./advanceGameDayIfComplete";
import { deriveScheduledGameSeed } from "./deriveScheduledGameSeed";
import { simulateGame } from "./simulateGame";

/**
 * Extracts batting stat rows from a completed game state.
 * Mirrors the per-team batting loop in useGameHistorySync.ts (`commitGame` callback)
 * so career stats are consistent between manually-played and headless-simulated games.
 * Keep these two implementations in sync when changing stat fields.
 */
function buildBattingStatRows(
  gameId: string,
  state: State,
): Omit<BatterGameStatRecord, "id" | "schemaVersion" | "createdAt">[] {
  const rows: Omit<BatterGameStatRecord, "id" | "schemaVersion" | "createdAt">[] = [];
  for (const teamIdx of [0, 1] as const) {
    const teamId = state.teams[teamIdx];
    const opponentTeamId = state.teams[teamIdx === 0 ? 1 : 0];
    const teamStats = computeBattingStatsFromLogs(
      teamIdx,
      state.playLog,
      state.strikeoutLog,
      state.outLog,
    );
    const order = state.lineupOrder[teamIdx];
    for (const [playerId, batting] of Object.entries(teamStats)) {
      const slotIdx = order.indexOf(playerId);
      const nameAtGameTime =
        state.playerOverrides[teamIdx][playerId]?.nickname?.trim() ||
        (slotIdx >= 0 ? `Batter ${slotIdx + 1}` : playerId);
      rows.push({
        gameId,
        teamId,
        opponentTeamId,
        playerId,
        nameAtGameTime,
        role: "batter",
        batting,
      });
    }
  }
  return rows;
}

/**
 * Extracts pitcher stat rows from a completed game state.
 * Mirrors the pitcherResults loop in useGameHistorySync.ts (`commitGame` callback)
 * so career stats are consistent between manually-played and headless-simulated games.
 * Keep these two implementations in sync when changing stat fields.
 */
function buildPitcherStatRows(
  gameId: string,
  state: State,
): Omit<PitcherGameStatRecord, "id" | "schemaVersion" | "createdAt">[] {
  const rows: Omit<PitcherGameStatRecord, "id" | "schemaVersion" | "createdAt">[] = [];
  const pitcherResults = computePitcherGameStats(state.pitcherGameLog ?? [[], []], state.score);

  const pitcherNameMaps: [Map<string, string>, Map<string, string>] = [new Map(), new Map()];
  for (const teamIdx of [0, 1] as const) {
    for (const [id, override] of Object.entries(state.playerOverrides[teamIdx])) {
      if (override.nickname?.trim()) pitcherNameMaps[teamIdx].set(id, override.nickname.trim());
    }
  }

  for (const { teamIdx, result } of pitcherResults) {
    const teamId = state.teams[teamIdx];
    const opponentTeamId = state.teams[teamIdx === 0 ? 1 : 0];
    const playerId = result.pitcherId;
    const nameAtGameTime = pitcherNameMaps[teamIdx].get(playerId) ?? playerId;
    rows.push({
      gameId,
      teamId,
      opponentTeamId,
      playerId,
      nameAtGameTime,
      outsPitched: result.outsPitched,
      battersFaced: result.battersFaced,
      pitchesThrown: result.pitchesThrown,
      hitsAllowed: result.hitsAllowed,
      walksAllowed: result.walksAllowed,
      strikeoutsRecorded: result.strikeoutsRecorded,
      homersAllowed: result.homersAllowed,
      runsAllowed: result.runsAllowed,
      earnedRuns: result.earnedRuns,
      saves: result.saves,
      holds: result.holds,
      blownSaves: result.blownSaves,
    });
  }
  return rows;
}

export async function simulateGameDay(
  leagueSeason: LeagueSeasonRecord,
  gameDay: number,
): Promise<void> {
  const games = await scheduledGameStore.listGamesForDay(leagueSeason.id, gameDay);
  const scheduledGames = games.filter((g) => g.status === "scheduled");

  // Fetch all team docs once per day — used to pass current rosters to each simulation
  // so the correct player IDs and names are used in career stats.
  const allTeams = await CustomTeamStore.listCustomTeams();

  for (const game of scheduledGames) {
    const awayDoc = allTeams.find((t) => t.id === game.awayTeamId);
    const homeDoc = allTeams.find((t) => t.id === game.homeTeamId);

    if (!awayDoc || !homeDoc) {
      // Team docs are missing (e.g. deleted after league creation). The simulation will
      // still run with generic player IDs, but career stats won't map to real players.
      appLog.warn("simulateGameDay: team doc(s) not found for game", {
        gameId: game.id,
        awayTeamId: game.awayTeamId,
        awayFound: Boolean(awayDoc),
        homeTeamId: game.homeTeamId,
        homeFound: Boolean(homeDoc),
      });
    }

    const simOptions =
      awayDoc && homeDoc
        ? {
            playerOverrides: {
              away: customTeamToPlayerOverrides(awayDoc),
              home: customTeamToPlayerOverrides(homeDoc),
              awayOrder: customTeamToLineupOrder(awayDoc),
              homeOrder: customTeamToLineupOrder(homeDoc),
              awayBench: customTeamToBenchRoster(awayDoc),
              homeBench: customTeamToBenchRoster(homeDoc),
              awayPitchers: customTeamToPitcherRoster(awayDoc),
              homePitchers: customTeamToPitcherRoster(homeDoc),
              awayHandedness: customTeamToHandednessMap(awayDoc),
              homeHandedness: customTeamToHandednessMap(homeDoc),
            },
            awayTeamLabel: customTeamToDisplayName(awayDoc),
            homeTeamLabel: customTeamToDisplayName(homeDoc),
          }
        : undefined;

    const result = await simulateGame(game, leagueSeason.id, simOptions);
    const { finalState } = result;
    const gameInstanceId = finalState.gameInstanceId ?? game.id;

    // Commit batting + pitching stats to career history so every simulated league
    // game contributes to each player's career record — just like manually played games.
    const battingRows = buildBattingStatRows(gameInstanceId, finalState);
    const pitcherRows = buildPitcherStatRows(gameInstanceId, finalState);
    await GameHistoryStore.commitCompletedGame(
      gameInstanceId,
      {
        playedAt: Date.now(),
        seed: deriveScheduledGameSeed(leagueSeason.id, game.id),
        rngState: null,
        homeTeamId: game.homeTeamId,
        awayTeamId: game.awayTeamId,
        homeScore: result.homeScore,
        awayScore: result.awayScore,
        innings: finalState.inning,
        leagueSeasonId: leagueSeason.id,
        scheduledGameId: game.id,
      },
      battingRows,
      pitcherRows,
    );

    // Persist inning-by-inning scores on the ScheduledGameRecord so the
    // box score panel can show a full inning breakdown without a save record.
    await scheduledGameStore.markScheduledGameCompleted(game.id, gameInstanceId, {
      winnerId: result.winnerId,
      homeScore: result.homeScore,
      awayScore: result.awayScore,
      awayInningRuns: finalState.inningRuns[0],
      homeInningRuns: finalState.inningRuns[1],
    });
  }

  // Delegate advancement + season finalization to the shared utility so both the
  // manual-play path (useLeagueGameReconciliation) and the headless-simulation path
  // use identical logic. All scheduled games are now completed so allDone = true.
  await advanceGameDayIfComplete(leagueSeason.id, gameDay);
}
