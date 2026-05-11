import * as React from "react";

import type { SeasonGameRecord, SeasonTeamRecord } from "@feat/league/storage/types";
import { GameActionBtn } from "@feat/leagues/components/styles";
import { SeasonContextProvider, useSeasonContext } from "@feat/leagues/context/SeasonContext";
import { buildSeasonGameSetup } from "@feat/leagues/utils/buildSeasonGameSetup";
import EmptyState from "@shared/components/EmptyState";
import { BackBtn, PageContainer, PageHeader } from "@shared/components/PageLayout/styles";
import { appLog } from "@shared/utils/logger";
import { useNavigate, useParams } from "react-router";
import { useLiveRxQuery } from "rxdb/plugins/react";

import { getDb } from "@storage/db";
import type { GameLocationState } from "@storage/types";

import {
  DayHeader,
  DaySection,
  GameRow,
  GameRowActions,
  GameRowAway,
  GameRowHome,
  GameRowResult,
  GameRowStatus,
  LaunchErrorMsg,
  PageTitle,
  ScheduleList,
} from "./styles";

// ---------------------------------------------------------------------------
// Inner component — requires SeasonContextProvider
// ---------------------------------------------------------------------------

const SeasonSchedulePageInner: React.FunctionComponent = () => {
  const navigate = useNavigate();
  const { seasonId } = useParams<{ seasonId: string }>();
  const { season, seasonTeams, loading } = useSeasonContext();

  const gamesQuery = React.useMemo(
    () => ({ selector: { seasonId: seasonId ?? "" }, sort: [{ gameDay: "asc" as const }] }),
    [seasonId],
  );

  const { results: gameResults, loading: gamesLoading } = useLiveRxQuery<SeasonGameRecord>({
    collection: "seasonGames",
    query: gamesQuery,
  });

  const games = React.useMemo(
    () => gameResults.map((d) => d.toJSON() as unknown as SeasonGameRecord),
    [gameResults],
  );

  const teamNameById = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const t of seasonTeams as SeasonTeamRecord[]) {
      const snap = t.rosterSnapshot as Record<string, unknown>;
      const abbrev =
        typeof snap.abbreviation === "string"
          ? snap.abbreviation
          : typeof snap.name === "string"
            ? snap.name.slice(0, 3).toUpperCase()
            : t.id.slice(0, 3);
      map[t.id] = abbrev;
    }
    return map;
  }, [seasonTeams]);

  // Build a lookup: seasonTeamId → SeasonTeamRecord for game launch.
  const seasonTeamById = React.useMemo(() => {
    const map: Record<string, SeasonTeamRecord> = {};
    for (const t of seasonTeams as SeasonTeamRecord[]) {
      map[t.id] = t;
    }
    return map;
  }, [seasonTeams]);

  // Which season team ID does the user manage (if any)?
  const userSeasonTeamId = React.useMemo(() => {
    if (!season?.userCustomTeamId) return null;
    return seasonTeams.find((t) => t.customTeamId === season.userCustomTeamId)?.id ?? null;
  }, [season, seasonTeams]);

  const [launchingGameId, setLaunchingGameId] = React.useState<string | null>(null);
  const [launchError, setLaunchError] = React.useState<string | null>(null);

  const handleLaunchGame = React.useCallback(
    async (game: SeasonGameRecord, managedTeam: 0 | 1 | null) => {
      setLaunchingGameId(game.id);
      setLaunchError(null);
      try {
        const db = await getDb();
        const homeSeasonTeam = seasonTeamById[game.homeSeasonTeamId];
        const awaySeasonTeam = seasonTeamById[game.awaySeasonTeamId];
        if (!homeSeasonTeam || !awaySeasonTeam) throw new Error("Season team record not found");
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
        const msg = err instanceof Error ? err.message : "Unable to launch game.";
        appLog.error("[SeasonSchedulePage] launch game error:", err);
        setLaunchError(msg);
      } finally {
        setLaunchingGameId(null);
      }
    },
    [navigate, seasonTeamById],
  );

  // Group games by gameDay
  const byDay = React.useMemo(() => {
    const map = new Map<number, SeasonGameRecord[]>();
    for (const g of games) {
      const arr = map.get(g.gameDay) ?? [];
      arr.push(g);
      map.set(g.gameDay, arr);
    }
    return [...map.entries()].sort(([a], [b]) => a - b);
  }, [games]);

  if (loading || gamesLoading) {
    return (
      <PageContainer data-testid="season-schedule">
        <PageHeader>
          <BackBtn
            type="button"
            onClick={() => navigate(`/leagues/${seasonId}`)}
            aria-label="Back to season"
          >
            ← Season
          </BackBtn>
        </PageHeader>
        <PageTitle>Schedule</PageTitle>
        <EmptyState title="Loading…" body="Loading schedule data." />
      </PageContainer>
    );
  }

  if (!season) {
    return (
      <PageContainer data-testid="season-schedule">
        <PageHeader>
          <BackBtn type="button" onClick={() => navigate("/leagues")} aria-label="Back to leagues">
            ← Leagues
          </BackBtn>
        </PageHeader>
        <PageTitle>Schedule</PageTitle>
        <EmptyState title="Season not found" body="This season does not exist." />
      </PageContainer>
    );
  }

  return (
    <PageContainer data-testid="season-schedule">
      <PageHeader>
        <BackBtn
          type="button"
          onClick={() => navigate(`/leagues/${seasonId}`)}
          aria-label="Back to season"
        >
          ← {season.name}
        </BackBtn>
      </PageHeader>
      <PageTitle>Schedule</PageTitle>

      {byDay.length === 0 ? (
        <EmptyState title="No games scheduled" body="No games have been generated yet." />
      ) : (
        <ScheduleList>
          {launchError !== null && <LaunchErrorMsg role="alert">{launchError}</LaunchErrorMsg>}
          {byDay.map(([day, dayGames]) => (
            <DaySection key={day}>
              <DayHeader>Day {day + 1}</DayHeader>
              {dayGames.map((game) => {
                const homeAbbrev = teamNameById[game.homeSeasonTeamId] ?? "HOME";
                const awayAbbrev = teamNameById[game.awaySeasonTeamId] ?? "AWAY";
                const bs =
                  game.status === "completed" && game.boxscore
                    ? (game.boxscore as Record<string, unknown>)
                    : null;
                const homeScore = bs && typeof bs.homeScore === "number" ? bs.homeScore : null;
                const awayScore = bs && typeof bs.awayScore === "number" ? bs.awayScore : null;
                const isUserHome = userSeasonTeamId === game.homeSeasonTeamId;
                const isUserAway = userSeasonTeamId === game.awaySeasonTeamId;
                const isUserGame = isUserHome || isUserAway;
                // managedTeam: 1 = home, 0 = away — only meaningful when isUserGame is true
                const managedSide: 0 | 1 = isUserHome ? 1 : 0;
                const isLaunching = launchingGameId === game.id;
                return (
                  <GameRow key={game.id} data-testid={`game-row-${game.id}`}>
                    <GameRowAway>{awayAbbrev}</GameRowAway>
                    <span aria-hidden="true">@</span>
                    <GameRowHome>{homeAbbrev}</GameRowHome>
                    {game.status === "completed" && homeScore !== null && awayScore !== null ? (
                      <GameRowResult>
                        {awayScore}–{homeScore}
                      </GameRowResult>
                    ) : (
                      <>
                        <GameRowStatus $status={game.status}>
                          {game.status === "in_progress" ? "Live" : "—"}
                        </GameRowStatus>
                        <GameRowActions>
                          {isUserGame && (
                            <GameActionBtn
                              type="button"
                              $variant="primary"
                              onClick={() => {
                                void handleLaunchGame(game, managedSide);
                              }}
                              disabled={isLaunching}
                              aria-busy={isLaunching}
                              data-testid={`play-game-${game.id}`}
                              aria-label={
                                isLaunching
                                  ? "Loading game…"
                                  : `Play ${awayAbbrev} @ ${homeAbbrev} in Manager Mode`
                              }
                            >
                              {isLaunching ? "…" : "▶ Play"}
                            </GameActionBtn>
                          )}
                          <GameActionBtn
                            type="button"
                            $variant="secondary"
                            onClick={() => {
                              void handleLaunchGame(game, null);
                            }}
                            disabled={isLaunching}
                            aria-busy={isLaunching}
                            data-testid={`watch-game-${game.id}`}
                            aria-label={
                              isLaunching ? "Loading game…" : `Watch ${awayAbbrev} @ ${homeAbbrev}`
                            }
                          >
                            {isLaunching ? "…" : "👁 Watch"}
                          </GameActionBtn>
                        </GameRowActions>
                      </>
                    )}
                  </GameRow>
                );
              })}
            </DaySection>
          ))}
        </ScheduleList>
      )}
    </PageContainer>
  );
};

const SeasonSchedulePage: React.FunctionComponent = () => (
  <SeasonContextProvider>
    <SeasonSchedulePageInner />
  </SeasonContextProvider>
);

export default SeasonSchedulePage;
