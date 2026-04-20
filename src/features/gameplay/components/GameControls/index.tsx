import * as React from "react";

import { resolveTeamLabel } from "@feat/customTeams/adapters/customTeamAdapter";
import { Strategy } from "@feat/gameplay/context/index";
import { useCustomTeams } from "@shared/hooks/useCustomTeams";

import type { SaveRecord } from "@storage/types";

import { SPEED_STEP_LABELS, SPEED_STEPS } from "./constants";
import ManagerModeControls from "./ManagerModeControls";
import {
  AutoPlayGroup,
  Button,
  Controls,
  HelpButton,
  LeagueSaveBanner,
  PausePlayButton,
  SpeedLabel,
  SpeedRow,
  SpeedSlider,
  ToggleLabel,
} from "./styles";
import { useGameControls } from "./useGameControls";
import VolumeControls from "./VolumeControls";

const DecisionPanel = React.lazy(() => import("@feat/gameplay/components/DecisionPanel"));
const InstructionsModal = React.lazy(() => import("@feat/help/components/InstructionsModal"));
const SavesModal = React.lazy(() => import("@feat/saves/components/SavesModal"));

type Props = {
  onNewGame?: () => void;
  gameStarted?: boolean;
  onLoadSave?: (slot: SaveRecord) => void;
  /** Routes back to the Home screen. When provided a "← Home" button is shown. */
  onBackToHome?: () => void;
  /** When true, shows a disabled "Saving…" button instead of "New Game". */
  isCommitting?: boolean;
  /** When provided and gameOver is true, shows "← Back to League" instead of "New Game". */
  onBackToLeague?: () => void;
  /** When true, shows a small info banner indicating this is a league save. */
  isLeagueSave?: boolean;
};

const GameControls: React.FunctionComponent<Props> = ({
  onNewGame,
  gameStarted = false,
  onLoadSave,
  onBackToHome,
  isCommitting = false,
  onBackToLeague,
  isLeagueSave = false,
}) => {
  const {
    speed,
    setSpeed,
    paused,
    setPaused,
    announcementVolume,
    alertVolume,
    managerMode,
    strategy,
    setStrategy,
    managedTeam,
    setManagedTeam,
    decisionValues,
    setDecisionValues,
    resetDecisionValues,
    teams,
    gameOver,
    notifPermission,
    handleManagerModeChange,
    handleRequestNotifPermission,
    handleAnnouncementVolumeChange,
    handleAlertVolumeChange,
    handleToggleAnnouncementMute,
    handleToggleAlertMute,
    currentSaveId,
    setCurrentSaveId,
  } = useGameControls({ gameStarted });

  const { teams: customTeamDocs } = useCustomTeams();
  // Resolve display labels for raw game-state team IDs (e.g. `ct_...` -> team name)
  const resolvedTeamLabels: [string, string] = [
    resolveTeamLabel(teams[0], customTeamDocs),
    resolveTeamLabel(teams[1], customTeamDocs),
  ];
  const speedIndex = Math.max(0, (SPEED_STEPS as readonly number[]).indexOf(speed));

  return (
    <>
      {isLeagueSave && (
        <LeagueSaveBanner>📋 League save — results already recorded</LeagueSaveBanner>
      )}
      <Controls>
        {onBackToHome && (
          <Button
            $variant="home"
            onClick={onBackToHome}
            disabled={isCommitting}
            data-testid="back-to-home-button"
          >
            ← Home
          </Button>
        )}
        {gameOver &&
          (onBackToLeague || onNewGame) &&
          (isCommitting ? (
            <Button $variant="new" disabled data-testid="new-game-button">
              Saving…
            </Button>
          ) : onBackToLeague ? (
            <Button $variant="home" onClick={onBackToLeague} data-testid="back-to-league-button">
              ← Back to League
            </Button>
          ) : (
            <Button $variant="new" onClick={onNewGame} data-testid="new-game-button">
              New Game
            </Button>
          ))}
        <React.Suspense
          fallback={
            <Button $variant="saves" disabled aria-label="Open saves panel">
              💾 Saves
            </Button>
          }
        >
          <SavesModal
            strategy={strategy}
            managedTeam={managedTeam}
            managerMode={managerMode}
            decisionValues={decisionValues}
            currentSaveId={currentSaveId}
            onSaveIdChange={setCurrentSaveId}
            onLoadSave={onLoadSave}
            gameStarted={gameStarted}
          />
        </React.Suspense>
        <React.Suspense
          fallback={
            <HelpButton disabled aria-label="How to play">
              ?
            </HelpButton>
          }
        >
          <InstructionsModal />
        </React.Suspense>
        <AutoPlayGroup>
          <SpeedRow>
            {gameStarted && !gameOver && (
              <PausePlayButton
                onClick={() => setPaused(!paused)}
                aria-label={paused ? "Resume game" : "Pause game"}
                data-testid="pause-play-button"
                title={paused ? "Resume" : "Pause"}
              >
                {paused ? "▶" : "⏸"}
              </PausePlayButton>
            )}
            <ToggleLabel>
              Speed
              <SpeedSlider
                type="range"
                min={0}
                max={SPEED_STEPS.length - 1}
                step={1}
                value={speedIndex}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const idx = Math.min(
                    SPEED_STEPS.length - 1,
                    Math.max(0, parseInt(e.target.value, 10)),
                  );
                  setSpeed(SPEED_STEPS[idx]);
                }}
                aria-label="Game speed"
                data-testid="speed-slider"
              />
              <SpeedLabel>{SPEED_STEP_LABELS[speedIndex]}</SpeedLabel>
            </ToggleLabel>
          </SpeedRow>
          <VolumeControls
            announcementVolume={announcementVolume}
            alertVolume={alertVolume}
            onAnnouncementVolumeChange={handleAnnouncementVolumeChange}
            onAlertVolumeChange={handleAlertVolumeChange}
            onToggleAnnouncementMute={handleToggleAnnouncementMute}
            onToggleAlertMute={handleToggleAlertMute}
          />
          {gameStarted && (
            <ManagerModeControls
              managerMode={managerMode}
              strategy={strategy}
              managedTeam={managedTeam}
              teams={resolvedTeamLabels}
              notifPermission={notifPermission}
              gameStarted={gameStarted}
              gameOver={gameOver}
              decisionValues={decisionValues}
              onManagerModeChange={handleManagerModeChange}
              onStrategyChange={(e) => setStrategy(e.target.value as Strategy)}
              onManagedTeamChange={(e) => setManagedTeam(Number(e.target.value) === 1 ? 1 : 0)}
              onRequestNotifPermission={handleRequestNotifPermission}
              onDecisionValuesChange={setDecisionValues}
              onDecisionValuesReset={resetDecisionValues}
            />
          )}
        </AutoPlayGroup>
      </Controls>
      {gameStarted && managerMode && (
        <React.Suspense fallback={null}>
          <DecisionPanel strategy={strategy} />
        </React.Suspense>
      )}
    </>
  );
};

export default GameControls;
