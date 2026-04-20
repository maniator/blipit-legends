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
import { useLeagueBoxScore } from "@feat/leagueMode/hooks/useLeagueBoxScore";
import { useLeagueSeason } from "@feat/leagueMode/hooks/useLeagueSeason";
import { useLeagueSimulation } from "@feat/leagueMode/hooks/useLeagueSimulation";
import { useScheduledGames } from "@feat/leagueMode/hooks/useScheduledGames";
import { leagueSeasonStore } from "@feat/leagueMode/storage/leagueSeasonStore";
import type { ScheduledGameRecord } from "@feat/leagueMode/storage/types";
import { calculateStandings } from "@feat/leagueMode/utils/calculateStandings";
import { useNavigate, useParams } from "react-router";

import type { ExhibitionGameSetup, LeagueGameLocationState } from "@storage/types";

import { ScheduleSection } from "./ScheduleSection";
import { StandingsSection } from "./StandingsSection";
import {
  BackLink,
  ChampionBanner,
  EmptyState,
  ErrorMessage,
  LoadingState,
  PageContainer,
  PageHeader,
  PageTitle,
  SeasonCompleteBadge,
  SeasonInfo,
  SeasonNotStarted,
  SimulateDayButton,
  SimulateErrorMessage,
  StartSeasonButton,
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

  const { simulatingDay, simulateDayError, handleSimulateDay } = useLeagueSimulation(
    season,
    React.useCallback(() => setRefreshKey((k) => k + 1), []),
  );

  const { isExpanded, toggleBoxScore, getBoxScore } = useLeagueBoxScore();

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

  const gameDayMap = React.useMemo<Map<number, ScheduledGameRecord[]>>(() => {
    const map = new Map<number, ScheduledGameRecord[]>();
    for (const game of games) {
      const list = map.get(game.gameDay) ?? [];
      list.push(game);
      map.set(game.gameDay, list);
    }
    return map;
  }, [games]);

  const currentDayGames = gameDayMap.get(season?.currentGameDay ?? -1) ?? [];
  const hasScheduledGamesOnCurrentDay = currentDayGames.some((g) => g.status === "scheduled");

  const standings = React.useMemo(
    () => (league && games.length > 0 ? calculateStandings(games, league.teamIds) : []),
    [games, league],
  );

  const error = leagueError ?? seasonError ?? gamesError;
  const isLoading = leagueLoading || (league != null && seasonLoading);

  const getTeamName = React.useCallback(
    (teamId: string): string => teamNameMap[teamId] ?? teamId,
    [teamNameMap],
  );

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
        <StandingsSection standings={standings} getTeamName={getTeamName} />
      )}

      {!gamesLoading && games.length > 0 && (
        <ScheduleSection
          games={games}
          season={season}
          getTeamName={getTeamName}
          launchingGameId={launchingGameId}
          onPlayGame={(game) => {
            void handlePlayGame(game);
          }}
          isExpanded={isExpanded}
          onToggleBoxScore={toggleBoxScore}
          getBoxScore={getBoxScore}
        />
      )}
    </PageContainer>
  );
};

export default LeagueDetailPage;
