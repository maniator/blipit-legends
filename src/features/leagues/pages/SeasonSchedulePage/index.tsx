import * as React from "react";

import type { SeasonGameRecord, SeasonTeamRecord } from "@feat/league/storage/types";
import { GameActionBtn } from "@feat/leagues/components/styles";
import { SeasonContextProvider, useSeasonContext } from "@feat/leagues/context/SeasonContext";
import EmptyState from "@shared/components/EmptyState";
import { BackBtn, PageContainer, PageHeader } from "@shared/components/PageLayout/styles";
import { useNavigate, useParams } from "react-router";
import { useLiveRxQuery } from "rxdb/plugins/react";

import {
  DayHeader,
  DaySection,
  GameRow,
  GameRowActions,
  GameRowAway,
  GameRowHome,
  GameRowResult,
  GameRowStatus,
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

  // Which season team ID does the user manage (if any)?
  const userSeasonTeamId = React.useMemo(() => {
    if (!season?.userCustomTeamId) return null;
    return seasonTeams.find((t) => t.customTeamId === season.userCustomTeamId)?.id ?? null;
  }, [season, seasonTeams]);

  const handleLaunchGame = React.useCallback(
    (game: SeasonGameRecord, _managedTeam: 0 | 1 | null) => {
      navigate(`/game/league/${game.id}`);
    },
    [navigate],
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
                return (
                  <GameRow key={game.id} data-testid={`game-row-${game.id}`}>
                    <GameRowAway>{awayAbbrev}</GameRowAway>
                    <span aria-hidden="true">@</span>
                    <GameRowHome>{homeAbbrev}</GameRowHome>
                    {game.status === "completed" && homeScore !== null && awayScore !== null ? (
                      <GameRowResult>
                        {awayScore}–{homeScore}
                      </GameRowResult>
                    ) : game.gameDay === season.currentGameDay ? (
                      <>
                        <GameRowStatus $status={game.status}>
                          {game.status === "in_progress" ? "Live" : "—"}
                        </GameRowStatus>
                        <GameRowActions>
                          {isUserGame && (
                            <GameActionBtn
                              type="button"
                              $variant="primary"
                              onClick={() => handleLaunchGame(game, managedSide)}
                              data-testid={`play-game-${game.id}`}
                              aria-label={`Play ${awayAbbrev} @ ${homeAbbrev} in Manager Mode`}
                            >
                              ▶ Play
                            </GameActionBtn>
                          )}
                          <GameActionBtn
                            type="button"
                            $variant="secondary"
                            onClick={() => handleLaunchGame(game, null)}
                            data-testid={`watch-game-${game.id}`}
                            aria-label={`Watch ${awayAbbrev} @ ${homeAbbrev}`}
                          >
                            👁 Watch
                          </GameActionBtn>
                        </GameRowActions>
                      </>
                    ) : (
                      <GameRowStatus $status={game.status}>—</GameRowStatus>
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
