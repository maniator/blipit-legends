import * as React from "react";

import type { SeasonGameRecord, SeasonTeamRecord } from "@feat/league/storage/types";
import { SeasonContextProvider, useSeasonContext } from "@feat/leagues/context/SeasonContext";
import EmptyState from "@shared/components/EmptyState";
import { BackBtn, PageContainer, PageHeader } from "@shared/components/PageLayout/styles";
import { useNavigate, useParams } from "react-router";
import { useLiveRxQuery } from "rxdb/plugins/react";

import { PageTitle, RecordLine, ResultChip, ResultsTable, ResultsTd, ResultsTh, ResultsTr } from "./styles"; // prettier-ignore

// ---------------------------------------------------------------------------
// Inner component — requires SeasonContextProvider
// ---------------------------------------------------------------------------

const SeasonTeamPageInner: React.FunctionComponent = () => {
  const navigate = useNavigate();
  const { seasonId, seasonTeamId } = useParams<{ seasonId: string; seasonTeamId: string }>();
  const { season, seasonTeams, loading } = useSeasonContext();

  const gamesQuery = React.useMemo(
    () => ({
      selector: {
        seasonId: seasonId ?? "",
        $or: [{ homeSeasonTeamId: seasonTeamId ?? "" }, { awaySeasonTeamId: seasonTeamId ?? "" }],
      },
      sort: [{ gameDay: "asc" as const }],
    }),
    [seasonId, seasonTeamId],
  );

  const { results: gameResults, loading: gamesLoading } = useLiveRxQuery<SeasonGameRecord>({
    collection: "seasonGames",
    query: gamesQuery,
  });

  const games = React.useMemo(
    () => gameResults.map((d) => d.toJSON() as unknown as SeasonGameRecord),
    [gameResults],
  );

  const teamRecord = React.useMemo<SeasonTeamRecord | null>(
    () => seasonTeams.find((t) => t.id === seasonTeamId) ?? null,
    [seasonTeams, seasonTeamId],
  );

  // Build lookup: seasonTeamId → abbreviation from rosterSnapshot
  const abbrById = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const t of seasonTeams) {
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

  if (loading || gamesLoading) {
    return (
      <PageContainer data-testid="season-team">
        <PageHeader>
          <BackBtn
            type="button"
            onClick={() => navigate(`/leagues/${seasonId}`)}
            aria-label="Back to season"
          >
            ← Season
          </BackBtn>
        </PageHeader>
        <EmptyState title="Loading…" body="Loading team data." />
      </PageContainer>
    );
  }

  if (!season || !teamRecord) {
    return (
      <PageContainer data-testid="season-team">
        <PageHeader>
          <BackBtn
            type="button"
            onClick={() => navigate(`/leagues/${seasonId}`)}
            aria-label="Back to season"
          >
            ← Season
          </BackBtn>
        </PageHeader>
        <EmptyState title="Team not found" body="This team does not exist in the season." />
      </PageContainer>
    );
  }

  const snap = teamRecord.rosterSnapshot as Record<string, unknown>;
  const teamName = typeof snap.name === "string" ? snap.name : teamRecord.customTeamId;

  const completedGames = games.filter((g) => g.status === "completed");

  let wins = 0;
  let losses = 0;
  let ties = 0;

  for (const g of completedGames) {
    const bs = g.boxscore as Record<string, unknown> | null | undefined;
    const homeScore = bs && typeof bs.homeScore === "number" ? bs.homeScore : null;
    const awayScore = bs && typeof bs.awayScore === "number" ? bs.awayScore : null;
    if (homeScore === null || awayScore === null) continue;

    const isHome = g.homeSeasonTeamId === seasonTeamId;
    const myScore = isHome ? homeScore : awayScore;
    const oppScore = isHome ? awayScore : homeScore;

    if (myScore > oppScore) wins++;
    else if (myScore < oppScore) losses++;
    else ties++;
  }

  return (
    <PageContainer data-testid="season-team">
      <PageHeader>
        <BackBtn
          type="button"
          onClick={() => navigate(`/leagues/${seasonId}`)}
          aria-label="Back to season"
        >
          ← {season.name}
        </BackBtn>
      </PageHeader>

      <PageTitle>{teamName}</PageTitle>
      <RecordLine>
        {wins}–{losses}
        {ties > 0 ? `–${ties}` : ""}
      </RecordLine>

      {completedGames.length === 0 ? (
        <EmptyState
          title="No games played yet"
          body="Results will appear as games are completed."
        />
      ) : (
        <ResultsTable aria-label="Game results">
          <thead>
            <tr>
              <ResultsTh scope="col">Day</ResultsTh>
              <ResultsTh scope="col">Opponent</ResultsTh>
              <ResultsTh scope="col">Score</ResultsTh>
              <ResultsTh scope="col">Result</ResultsTh>
            </tr>
          </thead>
          <tbody>
            {completedGames.map((g) => {
              const bs = g.boxscore as Record<string, unknown> | null | undefined;
              const homeScore = bs && typeof bs.homeScore === "number" ? bs.homeScore : null;
              const awayScore = bs && typeof bs.awayScore === "number" ? bs.awayScore : null;
              const isHome = g.homeSeasonTeamId === seasonTeamId;
              const oppId = isHome ? g.awaySeasonTeamId : g.homeSeasonTeamId;
              const oppAbbr = abbrById[oppId] ?? "OPP";
              const myScore = isHome ? homeScore : awayScore;
              const oppScore = isHome ? awayScore : homeScore;

              let result: "W" | "L" | "T" = "T";
              if (myScore !== null && oppScore !== null) {
                if (myScore > oppScore) result = "W";
                else if (myScore < oppScore) result = "L";
              }

              const scoreDisplay =
                myScore !== null && oppScore !== null ? `${myScore}–${oppScore}` : "—";

              return (
                <ResultsTr key={g.id}>
                  <ResultsTd>{g.gameDay + 1}</ResultsTd>
                  <ResultsTd>{oppAbbr}</ResultsTd>
                  <ResultsTd>{scoreDisplay}</ResultsTd>
                  <ResultsTd>
                    <ResultChip $result={result}>{result}</ResultChip>
                  </ResultsTd>
                </ResultsTr>
              );
            })}
          </tbody>
        </ResultsTable>
      )}
    </PageContainer>
  );
};

// ---------------------------------------------------------------------------
// Route wrapper — provides DB + RxDatabaseProvider via SeasonContextProvider
// ---------------------------------------------------------------------------

const SeasonTeamPage: React.FunctionComponent = () => (
  <SeasonContextProvider>
    <SeasonTeamPageInner />
  </SeasonContextProvider>
);

export default SeasonTeamPage;
