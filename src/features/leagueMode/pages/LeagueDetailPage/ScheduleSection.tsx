import * as React from "react";

import type { ScheduledGameRecord } from "@feat/leagueMode/storage/types";
import type { LeagueSeasonRecord } from "@feat/leagueMode/storage/types";

import type { SaveRecord } from "@storage/types";

import {
  BoxScorePanel,
  BoxScoreStatusText,
  BoxScoreTable,
  BoxScoreToggle,
  ByeLabel,
  GameDayHeading,
  GameDaySection,
  GameRow,
  PlayButton,
  ScheduleTable,
  SeasonStats,
  StatItem,
  StatusBadge,
  TeamName,
  VsSeparator,
} from "./styles";

interface ScheduleSectionProps {
  games: ScheduledGameRecord[];
  season: LeagueSeasonRecord | null | undefined;
  getTeamName: (teamId: string) => string;
  launchingGameId: string | null;
  onPlayGame: (game: ScheduledGameRecord) => void;
  isExpanded: (gameId: string) => boolean;
  onToggleBoxScore: (gameId: string, completedGameId: string) => void;
  getBoxScore: (gameId: string) => SaveRecord | null | undefined;
}

const getStatusLabel = (status: ScheduledGameRecord["status"]): string => {
  switch (status) {
    case "completed":
      return "Completed";
    case "bye":
      return "Bye";
    default:
      return "Scheduled";
  }
};

export const ScheduleSection: React.FunctionComponent<ScheduleSectionProps> = ({
  games,
  season,
  getTeamName,
  launchingGameId,
  onPlayGame,
  isExpanded,
  onToggleBoxScore,
  getBoxScore,
}) => {
  const gameDayMap = React.useMemo<Map<number, ScheduledGameRecord[]>>(() => {
    const map = new Map<number, ScheduledGameRecord[]>();
    for (const game of games) {
      const list = map.get(game.gameDay) ?? [];
      list.push(game);
      map.set(game.gameDay, list);
    }
    return map;
  }, [games]);

  const sortedGameDays = React.useMemo(
    () => [...gameDayMap.keys()].sort((a, b) => a - b),
    [gameDayMap],
  );

  const scheduledCount = React.useMemo(
    () => games.filter((g) => g.status === "scheduled").length,
    [games],
  );
  const completedCount = React.useMemo(
    () => games.filter((g) => g.status === "completed").length,
    [games],
  );
  const byeCount = React.useMemo(() => games.filter((g) => g.status === "bye").length, [games]);

  const renderBoxScore = React.useCallback(
    (game: ScheduledGameRecord): React.ReactNode => {
      const boxScore = getBoxScore(game.id);
      if (boxScore === undefined) {
        return <BoxScoreStatusText>Loading…</BoxScoreStatusText>;
      }
      if (!boxScore || !boxScore.stateSnapshot) {
        return <BoxScoreStatusText>Box score unavailable</BoxScoreStatusText>;
      }
      const { state } = boxScore.stateSnapshot;
      const awayLabel = state.teamLabels?.[0] ?? getTeamName(game.awayTeamId);
      const homeLabel = state.teamLabels?.[1] ?? getTeamName(game.homeTeamId);
      const awayRuns = state.inningRuns[0] ?? [];
      const homeRuns = state.inningRuns[1] ?? [];
      const finalAway = boxScore.scoreSnapshot?.away ?? awayRuns.reduce((a, b) => a + (b ?? 0), 0);
      const finalHome = boxScore.scoreSnapshot?.home ?? homeRuns.reduce((a, b) => a + (b ?? 0), 0);
      const innings = Math.max(awayRuns.length, homeRuns.length, 9);
      return (
        <BoxScoreTable>
          <thead>
            <tr>
              <th>Team</th>
              {Array.from({ length: innings }, (_, i) => (
                <th key={i}>{i + 1}</th>
              ))}
              <th>R</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{awayLabel}</td>
              {Array.from({ length: innings }, (_, i) => (
                <td key={i}>{awayRuns[i] ?? 0}</td>
              ))}
              <td>
                <strong>{finalAway}</strong>
              </td>
            </tr>
            <tr>
              <td>{homeLabel}</td>
              {Array.from({ length: innings }, (_, i) => (
                <td key={i}>{homeRuns[i] ?? 0}</td>
              ))}
              <td>
                <strong>{finalHome}</strong>
              </td>
            </tr>
          </tbody>
        </BoxScoreTable>
      );
    },
    [getBoxScore, getTeamName],
  );

  return (
    <>
      <SeasonStats data-testid="season-stats">
        <StatItem>Scheduled: {scheduledCount}</StatItem>
        <StatItem>Completed: {completedCount}</StatItem>
        <StatItem>Byes: {byeCount}</StatItem>
      </SeasonStats>

      <ScheduleTable data-testid="schedule-table">
        {sortedGameDays.map((gameDay) => {
          const dayGames = gameDayMap.get(gameDay) ?? [];
          return (
            <GameDaySection key={gameDay}>
              <GameDayHeading>Game Day {gameDay + 1}</GameDayHeading>
              {dayGames.map((game) => (
                <React.Fragment key={game.id}>
                  <GameRow data-testid={`game-row-${game.id}`}>
                    {game.status === "bye" ? (
                      <ByeLabel>BYE — {getTeamName(game.homeTeamId)}</ByeLabel>
                    ) : (
                      <>
                        <TeamName>{getTeamName(game.awayTeamId)}</TeamName>
                        <VsSeparator>vs</VsSeparator>
                        <TeamName>{getTeamName(game.homeTeamId)}</TeamName>
                      </>
                    )}
                    <StatusBadge $status={game.status}>{getStatusLabel(game.status)}</StatusBadge>
                    {game.status === "scheduled" && (
                      <PlayButton
                        type="button"
                        data-testid={`play-game-button-${game.id}`}
                        aria-label="Play game"
                        disabled={
                          launchingGameId === game.id || game.gameDay !== season?.currentGameDay
                        }
                        onClick={() => {
                          onPlayGame(game);
                        }}
                      >
                        {launchingGameId === game.id ? "Loading…" : "▶ Play"}
                      </PlayButton>
                    )}
                    {game.status === "completed" && game.completedGameId && (
                      <BoxScoreToggle
                        type="button"
                        data-testid={`box-score-toggle-${game.id}`}
                        aria-expanded={isExpanded(game.id)}
                        onClick={() => {
                          onToggleBoxScore(game.id, game.completedGameId!);
                        }}
                      >
                        {isExpanded(game.id) ? "▴ Box Score" : "▾ Box Score"}
                      </BoxScoreToggle>
                    )}
                  </GameRow>
                  {isExpanded(game.id) && game.completedGameId && (
                    <BoxScorePanel data-testid={`box-score-panel-${game.id}`}>
                      {renderBoxScore(game)}
                    </BoxScorePanel>
                  )}
                </React.Fragment>
              ))}
            </GameDaySection>
          );
        })}
      </ScheduleTable>
    </>
  );
};
