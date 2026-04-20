import type { ScheduledGameRecord } from "../storage/types";

export interface TeamStanding {
  teamId: string;
  wins: number;
  losses: number;
  ties: number;
  gamesPlayed: number;
  winPct: number;
  runsScored: number;
  runsAllowed: number;
  runDifferential: number;
}

export function calculateStandings(
  games: ScheduledGameRecord[],
  teamIds: string[],
): TeamStanding[] {
  const standings = new Map<string, TeamStanding>(
    teamIds.map((id) => [
      id,
      {
        teamId: id,
        wins: 0,
        losses: 0,
        ties: 0,
        gamesPlayed: 0,
        winPct: 0,
        runsScored: 0,
        runsAllowed: 0,
        runDifferential: 0,
      },
    ]),
  );

  for (const game of games) {
    if (game.status !== "completed" || game.winnerId === undefined) continue;
    if (game.homeScore === undefined || game.awayScore === undefined) continue;

    const home = standings.get(game.homeTeamId);
    const away = standings.get(game.awayTeamId);
    const isTie = game.homeScore === game.awayScore;

    if (home) {
      home.gamesPlayed++;
      home.runsScored += game.homeScore;
      home.runsAllowed += game.awayScore;
      if (isTie) {
        home.ties++;
      } else if (game.winnerId === game.homeTeamId) {
        home.wins++;
      } else {
        home.losses++;
      }
    }

    if (away) {
      away.gamesPlayed++;
      away.runsScored += game.awayScore;
      away.runsAllowed += game.homeScore;
      if (isTie) {
        away.ties++;
      } else if (game.winnerId === game.awayTeamId) {
        away.wins++;
      } else {
        away.losses++;
      }
    }
  }

  for (const standing of standings.values()) {
    const totalGames = standing.wins + standing.losses + standing.ties;
    standing.winPct = totalGames === 0 ? 0 : standing.wins / totalGames;
    standing.runDifferential = standing.runsScored - standing.runsAllowed;
  }

  return [...standings.values()].sort((a, b) => {
    if (b.winPct !== a.winPct) return b.winPct - a.winPct;
    if (b.runsScored !== a.runsScored) return b.runsScored - a.runsScored;
    return a.teamId.localeCompare(b.teamId);
  });
}
