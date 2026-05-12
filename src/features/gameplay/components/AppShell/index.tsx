import * as React from "react";

import VolumeControls from "@feat/gameplay/components/GameControls/VolumeControls";
import { useHomeScreenMusic } from "@feat/gameplay/hooks/useHomeScreenMusic";
import { useVolumeControls } from "@feat/gameplay/hooks/useVolumeControls";
import { useAppSession } from "@shared/context/AppSessionContext";
import { Outlet, useMatches, useNavigate } from "react-router";
import { useSessionStorage } from "usehooks-ts";

import type { AppShellOutletContext, ExhibitionGameSetup, SaveRecord } from "@storage/types";

import { AppVolumeBar } from "./styles";

export type { AppShellOutletContext, ExhibitionGameSetup, GameLocationState } from "@storage/types";

const AppShell: React.FunctionComponent = () => {
  const navigate = useNavigate();
  const matches = useMatches();
  const { handleGameSessionStarted, handleGameOver } = useAppSession();
  // AppShell only writes — the stored value is read by ExhibitionGamePage on arrival.
  const [, setPendingExhibitionSetup] = useSessionStorage<ExhibitionGameSetup | null>(
    "pendingExhibitionSetup",
    null,
  );

  const isGameRoute = matches.some(
    (m) => (m.handle as { isGameRoute?: boolean } | null)?.isGameRoute === true,
  );

  const volume = useVolumeControls();
  // Pass alertVolume = 0 on /game to stop music (game has its own audio: fanfare, chimes, stretch).
  useHomeScreenMusic(isGameRoute ? 0 : volume.alertVolume);

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

  /** Called from /exhibition/new — stores the setup in sessionStorage and navigates to /game/exhibition. */
  const handleStartFromExhibition = React.useCallback(
    (setup: ExhibitionGameSetup) => {
      setPendingExhibitionSetup(setup);
      navigate("/game/exhibition");
    },
    [navigate, setPendingExhibitionSetup],
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
      onBackToHome: handleBackToHome,
      onGameOver: handleGameOver,
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
      handleBackToHome,
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
