import * as React from "react";

import type { SeasonGameRecord, SeasonTeamRecord } from "@feat/league/storage/types";
import { deriveStandings } from "@feat/league/utils/deriveStandings";
import { SeasonContextProvider, useSeasonContext } from "@feat/leagues/context/SeasonContext";
import EmptyState from "@shared/components/EmptyState";
import { BackBtn, PageContainer, PageHeader } from "@shared/components/PageLayout/styles";
import { useNavigate, useParams } from "react-router";
import { useLiveRxQuery } from "rxdb/plugins/react";

import {
  GameDayRow,
  NavCard,
  NavCardGrid,
  NavCardLink,
  NavCardSub,
  NavCardTitle,
  SeasonMeta,
  SeasonProgress,
  SeasonTitle,
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

const TOTAL_GAME_DAYS = 30;

const SeasonHomePageInner: React.FunctionComponent = () => {
  const navigate = useNavigate();
  const { seasonId } = useParams<{ seasonId: string }>();
  const { season, seasonTeams, loading } = useSeasonContext();

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
      const name = typeof snap.name === "string" ? snap.name : t.customTeamId;
      map[t.id] = name;
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

      <SeasonMeta>
        <GameDayRow>
          Day {season.currentGameDay} / {TOTAL_GAME_DAYS}
        </GameDayRow>
        <SeasonProgress
          value={season.currentGameDay}
          max={TOTAL_GAME_DAYS}
          aria-label={`Season progress: day ${season.currentGameDay} of ${TOTAL_GAME_DAYS}`}
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
