import * as React from "react";

import { useGameHistorySync } from "@feat/careerStats/hooks/useGameHistorySync";
import { resolveRestoreLabels } from "@feat/customTeams/adapters/customTeamAdapter";
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
  getDefaultDecisionValues,
  sanitizeManagerDecisionValues,
  STEAL_PCT_MIN,
} from "@feat/gameplay/context/managerDecisionValues";
import { useRxdbGameSync } from "@feat/saves/hooks/useRxdbGameSync";
import { useSaveStore } from "@feat/saves/hooks/useSaveStore";
import { useCustomTeams } from "@shared/hooks/useCustomTeams";
import { appLog } from "@shared/utils/logger";
import { getSeed, reinitSeed, restoreRng, restoreSeed } from "@shared/utils/rng";
import { currentSeedStr } from "@shared/utils/saves";
import { useLocalStorage } from "usehooks-ts";

import type { ExhibitionGameSetup } from "@storage/types";
import type { PlayerOverrides } from "@storage/types";
import type { GameSaveSetup, SaveRecord } from "@storage/types";

import { FieldPanel, GameBody, GameDiv, LogPanel, StealClampNotice } from "./styles";

/**
 * Module-level flag: set to `true` the first time the steal-clamp toast fires
 * so it never shows more than once per browser session.  Cleared only on a
 * full page reload (i.e. module re-evaluation).
 *
 * **Assumption:** only one `GameInner` instance exists in the React tree at a
 * time (enforced by the app's single-game routing model).  In tests, use
 * `vi.resetModules()` if you need to reset this flag between test cases.
 */
let _stealClampToastShown = false;

/**
 * Returns true when any steal-percentage field in `dv` is below STEAL_PCT_MIN
 * and would therefore be silently clamped by `sanitizeManagerDecisionValues`.
 */
const wouldClampStealThreshold = (
  dv: Partial<ManagerDecisionValues> | null | undefined,
): boolean => {
  if (!dv) return false;
  return (
    (Number.isFinite(dv.stealMinOfferPct) && (dv.stealMinOfferPct as number) < STEAL_PCT_MIN) ||
    (Number.isFinite(dv.aiStealThreshold) && (dv.aiStealThreshold as number) < STEAL_PCT_MIN)
  );
};

/** Finds the best save to auto-resume: prefer seed+snapshot match, fallback to any snapshot. */
const findMatchedSave = (saves: SaveRecord[]): SaveRecord | null => {
  const currentSeed = getSeed()?.toString(36);
  let anySnapshot: SaveRecord | null = null;
  for (const s of saves) {
    if (s.stateSnapshot == null) continue;
    if (currentSeed != null && s.seed === currentSeed) return s; // best match
    if (anySnapshot == null) anySnapshot = s; // first snapshot fallback
  }
  return anySnapshot;
};

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
}) => {
  const { dispatch, dispatchLog, teams, gameOver } = useGameContext();
  const [, setManagerMode] = useLocalStorage("managerMode", false);
  const [, setManagedTeam] = useLocalStorage<0 | 1>("managedTeam", 0);
  const [strategy, setStrategy] = useLocalStorage<Strategy>("strategy", "balanced");
  const [currentDecisionValues, setDecisionValues] = useLocalStorage<ManagerDecisionValues>(
    "managerDecisionValues",
    // Use getDefaultDecisionValues() so the A/B experiment variant is respected
    // when no value is stored in localStorage yet.
    getDefaultDecisionValues(),
  );

  // Custom team docs for resolving display names when restoring legacy saves.
  // Used directly in restore callbacks and effects; no ref needed since
  // resolveRestoreLabels returns existing labels unchanged for new saves.
  const { teams: customTeams, loading: customTeamsLoading } = useCustomTeams();

  const [gameKey, setGameKey] = React.useState(0);
  const [gameActive, setGameActive] = React.useState(false);
  const [activeTeam, setActiveTeam] = React.useState<0 | 1>(0);
  // One-time dismissible toast shown when a loaded save's steal threshold is clamped.
  const [showStealClampToast, setShowStealClampToast] = React.useState(false);

  // Fallback buffer when rendered without the Game wrapper (e.g. in tests).
  const localBufferRef = React.useRef<GameAction[]>([]);
  const actionBufferRef = externalBufferRef ?? localBufferRef;

  // Tracks the RxDB save ID for the current game session.
  const rxSaveIdRef = React.useRef<string | null>(null);

  // True when the currently-loaded save was already in FINAL state on load.
  // Prevents useGameHistorySync from re-committing stats for a completed game.
  const [wasAlreadyFinalOnLoad, setWasAlreadyFinalOnLoad] = React.useState(false);

  useRxdbGameSync(rxSaveIdRef, actionBufferRef, { wasAlreadyFinalOnLoad });
  const { isCommitting } = useGameHistorySync(rxSaveIdRef, wasAlreadyFinalOnLoad);

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
  }, [gameOver, onGameOver]);

  // Reactive saves list — used for auto-resume detection on initial load.
  const { saves, createSave } = useSaveStore();

  // Set rxAutoSave once when the first seed-matched save appears in the reactive list.
  // Skip auto-restore when navigating via "Load Saved Game" — the user explicitly chose a save.
  // Also skip when a fresh new game is pending — pendingGameSetup takes precedence over any
  // existing save so the finished-game state is never replayed on top of the new session.
  const restoredRef = React.useRef(pendingGameSetup != null || pendingLoadSave != null);
  const [rxAutoSave, setRxAutoSave] = React.useState<SaveRecord | null>(null);
  React.useEffect(() => {
    if (restoredRef.current) return;
    const matched = findMatchedSave(saves);
    if (!matched) return;
    restoredRef.current = true;
    setRxAutoSave(matched);
  }, [saves]);

  // Restore state from the RxDB save as soon as it is loaded and auto-activate the session.
  // Guard against double-dispatch if customTeams updates after the initial restore.
  const prevRxAutoSaveRef = React.useRef<SaveRecord | null>(null);
  React.useEffect(() => {
    if (!rxAutoSave || rxAutoSave === prevRxAutoSaveRef.current) return;
    if (customTeamsLoading) return; // defer until custom teams are loaded
    prevRxAutoSaveRef.current = rxAutoSave;
    const { stateSnapshot: snap, setup } = rxAutoSave;
    if (!snap) return;
    if (snap.rngState !== null) {
      restoreSeed(rxAutoSave.seed);
      restoreRng(snap.rngState);
    } else {
      reinitSeed(rxAutoSave.seed);
    }
    dispatch({
      type: "restore_game",
      payload: {
        ...snap.state,
        teamLabels: resolveRestoreLabels(snap.state, customTeams),
      },
    });
    setStrategy(setup.strategy);
    if (setup.managedTeam !== null) setManagedTeam(setup.managedTeam);
    setManagerMode(setup.managerMode);
    if (wouldClampStealThreshold(setup.decisionValues) && !_stealClampToastShown) {
      _stealClampToastShown = true;
      setShowStealClampToast(true);
    }
    setDecisionValues(
      setup.decisionValues != null
        ? sanitizeManagerDecisionValues(setup.decisionValues)
        : getDefaultDecisionValues(),
    );
    setGameActive(true);
    onGameSessionStarted?.();
  }, [
    dispatch,
    rxAutoSave,
    customTeams,
    customTeamsLoading,
    setStrategy,
    setManagedTeam,
    setManagerMode,
    setDecisionValues,
    onGameSessionStarted,
  ]);

  const handleStart = (
    homeTeam: string,
    awayTeam: string,
    homeTeamLabel: string,
    awayTeamLabel: string,
    managedTeam: 0 | 1 | null,
    playerOverrides: PlayerOverrides,
  ) => {
    // A fresh game is never "already final".
    setWasAlreadyFinalOnLoad(false);
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
    handleStartRef.current(
      pendingGameSetup.homeTeam,
      pendingGameSetup.awayTeam,
      pendingGameSetup.homeTeamLabel,
      pendingGameSetup.awayTeamLabel,
      pendingGameSetup.managedTeam,
      pendingGameSetup.playerOverrides,
    );
    onConsumeGameSetup?.();
  }, [pendingGameSetup, onConsumeGameSetup]);

  // Restore game state when AppShell delivers a save loaded from the /saves page.
  const prevPendingLoad = React.useRef<SaveRecord | null>(null);
  React.useEffect(() => {
    if (!pendingLoadSave) return;
    if (pendingLoadSave === prevPendingLoad.current) return;
    prevPendingLoad.current = pendingLoadSave;

    const snap = pendingLoadSave.stateSnapshot;
    if (!snap) {
      // No snapshot available — clear the pending state but don't restore.
      onConsumePendingLoad?.();
      return;
    }

    if (snap.rngState !== null) {
      restoreSeed(pendingLoadSave.seed);
      restoreRng(snap.rngState);
    } else {
      reinitSeed(pendingLoadSave.seed);
    }
    dispatch({
      type: "restore_game",
      payload: {
        ...snap.state,
        teamLabels: resolveRestoreLabels(snap.state, customTeams),
      },
    });

    const setup = pendingLoadSave.setup;
    setManagerMode(setup.managerMode);
    setManagedTeam(setup.managedTeam ?? 0);
    setStrategy(setup.strategy);
    if (wouldClampStealThreshold(setup.decisionValues) && !_stealClampToastShown) {
      _stealClampToastShown = true;
      setShowStealClampToast(true);
    }
    setDecisionValues(
      setup.decisionValues != null
        ? sanitizeManagerDecisionValues(setup.decisionValues)
        : getDefaultDecisionValues(),
    );

    rxSaveIdRef.current = pendingLoadSave.id;
    // If the loaded save was already FINAL, mark it so history sync skips re-commit.
    setWasAlreadyFinalOnLoad(snap.state.gameOver === true);
    setGameActive(true);
    onGameSessionStarted?.();
    onConsumePendingLoad?.();
    return () => {
      prevPendingLoad.current = null;
    };
  }, [
    pendingLoadSave,
    dispatch,
    customTeams,
    setManagerMode,
    setManagedTeam,
    setStrategy,
    setDecisionValues,
    onGameSessionStarted,
    onConsumePendingLoad,
  ]);

  // ── Modal-triggered save load ─────────────────────────────────────────────
  // Directly restores game state when the user loads a save from within the
  // running game via the SavesModal. The scheduler's effect-level gameOver guard
  // and the cancelled flag are sufficient to resume/restart auto-play — no
  // false→true gameActive dance needed now that the scheduler no longer reads
  // gameStateRef inside the timeout callback (the stale-ref guard was removed).
  const handleModalLoad = React.useCallback(
    (slot: SaveRecord) => {
      const snap = slot.stateSnapshot;
      if (!snap) return;

      // Prevent the auto-resume effect from re-running while we restore.
      restoredRef.current = true;

      if (snap.rngState !== null) {
        restoreSeed(slot.seed);
        restoreRng(snap.rngState);
      } else {
        reinitSeed(slot.seed);
      }
      dispatch({
        type: "restore_game",
        payload: {
          ...snap.state,
          teamLabels: resolveRestoreLabels(snap.state, customTeams),
        },
      });

      const { setup } = slot;
      setManagerMode(setup.managerMode);
      setManagedTeam(setup.managedTeam ?? 0);
      setStrategy(setup.strategy);
      if (wouldClampStealThreshold(setup.decisionValues) && !_stealClampToastShown) {
        _stealClampToastShown = true;
        setShowStealClampToast(true);
      }
      setDecisionValues(
        setup.decisionValues != null
          ? sanitizeManagerDecisionValues(setup.decisionValues)
          : getDefaultDecisionValues(),
      );

      rxSaveIdRef.current = slot.id;
      // If the loaded save was already FINAL, mark it so history sync skips re-commit.
      setWasAlreadyFinalOnLoad(snap.state.gameOver === true);
      setGameActive(true); // no-op if already active; triggers scheduler if game was over
      onGameSessionStarted?.();
    },
    [
      dispatch,
      customTeams,
      setManagerMode,
      setManagedTeam,
      setStrategy,
      setDecisionValues,
      onGameSessionStarted,
    ],
  );

  return (
    <>
      {showStealClampToast && (
        <StealClampNotice role="status" aria-live="polite" data-testid="steal-clamp-notice">
          <span>Steal threshold updated to 65% (minimum)</span>
          <button
            type="button"
            aria-label="Dismiss steal threshold notice"
            onClick={() => setShowStealClampToast(false)}
          >
            ×
          </button>
        </StealClampNotice>
      )}
      <GameDiv>
        <LineScore />
        <GameControls
          key={gameKey}
          onNewGame={handleNewGame}
          gameStarted={gameActive}
          onLoadSave={handleModalLoad}
          onBackToHome={onBackToHome}
          isCommitting={isCommitting}
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
    </>
  );
};

export default GameInner;
