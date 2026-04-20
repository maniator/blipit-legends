import * as React from "react";

import VolumeControls from "@feat/gameplay/components/GameControls/VolumeControls";
import { useHomeScreenMusic } from "@feat/gameplay/hooks/useHomeScreenMusic";
import { useVolumeControls } from "@feat/gameplay/hooks/useVolumeControls";
import { Outlet, useLocation, useNavigate } from "react-router";

import { getDb } from "@storage/db";
import type { AppShellOutletContext, ExhibitionGameSetup, SaveRecord } from "@storage/types";

import { AppVolumeBar } from "./styles";

export type { AppShellOutletContext, ExhibitionGameSetup, GameLocationState } from "@storage/types";

const AppShell: React.FunctionComponent = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // True only once a real game session has been started or loaded — gates Resume.
  const [hasActiveSession, setHasActiveSession] = React.useState(false);
  // True once at least one completed game has been persisted or a game just ended — gates Career Stats.
  const [hasCareerStats, setHasCareerStats] = React.useState(false);

  const isGameRoute = location.pathname === "/game";

  const volume = useVolumeControls();
  // Pass alertVolume = 0 on /game to stop music (game has its own audio: fanfare, chimes, stretch).
  useHomeScreenMusic(isGameRoute ? 0 : volume.alertVolume);

  const handleGameSessionStarted = React.useCallback(() => {
    setHasActiveSession(true);
  }, []);

  const handleGameOver = React.useCallback(() => {
    setHasActiveSession(false);
    // A finished game writes career history; reveal Career Stats immediately.
    setHasCareerStats(true);
  }, []);

  // Only probe the DB when the user is on the home route to avoid initializing
  // RxDB on every deep-link (e.g. /game, /help).
  React.useEffect(() => {
    if (location.pathname !== "/") return;

    let cancelled = false;

    async function loadCareerStatsAvailability() {
      try {
        const db = await getDb();
        const anyCompletedGame = await db.completedGames.findOne().exec();
        if (!cancelled) {
          // Use functional update so a true set by handleGameOver is never cleared.
          setHasCareerStats((prev) => prev || Boolean(anyCompletedGame));
        }
      } catch {
        // On DB error, leave hasCareerStats unchanged (don't hide it if it was already true).
      }
    }

    void loadCareerStatsAvailability();

    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  const handleResumeCurrent = React.useCallback(() => {
    navigate("/game");
  }, [navigate]);

  const handleNewGame = React.useCallback(() => {
    // Primary "New Game" path from Home: navigate to the Exhibition Setup page.
    navigate("/exhibition/new");
  }, [navigate]);

  const handleLoadSaves = React.useCallback(() => {
    navigate("/saves");
  }, [navigate]);

  /** Called from the saves page — navigates to /game with the save as location state. */
  const handleLoadSave = React.useCallback(
    (slot: SaveRecord) => {
      navigate("/game", { state: { pendingLoadSave: slot, pendingGameSetup: null } });
    },
    [navigate],
  );

  const handleBackToHome = React.useCallback(() => {
    navigate("/");
  }, [navigate]);

  const handleManageTeams = React.useCallback(() => {
    navigate("/teams");
  }, [navigate]);

  const handleHelp = React.useCallback(() => {
    navigate("/help");
  }, [navigate]);

  const handleContact = React.useCallback(() => {
    navigate("/contact");
  }, [navigate]);

  const handleCareerStats = React.useCallback(() => {
    navigate("/stats");
  }, [navigate]);

  /** Called from /exhibition/new — navigates to /game with the setup as location state. */
  const handleStartFromExhibition = React.useCallback(
    (setup: ExhibitionGameSetup) => {
      navigate("/game", { state: { pendingGameSetup: setup, pendingLoadSave: null } });
    },
    [navigate],
  );

  const outletContext: AppShellOutletContext = React.useMemo(
    () => ({
      onStartGame: handleStartFromExhibition,
      onLoadSave: handleLoadSave,
      onGameSessionStarted: handleGameSessionStarted,
      onNewGame: handleNewGame,
      onLoadSaves: handleLoadSaves,
      onManageTeams: handleManageTeams,
      onResumeCurrent: handleResumeCurrent,
      onHelp: handleHelp,
      onContact: handleContact,
      onCareerStats: handleCareerStats,
      hasCareerStats,
      onBackToHome: handleBackToHome,
      hasActiveSession,
      onGameOver: handleGameOver,
      onLeague: () => undefined,
      hasLeague: false,
    }),
    [
      handleStartFromExhibition,
      handleLoadSave,
      handleGameSessionStarted,
      handleNewGame,
      handleLoadSaves,
      handleManageTeams,
      handleResumeCurrent,
      handleHelp,
      handleContact,
      handleCareerStats,
      hasCareerStats,
      handleBackToHome,
      hasActiveSession,
      handleGameOver,
    ],
  );

  return (
    <>
      <Outlet context={outletContext} />
      {!isGameRoute && (
        <AppVolumeBar data-testid="app-volume-bar">
          <VolumeControls
            announcementVolume={volume.announcementVolume}
            alertVolume={volume.alertVolume}
            onAnnouncementVolumeChange={volume.handleAnnouncementVolumeChange}
            onAlertVolumeChange={volume.handleAlertVolumeChange}
            onToggleAnnouncementMute={volume.handleToggleAnnouncementMute}
            onToggleAlertMute={volume.handleToggleAlertMute}
          />
        </AppVolumeBar>
      )}
    </>
  );
};

export default AppShell;
