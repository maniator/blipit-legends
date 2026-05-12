import * as React from "react";

import AppLoadingFallback from "@feat/gameplay/components/AppLoadingFallback";
import Game from "@feat/gameplay/components/Game";
import GamePageWrapper from "@feat/gameplay/components/GamePageWrapper";
import { GameSessionProvider } from "@feat/gameplay/context/index";
import { deriveLeagueSession } from "@feat/gameplay/utils/gameSessionDerive";
import type { SeasonGameRecord, SeasonTeamRecord } from "@feat/league/storage/types";
import { buildSeasonGameSetup } from "@feat/leagues/utils/buildSeasonGameSetup";
import { useLocation, useNavigate, useOutletContext, useParams } from "react-router";

import { getDb } from "@storage/db";
import type { AppShellOutletContext, ExhibitionGameSetup, SeasonRecord } from "@storage/types";

/** Route state shape passed by SeasonSchedulePage when launching a league game. */
interface LeagueGameLocationState {
  /** When true the user clicked "Watch" — managed-team derivation is skipped. */
  spectatorMode?: boolean;
}

type FetchState =
  | { status: "loading" }
  | { status: "ready"; setup: ExhibitionGameSetup; seasonId: string; managedTeamIdx: 0 | 1 | null }
  | { status: "error"; message: string }
  | { status: "not_found" };

const LeagueGamePage: React.FunctionComponent = () => {
  const ctx = useOutletContext<AppShellOutletContext>();
  const navigate = useNavigate();
  const location = useLocation();
  const { seasonGameId } = useParams<{ seasonGameId: string }>();

  // When the user clicks "Watch" on the schedule, SeasonSchedulePage passes
  // { spectatorMode: true } in route state. If present and true, we skip
  // managed-team derivation even when the user has a team in the season.
  const spectatorMode = Boolean((location.state as LeagueGameLocationState | null)?.spectatorMode);

  const [fetchState, setFetchState] = React.useState<FetchState>({ status: "loading" });

  React.useEffect(() => {
    if (!seasonGameId) {
      setFetchState({ status: "not_found" });
      return;
    }

    let cancelled = false;

    async function fetchGameDataAndBuildSetup() {
      try {
        const db = await getDb();

        const gameDoc = await db.seasonGames.findOne({ selector: { id: seasonGameId } }).exec();
        if (!gameDoc) {
          if (!cancelled) setFetchState({ status: "not_found" });
          return;
        }
        const game = gameDoc.toJSON() as unknown as SeasonGameRecord;

        const [seasonDoc, homeTeamDoc, awayTeamDoc] = await Promise.all([
          db.seasons.findOne({ selector: { id: game.seasonId } }).exec(),
          db.seasonTeams.findOne({ selector: { id: game.homeSeasonTeamId } }).exec(),
          db.seasonTeams.findOne({ selector: { id: game.awaySeasonTeamId } }).exec(),
        ]);

        if (!homeTeamDoc || !awayTeamDoc) {
          if (!cancelled)
            setFetchState({ status: "error", message: "Season team records not found." });
          return;
        }

        const homeSeasonTeam = homeTeamDoc.toJSON() as unknown as SeasonTeamRecord;
        const awaySeasonTeam = awayTeamDoc.toJSON() as unknown as SeasonTeamRecord;

        // Derive managed-team index from season context, then override to null
        // when the user explicitly clicked "Watch" (spectatorMode route state).
        let managedTeamIdx: 0 | 1 | null = null;
        if (!spectatorMode && seasonDoc) {
          const season = seasonDoc.toJSON() as unknown as SeasonRecord;
          if (season.userCustomTeamId) {
            if (homeSeasonTeam.customTeamId === season.userCustomTeamId) {
              managedTeamIdx = 1;
            } else if (awaySeasonTeam.customTeamId === season.userCustomTeamId) {
              managedTeamIdx = 0;
            }
          }
        }

        const setup = await buildSeasonGameSetup(
          db,
          game,
          homeSeasonTeam,
          awaySeasonTeam,
          managedTeamIdx,
        );

        if (!cancelled) {
          setFetchState({ status: "ready", setup, seasonId: game.seasonId, managedTeamIdx });
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Unable to load game.";
          setFetchState({ status: "error", message });
        }
      }
    }

    void fetchGameDataAndBuildSetup();

    return () => {
      cancelled = true;
    };
  }, [seasonGameId, spectatorMode]);

  // Auto-redirect after not_found or error
  React.useEffect(() => {
    if (fetchState.status === "not_found") {
      navigate("/leagues", { replace: true });
    }
  }, [fetchState.status, navigate]);

  // Auto-redirect to /leagues after a brief error display
  React.useEffect(() => {
    if (fetchState.status !== "error") return;
    const timer = setTimeout(() => {
      navigate("/leagues", { replace: true });
    }, 2000);
    return () => clearTimeout(timer);
  }, [fetchState, navigate]);

  // onConsumeGameSetup is called by Game when the initial setup has been applied.
  // pendingGameSetup is driven by fetchState.setup (not a ref), so this is a no-op.
  const handleConsumeSetup = React.useCallback(() => {}, []);

  const handleConsumePendingLoad = React.useCallback(() => {}, []);

  const fetchedSeasonId = fetchState.status === "ready" ? fetchState.seasonId : null;

  const navigateToSchedule = React.useCallback(() => {
    navigate(fetchedSeasonId ? `/leagues/${fetchedSeasonId}/schedule` : "/leagues");
  }, [fetchedSeasonId, navigate]);

  if (fetchState.status === "loading") {
    return <AppLoadingFallback label="Loading game…" />;
  }

  if (fetchState.status === "not_found" || fetchState.status === "error") {
    const message =
      fetchState.status === "error" ? fetchState.message : "Game not found. Redirecting…";
    return <AppLoadingFallback label={message} />;
  }

  return (
    <GamePageWrapper>
      {(onSavingStateChange) => (
        <GameSessionProvider value={deriveLeagueSession(seasonGameId!, fetchState.managedTeamIdx)}>
          <Game
            onBackToHome={navigateToSchedule}
            backLabel="← Schedule"
            onNewGame={navigateToSchedule}
            onGameSessionStarted={ctx.onGameSessionStarted}
            pendingGameSetup={fetchState.setup}
            onConsumeGameSetup={handleConsumeSetup}
            pendingLoadSave={null}
            onConsumePendingLoad={handleConsumePendingLoad}
            onSavingStateChange={onSavingStateChange}
            onGameOver={ctx.onGameOver}
          />
        </GameSessionProvider>
      )}
    </GamePageWrapper>
  );
};

export default LeagueGamePage;
