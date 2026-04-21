import * as React from "react";

import { useGameHistorySync } from "@feat/careerStats/hooks/useGameHistorySync";
import Announcements from "@feat/gameplay/components/Announcements";
import Diamond from "@feat/gameplay/components/Diamond";
import GameControls from "@feat/gameplay/components/GameControls";
import HitLog from "@feat/gameplay/components/HitLog";
import LineScore from "@feat/gameplay/components/LineScore";
import PlayerStatsPanel from "@feat/gameplay/components/PlayerStatsPanel";
import TeamTabBar from "@feat/gameplay/components/TeamTabBar";
import type { GameAction, Strategy } from "@feat/gameplay/context/index";
import { useGameContext } from "@feat/gameplay/context/index";
import type { ManagerDecisionValues } from "@feat/gameplay/context/managerDecisionValues";
import {
  DEFAULT_MANAGER_DECISION_VALUES,
  sanitizeManagerDecisionValues,
} from "@feat/gameplay/context/managerDecisionValues";
import { useAutoRestoreSave } from "@feat/gameplay/hooks/useAutoRestoreSave";
import { useGameSaveRestore } from "@feat/gameplay/hooks/useGameSaveRestore";
import { useLeagueAwareContext } from "@feat/gameplay/hooks/useLeagueAwareContext";
import { useModalLoadSave } from "@feat/gameplay/hooks/useModalLoadSave";
import { useLeagueGameReconciliation } from "@feat/leagueMode/hooks/useLeagueGameReconciliation";
import { deriveScheduledGameSeed } from "@feat/leagueMode/utils/deriveScheduledGameSeed";
import { useRxdbGameSync } from "@feat/saves/hooks/useRxdbGameSync";
import { useCustomTeams } from "@shared/hooks/useCustomTeams";
import { appLog } from "@shared/utils/logger";
import { reinitSeed } from "@shared/utils/rng";
import { currentSeedStr } from "@shared/utils/saves";
import { useLocalStorage } from "usehooks-ts";

import type { ExhibitionGameSetup } from "@storage/types";
import type { LeagueGameContext } from "@storage/types";
import type { PlayerOverrides } from "@storage/types";
import type { GameSaveSetup, SaveRecord } from "@storage/types";

import { FieldPanel, GameBody, GameDiv, LogPanel } from "./styles";

interface Props {
  /** Shared buffer populated by GameProviderWrapper's onDispatch callback. */
  actionBufferRef?: React.MutableRefObject<GameAction[]>;
  /** Routes back to the Home screen in AppShell. */
  onBackToHome?: () => void;
  /** Called when the in-game New Game button is clicked; navigates to /exhibition/new. */
  onNewGame?: () => void;
  /** Called the first time a real game session starts or a save is loaded. */
  onGameSessionStarted?: () => void;
  /** Setup from /exhibition/new; auto-starts a game when it arrives. */
  pendingGameSetup?: ExhibitionGameSetup | null;
  /** Called after pendingGameSetup is consumed so GamePage can clear it. */
  onConsumeGameSetup?: () => void;
  /** Save loaded from /saves page; auto-restores game state when it arrives. */
  pendingLoadSave?: SaveRecord | null;
  /** Called after pendingLoadSave is consumed so GamePage can clear it. */
  onConsumePendingLoad?: () => void;
  /** Called when the isCommitting state changes (career stats being saved). */
  onSavingStateChange?: (saving: boolean) => void;
  /** Called when the game reaches FINAL so AppShell can clear hasActiveSession. */
  onGameOver?: () => void;
  /** League context — present when this game was launched from league mode. */
  leagueGameContext?: LeagueGameContext | null;
  /** Called when the user clicks "← Back to League"; receives the league ID to navigate to. */
  onBackToLeague?: (leagueId: string) => void;
}

const GameInner: React.FunctionComponent<Props> = ({
  actionBufferRef: externalBufferRef,
  onBackToHome,
  onNewGame,
  onGameSessionStarted,
  pendingGameSetup,
  onConsumeGameSetup,
  pendingLoadSave,
  onConsumePendingLoad,
  onSavingStateChange,
  onGameOver,
  leagueGameContext,
  onBackToLeague,
}) => {
  const { dispatch, dispatchLog, teams, gameOver, score } = useGameContext();
  const [, setManagerMode] = useLocalStorage("managerMode", false);
  const [, setManagedTeam] = useLocalStorage<0 | 1>("managedTeam", 0);
  const [strategy, setStrategy] = useLocalStorage<Strategy>("strategy", "balanced");
  const [currentDecisionValues, setDecisionValues] = useLocalStorage<ManagerDecisionValues>(
    "managerDecisionValues",
    DEFAULT_MANAGER_DECISION_VALUES,
  );

  // Custom team docs for resolving display names when restoring legacy saves.
  // Used directly in restore callbacks and effects; no ref needed since
  // resolveRestoreLabels returns existing labels unchanged for new saves.
  const { teams: customTeams, loading: customTeamsLoading } = useCustomTeams();

  const [gameKey, setGameKey] = React.useState(0);
  const [gameActive, setGameActive] = React.useState(false);
  const [activeTeam, setActiveTeam] = React.useState<0 | 1>(0);

  // Fallback buffer when rendered without the Game wrapper (e.g. in tests).
  const localBufferRef = React.useRef<GameAction[]>([]);
  const actionBufferRef = externalBufferRef ?? localBufferRef;

  // Tracks the RxDB save ID for the current game session.
  const rxSaveIdRef = React.useRef<string | null>(null);

  // Tracks the save ID once the game reaches FINAL — used for league reconciliation.
  const [completedGameSaveId, setCompletedGameSaveId] = React.useState<string | null>(null);
  const [completedGameFinalScore, setCompletedGameFinalScore] = React.useState<{
    awayScore: number;
    homeScore: number;
  } | null>(null);

  const { backToLeagueId, isLeagueSave, setLoadedSaveLeagueId } =
    useLeagueAwareContext(leagueGameContext);

  const { wasAlreadyFinalOnLoad, setWasAlreadyFinalOnLoad } = useGameSaveRestore({
    pendingLoadSave,
    dispatch,
    customTeams,
    rxSaveIdRef,
    setManagerMode,
    setManagedTeam,
    setStrategy,
    setDecisionValues,
    setLoadedSaveLeagueId,
    setGameActive,
    onGameSessionStarted,
    onConsumePendingLoad,
  });

  useRxdbGameSync(rxSaveIdRef, actionBufferRef, { wasAlreadyFinalOnLoad });
  const { isCommitting } = useGameHistorySync(
    rxSaveIdRef,
    wasAlreadyFinalOnLoad,
    leagueGameContext,
  );

  React.useEffect(() => {
    onSavingStateChange?.(isCommitting);
  }, [isCommitting, onSavingStateChange]);

  // Notify AppShell once when the game transitions to FINAL.
  // gameOverFiredRef is reset when gameOver becomes false (i.e. when a new game
  // starts via dispatch({ type: "reset" }) or a restore_game to a non-final state),
  // so that the callback fires exactly once for each individual game played.
  const gameOverFiredRef = React.useRef(false);
  React.useEffect(() => {
    if (!gameOver) {
      gameOverFiredRef.current = false;
      return;
    }
    if (gameOverFiredRef.current) return;
    gameOverFiredRef.current = true;
    onGameOver?.();
    // Capture the save ID and final score for league post-game reconciliation.
    if (rxSaveIdRef.current) {
      setCompletedGameSaveId(rxSaveIdRef.current);
      setCompletedGameFinalScore({ awayScore: score[0], homeScore: score[1] });
    }
  }, [gameOver, onGameOver]);

  // Auto-resume on mount: detects a seed-matched save and restores it once.
  // Skip when pendingGameSetup or pendingLoadSave is already active.
  const { restoredRef, createSave } = useAutoRestoreSave({
    skipAutoRestore: pendingGameSetup != null || pendingLoadSave != null,
    dispatch,
    customTeams,
    customTeamsLoading,
    rxSaveIdRef,
    setManagerMode,
    setManagedTeam,
    setStrategy,
    setDecisionValues,
    setWasAlreadyFinalOnLoad,
    setLoadedSaveLeagueId,
    setGameActive,
    onGameSessionStarted,
  });

  // Mark the scheduled league game as completed once the game ends and the save ID is available.
  useLeagueGameReconciliation(leagueGameContext, completedGameSaveId, completedGameFinalScore);

  const handleStart = (
    homeTeam: string,
    awayTeam: string,
    homeTeamLabel: string,
    awayTeamLabel: string,
    managedTeam: 0 | 1 | null,
    playerOverrides: PlayerOverrides,
  ) => {
    // A fresh game is never "already final" and not loaded from a league save.
    setWasAlreadyFinalOnLoad(false);
    setLoadedSaveLeagueId(null);
    setManagerMode(managedTeam !== null);
    if (managedTeam !== null) {
      setManagedTeam(managedTeam);
    }
    dispatch({ type: "reset" });
    dispatchLog({ type: "reset" });
    dispatch({
      type: "setTeams",
      payload: {
        teams: [awayTeam, homeTeam],
        teamLabels: [awayTeamLabel, homeTeamLabel],
        playerOverrides: [playerOverrides.away, playerOverrides.home],
        lineupOrder: [playerOverrides.awayOrder, playerOverrides.homeOrder],
        ...(playerOverrides.awayBench !== undefined &&
          playerOverrides.homeBench !== undefined && {
            rosterBench: [playerOverrides.awayBench, playerOverrides.homeBench],
          }),
        ...(playerOverrides.awayPitchers !== undefined &&
          playerOverrides.homePitchers !== undefined && {
            rosterPitchers: [playerOverrides.awayPitchers, playerOverrides.homePitchers],
          }),
        ...(playerOverrides.awayHandedness !== undefined &&
          playerOverrides.homeHandedness !== undefined && {
            handednessByTeam: [playerOverrides.awayHandedness, playerOverrides.homeHandedness],
          }),
        ...(playerOverrides.startingPitcherIdx !== undefined && {
          startingPitcherIdx: playerOverrides.startingPitcherIdx,
        }),
      },
    });

    // Create a new RxDB save for this session (fire-and-forget).
    // currentSeedStr() returns the seed that was already initialized for this
    // page load — it does NOT generate a new one.
    const setup: GameSaveSetup = {
      strategy,
      managedTeam,
      managerMode: managedTeam !== null,
      homeTeam,
      awayTeam,
      ...(leagueGameContext != null && { leagueContext: leagueGameContext }),
      decisionValues: sanitizeManagerDecisionValues(currentDecisionValues ?? {}),
    };
    createSave(
      {
        homeTeamId: homeTeam,
        awayTeamId: awayTeam,
        seed: currentSeedStr(),
        setup,
      },
      { name: `${awayTeamLabel} vs ${homeTeamLabel}` },
    )
      .then((id) => {
        rxSaveIdRef.current = id;
      })
      .catch(() => {});

    setGameActive(true);
    onGameSessionStarted?.();
    setGameKey((k) => k + 1);
  };

  const handleNewGame = () => {
    rxSaveIdRef.current = null;
    setLoadedSaveLeagueId(null);
    dispatch({ type: "reset" });
    dispatchLog({ type: "reset" });
    setGameActive(false);
    setGameKey((k) => k + 1);
    // Navigate to /exhibition/new to start a fresh game.
    // onNewGame is optional only to support isolated unit tests; in production
    // GamePage always provides it.
    if (onNewGame) {
      onNewGame();
    } else if (process.env.NODE_ENV !== "production") {
      appLog.warn(
        "GameInner: onNewGame was not provided. " +
          "In production this prop must always be supplied by GamePage.",
      );
    }
  };

  // Keep a stable ref to handleStart so the pendingGameSetup effect can call
  // it without including it in the dependency array (it captures many setters).
  const handleStartRef = React.useRef(handleStart);
  handleStartRef.current = handleStart;

  // Auto-start the game when AppShell delivers a setup from /exhibition/new.
  const prevPendingSetup = React.useRef<ExhibitionGameSetup | null>(null);
  React.useEffect(() => {
    if (!pendingGameSetup) return;
    if (pendingGameSetup === prevPendingSetup.current) return;
    prevPendingSetup.current = pendingGameSetup;
    // Prevent auto-resume from overwriting this fresh session even if RxDB saves
    // load asynchronously after this effect fires.
    restoredRef.current = true;
    // For league games, use the canonical deterministic seed derived from the
    // season + scheduled game IDs instead of a user-provided or random seed.
    // leagueGameContext is captured once from location state on mount (via a
    // useRef in GamePage) and will not change for the lifetime of this component,
    // so this effect only runs when pendingGameSetup arrives the first time.
    if (leagueGameContext) {
      reinitSeed(
        deriveScheduledGameSeed(
          leagueGameContext.leagueSeasonId,
          leagueGameContext.scheduledGameId,
        ),
      );
    }
    handleStartRef.current(
      pendingGameSetup.homeTeam,
      pendingGameSetup.awayTeam,
      pendingGameSetup.homeTeamLabel,
      pendingGameSetup.awayTeamLabel,
      pendingGameSetup.managedTeam,
      pendingGameSetup.playerOverrides,
    );
    onConsumeGameSetup?.();
  }, [pendingGameSetup, onConsumeGameSetup, leagueGameContext]);

  // ── Modal-triggered save load ─────────────────────────────────────────────
  // Directly restores game state when the user loads a save from within the
  // running game via the SavesModal.
  const handleModalLoad = useModalLoadSave({
    dispatch,
    customTeams,
    rxSaveIdRef,
    restoredRef,
    setManagerMode,
    setManagedTeam,
    setStrategy,
    setDecisionValues,
    setWasAlreadyFinalOnLoad,
    setLoadedSaveLeagueId,
    setGameActive,
    onGameSessionStarted,
  });

  const handleBackToLeague = React.useCallback(() => {
    if (backToLeagueId) {
      onBackToLeague?.(backToLeagueId);
    }
  }, [backToLeagueId, onBackToLeague]);

  return (
    <GameDiv>
      <LineScore />
      <GameControls
        key={gameKey}
        onNewGame={handleNewGame}
        gameStarted={gameActive}
        onLoadSave={handleModalLoad}
        onBackToHome={onBackToHome}
        isCommitting={isCommitting}
        onBackToLeague={backToLeagueId ? handleBackToLeague : undefined}
        isLeagueSave={isLeagueSave}
      />
      <GameBody>
        <FieldPanel>
          <Diamond />
        </FieldPanel>
        <LogPanel data-testid="log-panel">
          <TeamTabBar teams={teams} activeTeam={activeTeam} onSelect={setActiveTeam} />
          <PlayerStatsPanel activeTeam={activeTeam} />
          <HitLog activeTeam={activeTeam} />
          <Announcements />
        </LogPanel>
      </GameBody>
    </GameDiv>
  );
};

export default GameInner;
