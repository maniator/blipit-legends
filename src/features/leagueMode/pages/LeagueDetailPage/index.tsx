import * as React from "react";

import { CustomTeamStore } from "@feat/customTeams/storage/customTeamStore";
import { useLeague } from "@feat/leagueMode/hooks/useLeague";
import { useLeagueSeason } from "@feat/leagueMode/hooks/useLeagueSeason";
import { useScheduledGames } from "@feat/leagueMode/hooks/useScheduledGames";
import { leagueSeasonStore } from "@feat/leagueMode/storage/leagueSeasonStore";
import type { ScheduledGameRecord } from "@feat/leagueMode/storage/types";
import { useNavigate, useParams } from "react-router";

import {
  BackLink,
  ByeLabel,
  EmptyState,
  ErrorMessage,
  GameDayHeading,
  GameDaySection,
  GameRow,
  LoadingState,
  PageContainer,
  PageHeader,
  PageTitle,
  ScheduleTable,
  SeasonInfo,
  SeasonNotStarted,
  SeasonStats,
  StartSeasonButton,
  StatItem,
  StatusBadge,
  TeamName,
  VsSeparator,
} from "./styles";

const LeagueDetailPage: React.FunctionComponent = () => {
  const { leagueId } = useParams<{ leagueId: string }>();
  const navigate = useNavigate();

  const { league, isLoading: leagueLoading, error: leagueError } = useLeague(leagueId);
  const {
    season,
    isLoading: seasonLoading,
    error: seasonError,
  } = useLeagueSeason(league?.activeLeagueSeasonId);
  const {
    games,
    isLoading: gamesLoading,
    error: gamesError,
  } = useScheduledGames(season?.id ?? null);

  const [teamNameMap, setTeamNameMap] = React.useState<Record<string, string>>({});
  const [startingseason, setStartingSeason] = React.useState(false);

  // Load team names for schedule display
  React.useEffect(() => {
    let cancelled = false;
    CustomTeamStore.listCustomTeams({ withRoster: false })
      .then((teams) => {
        if (!cancelled) {
          const map: Record<string, string> = {};
          for (const team of teams) {
            map[team.id] = team.name;
          }
          setTeamNameMap(map);
        }
      })
      .catch(() => {
        // Non-fatal — fall back to raw IDs
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleStartSeason = React.useCallback(async () => {
    if (!season) return;
    setStartingSeason(true);
    try {
      await leagueSeasonStore.markSeasonActive(season.id);
      // Force season reload by navigating to same page
      navigate(0);
    } catch {
      // Ignore — season state will remain pending
    } finally {
      setStartingSeason(false);
    }
  }, [season, navigate]);

  // Group games by gameDay — always called (no conditional return before hooks)
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

  const error = leagueError ?? seasonError ?? gamesError;
  const isLoading = leagueLoading || (league != null && seasonLoading);

  const getTeamName = React.useCallback(
    (teamId: string): string => teamNameMap[teamId] ?? teamId,
    [teamNameMap],
  );

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

  if (isLoading) {
    return (
      <PageContainer data-testid="league-detail-page">
        <LoadingState data-testid="league-detail-loading">Loading league…</LoadingState>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer data-testid="league-detail-page">
        <PageHeader>
          <BackLink
            to="/league"
            data-testid="league-detail-back-button"
            aria-label="Back to Leagues"
          >
            ← Back to Leagues
          </BackLink>
        </PageHeader>
        <ErrorMessage data-testid="league-detail-error">{error.message}</ErrorMessage>
      </PageContainer>
    );
  }

  if (!league) {
    return (
      <PageContainer data-testid="league-detail-page">
        <PageHeader>
          <BackLink
            to="/league"
            data-testid="league-detail-back-button"
            aria-label="Back to Leagues"
          >
            ← Back to Leagues
          </BackLink>
        </PageHeader>
        <EmptyState data-testid="league-not-found">League not found.</EmptyState>
      </PageContainer>
    );
  }

  return (
    <PageContainer data-testid="league-detail-page">
      <PageHeader>
        <BackLink to="/league" data-testid="league-detail-back-button" aria-label="Back to Leagues">
          ← Back to Leagues
        </BackLink>
      </PageHeader>

      <PageTitle>{league.name}</PageTitle>

      {season && (
        <SeasonInfo>
          Season {season.seasonNumber} · {season.status}
        </SeasonInfo>
      )}

      {season && season.status === "pending" && (
        <>
          <StartSeasonButton
            type="button"
            data-testid="start-season-button"
            onClick={handleStartSeason}
            disabled={startingseason}
          >
            {startingseason ? "Starting…" : "Start Season"}
          </StartSeasonButton>
          <SeasonNotStarted data-testid="season-not-started">
            Season has not started yet.
          </SeasonNotStarted>
        </>
      )}

      {!gamesLoading && games.length > 0 && (
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
                    <GameRow key={game.id} data-testid={`game-row-${game.id}`}>
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
                    </GameRow>
                  ))}
                </GameDaySection>
              );
            })}
          </ScheduleTable>
        </>
      )}
    </PageContainer>
  );
};

export default LeagueDetailPage;
