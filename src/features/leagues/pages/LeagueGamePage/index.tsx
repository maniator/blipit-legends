import * as React from "react";

import AppLoadingFallback from "@feat/gameplay/components/AppLoadingFallback";
import Game from "@feat/gameplay/components/Game";
import { GameSessionProvider } from "@feat/gameplay/context/index";
import { deriveLeagueSession } from "@feat/gameplay/utils/gameSessionDerive";
import type { SeasonGameRecord, SeasonTeamRecord } from "@feat/league/storage/types";
import { buildSeasonGameSetup } from "@feat/leagues/utils/buildSeasonGameSetup";
import { useNavigate, useOutletContext, useParams } from "react-router";

import { getDb } from "@storage/db";
import type { AppShellOutletContext, ExhibitionGameSetup, SeasonRecord } from "@storage/types";

type FetchState =
  | { status: "loading" }
  | { status: "ready"; setup: ExhibitionGameSetup; seasonId: string; managedTeamIdx: 0 | 1 | null }
  | { status: "error"; message: string }
  | { status: "not_found" };

const LeagueGamePage: React.FunctionComponent = () => {
  const ctx = useOutletContext<AppShellOutletContext>();
  const navigate = useNavigate();
  const { seasonGameId } = useParams<{ seasonGameId: string }>();

  const [fetchState, setFetchState] = React.useState<FetchState>({ status: "loading" });

  const setupRef = React.useRef<ExhibitionGameSetup | null>(null);

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

        let managedTeamIdx: 0 | 1 | null = null;
        if (seasonDoc) {
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
          setupRef.current = setup;
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
  }, [seasonGameId]);

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

  const handleConsumeSetup = React.useCallback(() => {
    setupRef.current = null;
  }, []);

  const handleConsumePendingLoad = React.useCallback(() => {}, []);

  const handleNewGame = React.useCallback(() => {
    if (fetchState.status === "ready") {
      navigate(`/leagues/${fetchState.seasonId}/schedule`);
    } else {
      navigate("/leagues");
    }
  }, [fetchState, navigate]);

  if (fetchState.status === "loading") {
    return <AppLoadingFallback label="Loading game…" />;
  }

  if (fetchState.status === "not_found" || fetchState.status === "error") {
    const message =
      fetchState.status === "error" ? fetchState.message : "Game not found. Redirecting…";
    return <AppLoadingFallback label={message} />;
  }

  return (
    <GameSessionProvider value={deriveLeagueSession(seasonGameId!, fetchState.managedTeamIdx)}>
      <Game
        onBackToHome={ctx.onBackToHome}
        onNewGame={handleNewGame}
        onGameSessionStarted={ctx.onGameSessionStarted}
        pendingGameSetup={fetchState.setup}
        onConsumeGameSetup={handleConsumeSetup}
        pendingLoadSave={null}
        onConsumePendingLoad={handleConsumePendingLoad}
        onGameOver={ctx.onGameOver}
      />
    </GameSessionProvider>
  );
};

export default LeagueGamePage;
