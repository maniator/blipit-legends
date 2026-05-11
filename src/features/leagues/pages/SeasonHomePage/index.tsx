import * as React from "react";

import { advanceSeason, simulateNextDay } from "@feat/league/storage/leagueStore";
import type { SeasonGameRecord, SeasonTeamRecord } from "@feat/league/storage/types";
import { deriveStandings } from "@feat/league/utils/deriveStandings";
import { SeasonContextProvider, useSeasonContext } from "@feat/leagues/context/SeasonContext";
import { buildSeasonGameSetup } from "@feat/leagues/utils/buildSeasonGameSetup";
import { getTotalGameDays } from "@feat/leagues/utils/seasonPresets";
import EmptyState from "@shared/components/EmptyState";
import { BackBtn, PageContainer, PageHeader } from "@shared/components/PageLayout/styles";
import { appLog } from "@shared/utils/logger";
import { useNavigate, useParams } from "react-router";
import { useLiveRxQuery } from "rxdb/plugins/react";

import { getDb } from "@storage/db";
import type { GameLocationState } from "@storage/types";

import {
  AdvanceReadyMsg,
  ChampionBanner,
  GameActionBtn,
  GameActionRow,
  GameDayRow,
  NavCard,
  NavCardGrid,
  NavCardLink,
  NavCardSub,
  NavCardTitle,
  SeasonMeta,
  SeasonProgress,
  SeasonTitle,
  SimulateButton,
  SimulateError,
  SimulateSection,
  StandingsRow,
  StandingsTable,
  StandingsTd,
  StandingsTeamName,
  StandingsTh,
  StatusChip,
} from "./styles";

// ---------------------------------------------------------------------------
// Inner component — requires SeasonContextProvider + RxDatabaseProvider
// ---------------------------------------------------------------------------

const SeasonHomePageInner: React.FunctionComponent = () => {
  const navigate = useNavigate();
  const { seasonId } = useParams<{ seasonId: string }>();
  const { season, seasonTeams, loading } = useSeasonContext();

  const [simulating, setSimulating] = React.useState(false);
  const [simError, setSimError] = React.useState<string | null>(null);
  const [nextGameReady, setNextGameReady] = React.useState(false);
  const [nextGameId, setNextGameId] = React.useState<string | null>(null);
  const [launchingGame, setLaunchingGame] = React.useState(false);

  // Find the user's season team if one is configured.
  const userSeasonTeamId = React.useMemo(() => {
    if (!season?.userCustomTeamId) return null;
    return seasonTeams.find((t) => t.customTeamId === season.userCustomTeamId)?.id ?? null;
  }, [season, seasonTeams]);

  const handleSimulateDay = React.useCallback(async () => {
    if (!seasonId) return;
    setSimError(null);
    setNextGameReady(false);
    setNextGameId(null);
    setSimulating(true);
    try {
      if (userSeasonTeamId) {
        const result = await advanceSeason({ seasonId, userSeasonTeamId });
        if (result.nextGameId !== null) {
          setNextGameReady(true);
          setNextGameId(result.nextGameId);
        }
      } else {
        await simulateNextDay(seasonId);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Unable to simulate games. Please try again.";
      appLog.error("[SeasonHomePage] simulate error:", err);
      setSimError(msg);
    } finally {
      setSimulating(false);
    }
  }, [seasonId, userSeasonTeamId]);

  const handlePlayNextGame = React.useCallback(
    async (asManager: boolean) => {
      if (!nextGameId || !seasonId) return;
      setLaunchingGame(true);
      try {
        const db = await getDb();
        const gameDoc = await db.seasonGames.findOne({ selector: { id: nextGameId } }).exec();
        if (!gameDoc) throw new Error("Game record not found");
        const game = gameDoc.toJSON() as unknown as SeasonGameRecord;
        const [homeTeamDoc, awayTeamDoc] = await Promise.all([
          db.seasonTeams.findOne({ selector: { id: game.homeSeasonTeamId } }).exec(),
          db.seasonTeams.findOne({ selector: { id: game.awaySeasonTeamId } }).exec(),
        ]);
        if (!homeTeamDoc || !awayTeamDoc) throw new Error("Season team record not found");
        const homeSeasonTeam = homeTeamDoc.toJSON() as unknown as SeasonTeamRecord;
        const awaySeasonTeam = awayTeamDoc.toJSON() as unknown as SeasonTeamRecord;
        // Derive managed side from actual game record (user may be home or away).
        let managedTeam: 0 | 1 | null = null;
        if (asManager && userSeasonTeamId) {
          managedTeam = game.homeSeasonTeamId === userSeasonTeamId ? 1 : 0;
        }
        const setup = await buildSeasonGameSetup(
          db,
          game,
          homeSeasonTeam,
          awaySeasonTeam,
          managedTeam,
        );
        const state: GameLocationState = { pendingGameSetup: setup, pendingLoadSave: null };
        navigate("/game", { state });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unable to launch game. Please try again.";
        appLog.error("[SeasonHomePage] launch game error:", err);
        setSimError(msg);
      } finally {
        setLaunchingGame(false);
      }
    },
    [nextGameId, seasonId, userSeasonTeamId, navigate],
  );

  const gamesQuery = React.useMemo(
    () => ({
      selector: { seasonId: seasonId ?? "", status: "completed" as const },
    }),
    [seasonId],
  );

  const { results: gameResults, loading: gamesLoading } = useLiveRxQuery<SeasonGameRecord>({
    collection: "seasonGames",
    query: gamesQuery,
  });

  const completedGames = React.useMemo(
    () => gameResults.map((d) => d.toJSON() as unknown as SeasonGameRecord),
    [gameResults],
  );

  const seasonTeamIds = React.useMemo(
    () => seasonTeams.map((t: SeasonTeamRecord) => t.id),
    [seasonTeams],
  );

  const standings = React.useMemo(
    () => deriveStandings(completedGames, seasonTeamIds),
    [completedGames, seasonTeamIds],
  );

  // Build a lookup map: seasonTeamId → customTeamId → team name from rosterSnapshot
  const teamNameById = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const t of seasonTeams) {
      const snap = t.rosterSnapshot as Record<string, unknown>;
      const city = typeof snap.city === "string" && snap.city ? snap.city : "";
      const snapName = typeof snap.name === "string" ? snap.name : t.customTeamId;
      map[t.id] = city ? `${city} ${snapName}` : snapName;
    }
    return map;
  }, [seasonTeams]);

  if (loading || gamesLoading) {
    return (
      <PageContainer data-testid="season-home">
        <PageHeader>
          <BackBtn type="button" onClick={() => navigate("/leagues")} aria-label="Back to leagues">
            ← Leagues
          </BackBtn>
        </PageHeader>
        <EmptyState title="Loading…" body="Loading season data." />
      </PageContainer>
    );
  }

  if (!season) {
    return (
      <PageContainer data-testid="season-home">
        <PageHeader>
          <BackBtn type="button" onClick={() => navigate("/leagues")} aria-label="Back to leagues">
            ← Leagues
          </BackBtn>
        </PageHeader>
        <EmptyState title="Season not found" body="This season does not exist." />
      </PageContainer>
    );
  }

  const statusLabel =
    season.status === "active" ? "Active" : season.status === "complete" ? "Complete" : "Abandoned";

  const championName =
    season.status === "complete" && season.championTeamId
      ? (teamNameById[season.championTeamId] ?? null)
      : null;

  return (
    <PageContainer data-testid="season-home">
      <PageHeader>
        <BackBtn type="button" onClick={() => navigate("/leagues")} aria-label="Back to leagues">
          ← Leagues
        </BackBtn>
      </PageHeader>

      <SeasonTitle>
        {season.name} <StatusChip $status={season.status}>{statusLabel}</StatusChip>
      </SeasonTitle>

      {championName !== null && (
        <ChampionBanner role="status" aria-label="Season champion">
          🏆 Champion: {championName}
        </ChampionBanner>
      )}

      <SeasonMeta>
        <GameDayRow>
          Day {season.currentGameDay} / {getTotalGameDays(season.preset, season.seasonLength)}
        </GameDayRow>
        <SeasonProgress
          value={season.currentGameDay}
          max={getTotalGameDays(season.preset, season.seasonLength)}
          aria-label={`Season progress: day ${season.currentGameDay} of ${getTotalGameDays(season.preset, season.seasonLength)}`}
        />
      </SeasonMeta>

      {standings.length > 0 ? (
        <StandingsTable aria-label="Standings">
          <thead>
            <tr>
              <StandingsTh scope="col">Team</StandingsTh>
              <StandingsTh scope="col" aria-label="Wins">
                W
              </StandingsTh>
              <StandingsTh scope="col" aria-label="Losses">
                L
              </StandingsTh>
              <StandingsTh scope="col" aria-label="Win percentage">
                PCT
              </StandingsTh>
              <StandingsTh scope="col" aria-label="Run differential">
                RD
              </StandingsTh>
            </tr>
          </thead>
          <tbody>
            {standings.map((row, i) => (
              <StandingsRow
                key={row.seasonTeamId}
                $rank={i}
                onClick={() => navigate(`/leagues/${seasonId}/teams/${row.seasonTeamId}`)}
                title="View team"
              >
                <StandingsTd>
                  <StandingsTeamName>{teamNameById[row.seasonTeamId] ?? "—"}</StandingsTeamName>
                </StandingsTd>
                <StandingsTd>{row.wins}</StandingsTd>
                <StandingsTd>{row.losses}</StandingsTd>
                <StandingsTd>{row.winPct.toFixed(3).replace(/^0/, "")}</StandingsTd>
                <StandingsTd>
                  {row.runDifferential >= 0 ? "+" : ""}
                  {row.runDifferential}
                </StandingsTd>
              </StandingsRow>
            ))}
          </tbody>
        </StandingsTable>
      ) : (
        <EmptyState
          title="No games played yet"
          body="Standings will appear as games are completed."
        />
      )}

      {season.status === "active" && (
        <SimulateSection>
          <SimulateButton
            type="button"
            onClick={handleSimulateDay}
            disabled={simulating}
            data-testid="simulate-day-button"
          >
            {simulating
              ? "Simulating…"
              : userSeasonTeamId
                ? "▶ Advance Season"
                : "▶ Simulate Next Day"}
          </SimulateButton>
          {nextGameReady && (
            <>
              <AdvanceReadyMsg data-testid="next-game-ready-msg">
                Your next game is ready!
              </AdvanceReadyMsg>
              <GameActionRow data-testid="next-game-action-row">
                <GameActionBtn
                  type="button"
                  $variant="primary"
                  onClick={() => {
                    void handlePlayNextGame(true);
                  }}
                  disabled={launchingGame}
                  data-testid="play-next-game-button"
                >
                  {launchingGame ? "Loading…" : "▶ Play in Manager Mode"}
                </GameActionBtn>
                <GameActionBtn
                  type="button"
                  $variant="secondary"
                  onClick={() => {
                    void handlePlayNextGame(false);
                  }}
                  disabled={launchingGame}
                  data-testid="watch-next-game-button"
                >
                  👁 Watch
                </GameActionBtn>
              </GameActionRow>
            </>
          )}
          {simError !== null && <SimulateError>{simError}</SimulateError>}
        </SimulateSection>
      )}

      <NavCardGrid>
        <NavCard>
          <NavCardLink
            href={`/leagues/${seasonId}/schedule`}
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              navigate(`/leagues/${seasonId}/schedule`);
            }}
            data-testid="season-nav-schedule"
          >
            <NavCardTitle>Schedule</NavCardTitle>
            <NavCardSub>Full day-by-day schedule and results</NavCardSub>
          </NavCardLink>
        </NavCard>
      </NavCardGrid>
    </PageContainer>
  );
};

// ---------------------------------------------------------------------------
// Route wrapper — provides DB + RxDatabaseProvider via SeasonContextProvider
// ---------------------------------------------------------------------------

const SeasonHomePage: React.FunctionComponent = () => {
  return (
    <SeasonContextProvider>
      <SeasonHomePageInner />
    </SeasonContextProvider>
  );
};

export default SeasonHomePage;
