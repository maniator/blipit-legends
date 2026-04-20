import * as React from "react";

import {
  customTeamToBenchRoster,
  customTeamToDisplayName,
  customTeamToGameId,
  customTeamToHandednessMap,
  customTeamToLineupOrder,
  customTeamToPitcherRoster,
  customTeamToPlayerOverrides,
} from "@feat/customTeams/adapters/customTeamAdapter";
import { CustomTeamStore } from "@feat/customTeams/storage/customTeamStore";
import { useLeague } from "@feat/leagueMode/hooks/useLeague";
import { useLeagueSeason } from "@feat/leagueMode/hooks/useLeagueSeason";
import { useScheduledGames } from "@feat/leagueMode/hooks/useScheduledGames";
import { leagueSeasonStore } from "@feat/leagueMode/storage/leagueSeasonStore";
import type { ScheduledGameRecord } from "@feat/leagueMode/storage/types";
import type { TeamStanding } from "@feat/leagueMode/utils/calculateStandings";
import { calculateStandings } from "@feat/leagueMode/utils/calculateStandings";
import { simulateGameDay } from "@feat/leagueMode/utils/simulateGameDay";
import { useNavigate, useParams } from "react-router";

import { getDb } from "@storage/db";
import type { ExhibitionGameSetup, LeagueGameLocationState, SaveRecord } from "@storage/types";

import {
  BackLink,
  BoxScorePanel,
  BoxScoreStatusText,
  BoxScoreTable,
  BoxScoreToggle,
  ByeLabel,
  ChampionBanner,
  EmptyState,
  ErrorMessage,
  GameDayHeading,
  GameDaySection,
  GameRow,
  LoadingState,
  PageContainer,
  PageHeader,
  PageTitle,
  PlayButton,
  ScheduleTable,
  SeasonCompleteBadge,
  SeasonInfo,
  SeasonNotStarted,
  SeasonStats,
  SimulateDayButton,
  SimulateErrorMessage,
  StandingsHeading,
  StandingsSection,
  StandingsTable,
  StartSeasonButton,
  StatItem,
  StatusBadge,
  TeamName,
  VsSeparator,
} from "./styles";

const LeagueDetailPage: React.FunctionComponent = () => {
  const { leagueId } = useParams<{ leagueId: string }>();
  const navigate = useNavigate();

  const [refreshKey, setRefreshKey] = React.useState(0);

  const { league, isLoading: leagueLoading, error: leagueError } = useLeague(leagueId);
  const {
    season,
    isLoading: seasonLoading,
    error: seasonError,
  } = useLeagueSeason(league?.activeLeagueSeasonId, refreshKey);
  const {
    games,
    isLoading: gamesLoading,
    error: gamesError,
  } = useScheduledGames(season?.id ?? null, refreshKey);

  const [teamNameMap, setTeamNameMap] = React.useState<Record<string, string>>({});
  const [startingSeason, setStartingSeason] = React.useState(false);
  const [simulatingDay, setSimulatingDay] = React.useState(false);
  const [simulateDayError, setSimulateDayError] = React.useState<string | null>(null);

  const [expandedBoxScores, setExpandedBoxScores] = React.useState<Set<string>>(new Set());
  const [loadedBoxScores, setLoadedBoxScores] = React.useState<Map<string, SaveRecord | null>>(
    new Map(),
  );

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

  const handleSimulateDay = React.useCallback(async () => {
    if (!season) return;
    setSimulatingDay(true);
    setSimulateDayError(null);
    try {
      await simulateGameDay(season, season.currentGameDay);
      setRefreshKey((k) => k + 1);
    } catch (err: unknown) {
      setSimulateDayError(err instanceof Error ? err.message : String(err));
    } finally {
      setSimulatingDay(false);
    }
  }, [season]);

  // Tracks which game is currently launching (prevents double-click).
  const [launchingGameId, setLaunchingGameId] = React.useState<string | null>(null);

  const handlePlayGame = React.useCallback(
    async (game: ScheduledGameRecord) => {
      if (!league || !season) return;
      setLaunchingGameId(game.id);
      try {
        const allTeams = await CustomTeamStore.listCustomTeams();
        const awayDoc = allTeams.find((t) => t.id === game.awayTeamId);
        const homeDoc = allTeams.find((t) => t.id === game.homeTeamId);
        if (!awayDoc || !homeDoc) {
          setLaunchingGameId(null);
          return;
        }
        const setup: ExhibitionGameSetup = {
          homeTeam: customTeamToGameId(homeDoc),
          awayTeam: customTeamToGameId(awayDoc),
          homeTeamLabel: customTeamToDisplayName(homeDoc),
          awayTeamLabel: customTeamToDisplayName(awayDoc),
          managedTeam: null,
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
        };
        const state: LeagueGameLocationState = {
          leagueGameContext: {
            leagueId: league.id,
            leagueSeasonId: season.id,
            scheduledGameId: game.id,
          },
          pendingGameSetup: setup,
          pendingLoadSave: null,
        };
        navigate("/game", { state });
      } catch {
        setLaunchingGameId(null);
      }
    },
    [league, season, navigate],
  );

  const handleToggleBoxScore = React.useCallback(
    (gameId: string, completedGameId: string) => {
      const isExpanded = expandedBoxScores.has(gameId);
      setExpandedBoxScores((prev) => {
        const next = new Set(prev);
        if (isExpanded) {
          next.delete(gameId);
        } else {
          next.add(gameId);
        }
        return next;
      });
      if (!isExpanded && !loadedBoxScores.has(gameId)) {
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

  const renderBoxScore = React.useCallback(
    (game: ScheduledGameRecord): React.ReactNode => {
      if (!loadedBoxScores.has(game.id)) {
        return <BoxScoreStatusText>Loading…</BoxScoreStatusText>;
      }
      const save = loadedBoxScores.get(game.id);
      if (!save || !save.stateSnapshot) {
        return <BoxScoreStatusText>Box score unavailable</BoxScoreStatusText>;
      }
      const { state } = save.stateSnapshot;
      const awayLabel = state.teamLabels?.[0] ?? teamNameMap[game.awayTeamId] ?? game.awayTeamId;
      const homeLabel = state.teamLabels?.[1] ?? teamNameMap[game.homeTeamId] ?? game.homeTeamId;
      const awayRuns = state.inningRuns[0] ?? [];
      const homeRuns = state.inningRuns[1] ?? [];
      const finalAway = save.scoreSnapshot?.away ?? awayRuns.reduce((a, b) => a + (b ?? 0), 0);
      const finalHome = save.scoreSnapshot?.home ?? homeRuns.reduce((a, b) => a + (b ?? 0), 0);
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
    [loadedBoxScores, teamNameMap],
  );

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

  const currentDayGames = gameDayMap.get(season?.currentGameDay ?? -1) ?? [];
  const hasScheduledGamesOnCurrentDay = currentDayGames.some((g) => g.status === "scheduled");

  const standings = React.useMemo<TeamStanding[]>(
    () => (league && games.length > 0 ? calculateStandings(games, league.teamIds) : []),
    [games, league],
  );

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
            disabled={startingSeason}
          >
            {startingSeason ? "Starting…" : "Start Season"}
          </StartSeasonButton>
          <SeasonNotStarted data-testid="season-not-started">
            Season has not started yet.
          </SeasonNotStarted>
        </>
      )}

      {season && season.status === "active" && (
        <>
          <SimulateDayButton
            type="button"
            data-testid="simulate-day-button"
            onClick={() => {
              void handleSimulateDay();
            }}
            disabled={simulatingDay || !hasScheduledGamesOnCurrentDay}
          >
            {simulatingDay ? "Simulating…" : "Simulate Day"}
          </SimulateDayButton>
          {simulateDayError && (
            <SimulateErrorMessage data-testid="simulate-day-error">
              {simulateDayError}
            </SimulateErrorMessage>
          )}
        </>
      )}

      {season && season.status === "complete" && (
        <SeasonCompleteBadge data-testid="season-complete-badge">
          Season Complete ✓
        </SeasonCompleteBadge>
      )}

      {season && season.status === "complete" && season.championTeamId && (
        <ChampionBanner data-testid="champion-banner">
          🏆 Champion: {getTeamName(season.championTeamId)}
        </ChampionBanner>
      )}

      {!gamesLoading && season && standings.length > 0 && (
        <StandingsSection>
          <StandingsHeading>Standings</StandingsHeading>
          <StandingsTable data-testid="standings-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Team</th>
                <th>W</th>
                <th>L</th>
                <th>PCT</th>
                <th>R</th>
                <th>RA</th>
                <th>DIFF</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((s, i) => (
                <tr key={s.teamId}>
                  <td>{i + 1}</td>
                  <td>{getTeamName(s.teamId)}</td>
                  <td>{s.wins}</td>
                  <td>{s.losses}</td>
                  <td>
                    {s.gamesPlayed === 0
                      ? ".000"
                      : `.${Math.round(s.winPct * 1000)
                          .toString()
                          .padStart(3, "0")}`}
                  </td>
                  <td>{s.runsScored}</td>
                  <td>{s.runsAllowed}</td>
                  <td>{s.runDifferential > 0 ? `+${s.runDifferential}` : s.runDifferential}</td>
                </tr>
              ))}
            </tbody>
          </StandingsTable>
        </StandingsSection>
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
                        <StatusBadge $status={game.status}>
                          {getStatusLabel(game.status)}
                        </StatusBadge>
                        {game.status === "scheduled" && (
                          <PlayButton
                            type="button"
                            data-testid={`play-game-button-${game.id}`}
                            aria-label="Play game"
                            disabled={
                              launchingGameId === game.id || game.gameDay !== season?.currentGameDay
                            }
                            onClick={() => {
                              void handlePlayGame(game);
                            }}
                          >
                            {launchingGameId === game.id ? "Loading…" : "▶ Play"}
                          </PlayButton>
                        )}
                        {game.status === "completed" && game.completedGameId && (
                          <BoxScoreToggle
                            type="button"
                            data-testid={`box-score-toggle-${game.id}`}
                            aria-expanded={expandedBoxScores.has(game.id)}
                            onClick={() => {
                              handleToggleBoxScore(game.id, game.completedGameId!);
                            }}
                          >
                            {expandedBoxScores.has(game.id) ? "▴ Box Score" : "▾ Box Score"}
                          </BoxScoreToggle>
                        )}
                      </GameRow>
                      {expandedBoxScores.has(game.id) && game.completedGameId && (
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
      )}
    </PageContainer>
  );
};

export default LeagueDetailPage;
