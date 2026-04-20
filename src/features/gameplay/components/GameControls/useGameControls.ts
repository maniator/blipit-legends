import * as React from "react";

import type { PitchingRole } from "@feat/gameplay/components/SubstitutionPanel";
import { ContextValue, Strategy, useGameContext } from "@feat/gameplay/context/index";
import type { ManagerDecisionValues } from "@feat/gameplay/context/managerDecisionValues";
import {
  DEFAULT_MANAGER_DECISION_VALUES,
  sanitizeManagerDecisionValues,
} from "@feat/gameplay/context/managerDecisionValues";
import { useAutoPlayScheduler } from "@feat/gameplay/hooks/useAutoPlayScheduler";
import { useGameAudio } from "@feat/gameplay/hooks/useGameAudio";
import { useGameRefs } from "@feat/gameplay/hooks/useGameRefs";
import { usePitchDispatch } from "@feat/gameplay/hooks/usePitchDispatch";
import { usePlayerControls } from "@feat/gameplay/hooks/usePlayerControls";
import { useWakeLock } from "@feat/gameplay/hooks/useWakeLock";
import {
  setAlertVolume,
  setAnnouncementVolume,
  setSpeechRate,
} from "@feat/gameplay/utils/announce";
import { useTeamWithRoster } from "@shared/hooks/useTeamWithRoster";
import { useLocalStorage } from "usehooks-ts";

import { SPEED_FAST, SPEED_INSTANT, SPEED_NORMAL, SPEED_SLOW } from "./constants";

const VALID_STRATEGIES: Strategy[] = ["balanced", "aggressive", "patient", "contact", "power"];
const VALID_SPEEDS = [SPEED_SLOW, SPEED_NORMAL, SPEED_FAST, SPEED_INSTANT];

/** Wires all game-controls hooks and localStorage state into a single value. */
export const useGameControls = ({
  gameStarted = false,
}: {
  gameStarted?: boolean;
} = {}) => {
  const { dispatch, dispatchLog, log: _log, ...currentState }: ContextValue = useGameContext();
  const { strikes, balls, pendingDecision, teams, inning, atBat, gameOver } = currentState;

  const [speed, setSpeed] = useLocalStorage("speed", SPEED_NORMAL);
  const [announcementVolume, setAnnouncementVolumeState] = useLocalStorage("announcementVolume", 1);
  const [alertVolume, setAlertVolumeState] = useLocalStorage("alertVolume", 1);
  const [managerMode, setManagerMode] = useLocalStorage("managerMode", false);
  const [strategy, setStrategy] = useLocalStorage<Strategy>("strategy", "balanced");
  const [managedTeam, setManagedTeam] = useLocalStorage<0 | 1>("managedTeam", 0);
  const [rawDecisionValues, setRawDecisionValues] = useLocalStorage<Partial<ManagerDecisionValues>>(
    "managerDecisionValues",
    DEFAULT_MANAGER_DECISION_VALUES,
  );
  // paused is session-only — no persistence needed. useState is guaranteed
  // reactive; useLocalStorage was unreliable here due to useSyncExternalStore
  // emitter timing in usehooks-ts v3.
  const [paused, setPaused] = React.useState(false);
  const [currentSaveId, setCurrentSaveId] = React.useState<string | null>(null);

  // Sanitize values read from localStorage — invalid entries are coerced to safe defaults
  // and immediately written back so the bad value is evicted on first render.
  const safeStrategy: Strategy = VALID_STRATEGIES.includes(strategy) ? strategy : "balanced";
  const safeManagedTeam: 0 | 1 = managedTeam === 0 || managedTeam === 1 ? managedTeam : 0;
  const safeSpeed = VALID_SPEEDS.includes(speed) ? speed : SPEED_NORMAL;
  const safeManagerMode = typeof managerMode === "boolean" ? managerMode : false;
  const safeAnnouncementVolume =
    typeof announcementVolume === "number" && announcementVolume >= 0 && announcementVolume <= 1
      ? announcementVolume
      : 1;
  const safeAlertVolume =
    typeof alertVolume === "number" && alertVolume >= 0 && alertVolume <= 1 ? alertVolume : 1;
  const decisionValues: ManagerDecisionValues = sanitizeManagerDecisionValues(
    rawDecisionValues ?? {},
  );

  // Write back corrected values so localStorage self-heals on first bad render.
  React.useEffect(() => {
    if (!VALID_STRATEGIES.includes(strategy)) setStrategy("balanced");
    if (managedTeam !== 0 && managedTeam !== 1) setManagedTeam(0);
    if (!VALID_SPEEDS.includes(speed)) setSpeed(SPEED_NORMAL);
    if (typeof managerMode !== "boolean") setManagerMode(false);
    if (typeof announcementVolume !== "number" || announcementVolume < 0 || announcementVolume > 1)
      setAnnouncementVolumeState(1);
    if (typeof alertVolume !== "number" || alertVolume < 0 || alertVolume > 1)
      setAlertVolumeState(1);
    // Evict corrupt/partial decisionValues so localStorage stays consistent with
    // the sanitized object — same self-heal pattern as the other settings above.
    if (
      rawDecisionValues == null ||
      JSON.stringify(rawDecisionValues) !== JSON.stringify(decisionValues)
    ) {
      setRawDecisionValues(decisionValues);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset pause when the game ends so the next game always starts playing.
  React.useEffect(() => {
    if (gameOver) setPaused(false);
  }, [gameOver]);

  const { skipDecision } = useGameRefs({
    strikes,
    balls,
    pendingDecision,
  });

  const awayTeamDoc = useTeamWithRoster(teams[0]);
  const homeTeamDoc = useTeamWithRoster(teams[1]);

  // Derive pitcher roles for both teams — fetched directly from DB by team ID.
  // Used by the AI manager to respect SP/RP role restrictions when making pitching changes.
  const allTeamPitcherRoles = React.useMemo((): [
    Record<string, PitchingRole>,
    Record<string, PitchingRole>,
  ] => {
    return [awayTeamDoc, homeTeamDoc].map((doc) => {
      if (!doc) return {};
      const roles: Record<string, PitchingRole> = {};
      for (const p of doc.roster.pitchers) {
        if (p.pitchingRole) roles[p.id] = p.pitchingRole;
      }
      return roles;
    }) as [Record<string, PitchingRole>, Record<string, PitchingRole>];
  }, [awayTeamDoc, homeTeamDoc]);

  useGameAudio(inning, atBat, gameOver, dispatchLog);

  const handlePitch = usePitchDispatch({
    dispatch,
    currentState,
    managerMode: safeManagerMode,
    strategy: safeStrategy,
    managedTeam: safeManagedTeam,
    skipDecision,
    dispatchLog,
    allTeamPitcherRoles,
    decisionValues,
  });

  useAutoPlayScheduler({
    gameStarted,
    pendingDecision,
    managerMode: safeManagerMode,
    gameOver,
    muted: safeAnnouncementVolume === 0,
    speed: safeSpeed,
    paused,
    handlePitch,
    inning,
    atBat,
  });

  useWakeLock(gameStarted && !gameOver);

  React.useEffect(() => {
    setAnnouncementVolume(safeAnnouncementVolume);
  }, [safeAnnouncementVolume]);
  React.useEffect(() => {
    setAlertVolume(safeAlertVolume);
  }, [safeAlertVolume]);
  React.useEffect(() => {
    if (safeSpeed > 0) setSpeechRate(safeSpeed);
  }, [safeSpeed]);

  const playerControls = usePlayerControls({
    setManagerMode,
    announcementVolume: safeAnnouncementVolume,
    setAnnouncementVolumeState,
    alertVolume: safeAlertVolume,
    setAlertVolumeState,
  });

  const setDecisionValues = React.useCallback(
    (values: ManagerDecisionValues) => {
      setRawDecisionValues(sanitizeManagerDecisionValues(values));
    },
    [setRawDecisionValues],
  );

  const resetDecisionValues = React.useCallback(() => {
    setRawDecisionValues(DEFAULT_MANAGER_DECISION_VALUES);
  }, [setRawDecisionValues]);

  return {
    dispatch,
    speed: safeSpeed,
    setSpeed,
    paused,
    setPaused,
    announcementVolume: safeAnnouncementVolume,
    alertVolume: safeAlertVolume,
    managerMode: safeManagerMode,
    setManagerMode,
    strategy: safeStrategy,
    setStrategy,
    managedTeam: safeManagedTeam,
    setManagedTeam,
    decisionValues,
    setDecisionValues,
    resetDecisionValues,
    teams,
    gameOver,
    handlePitch,
    currentSaveId,
    setCurrentSaveId,
    ...playerControls,
  };
};
