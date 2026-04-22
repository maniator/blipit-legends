import * as React from "react";

import { Strategy, useGameContext } from "@feat/gameplay/context/index";
import { playDecisionChime } from "@feat/gameplay/utils/announce";
import { useUIPause } from "@shared/contexts/UIPauseContext";
import { appLog } from "@shared/utils/logger";

import { DECISION_TIMEOUT_SEC } from "./constants";
import DecisionButtons from "./DecisionButtons";
import { closeManagerNotification, showManagerNotification } from "./notificationHelpers";
import {
  CountdownFill,
  CountdownLabel,
  CountdownRow,
  CountdownTrack,
  Panel,
  PausePill,
  ResumeAnnouncement,
} from "./styles";

type Props = {
  strategy: Strategy;
};

const DecisionPanel: React.FunctionComponent<Props> = ({ strategy }) => {
  const { dispatch, pendingDecision } = useGameContext();
  const [secondsLeft, setSecondsLeft] = React.useState(DECISION_TIMEOUT_SEC);
  // UI-pause coordination: when a blocking modal (e.g. Saves) is open, freeze
  // the auto-skip countdown at its current value and visually disable the
  // decision buttons. Read via ref so the setInterval tick always sees the
  // latest pause flag without re-creating the timer (which would otherwise
  // skew the countdown on every pause toggle).
  const { isPaused } = useUIPause();
  const isPausedRef = React.useRef(isPaused);
  isPausedRef.current = isPaused;
  // Track whether the panel was paused on the previous render so we only
  // announce "Resumed" when a real pause→resume transition occurs (and not
  // on first mount when isPaused starts false).
  const wasPausedRef = React.useRef(false);
  const [showResumeAnnouncement, setShowResumeAnnouncement] = React.useState(false);
  React.useEffect(() => {
    if (wasPausedRef.current && !isPaused) {
      setShowResumeAnnouncement(true);
      const id = setTimeout(() => setShowResumeAnnouncement(false), 1500);
      wasPausedRef.current = false;
      return () => clearTimeout(id);
    }
    if (isPaused) wasPausedRef.current = true;
  }, [isPaused]);

  // Listen for actions dispatched from the service worker (notification button taps).
  // Validate the message origin so only same-origin SW messages are processed.
  // SW-to-page postMessages have event.origin === "" (empty string), so we only
  // reject messages whose origin is explicitly a different, non-empty origin.
  React.useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const handler = (event: MessageEvent) => {
      if (event.origin && typeof window !== "undefined" && event.origin !== window.location.origin)
        return;
      if (event.data?.type !== "NOTIFICATION_ACTION") return;
      const { action, payload } = event.data;
      switch (action) {
        case "steal":
          dispatch({ type: "steal_attempt", payload });
          break;
        case "bunt":
          dispatch({ type: "bunt_attempt", payload });
          break;
        case "take":
          dispatch({ type: "set_one_pitch_modifier", payload: "take" });
          break;
        case "swing":
          dispatch({ type: "set_one_pitch_modifier", payload: "swing" });
          break;
        case "protect":
          dispatch({ type: "set_one_pitch_modifier", payload: "protect" });
          break;
        case "normal":
          dispatch({ type: "set_one_pitch_modifier", payload: "normal" });
          break;
        case "ibb":
          dispatch({ type: "intentional_walk" });
          break;
        case "skip":
          dispatch({ type: "skip_decision" });
          break;
        case "ph_contact":
          dispatch({ type: "set_pinch_hitter_strategy", payload: "contact" });
          break;
        case "ph_patient":
          dispatch({ type: "set_pinch_hitter_strategy", payload: "patient" });
          break;
        case "ph_power":
          dispatch({ type: "set_pinch_hitter_strategy", payload: "power" });
          break;
        case "ph_aggressive":
          dispatch({ type: "set_pinch_hitter_strategy", payload: "aggressive" });
          break;
        case "ph_balanced":
          dispatch({ type: "set_pinch_hitter_strategy", payload: "balanced" });
          break;
        case "shift_on":
          dispatch({ type: "set_defensive_shift", payload: true });
          break;
        case "shift_off":
          dispatch({ type: "set_defensive_shift", payload: false });
          break;
        default:
          break; // "focus" — just brings tab to front, no game action needed
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, [dispatch]);

  // Countdown timer + chime + notification on new decision
  React.useEffect(() => {
    if (!pendingDecision) {
      setSecondsLeft(DECISION_TIMEOUT_SEC);
      closeManagerNotification();
      return;
    }
    appLog.log("pendingDecision set:", pendingDecision.kind);
    setSecondsLeft(DECISION_TIMEOUT_SEC);

    // Sound alert (respects mute)
    playDecisionChime();

    // Browser notification — always send immediately so the user is alerted
    // whether they are on the tab or have switched away.
    showManagerNotification(pendingDecision);

    // Re-send if the user switches away while the decision is still pending
    // (e.g. they saw the in-page panel but then tabbed away).
    const handleVisibility = () => {
      if (document.hidden) {
        appLog.log(
          "visibilitychange — tab hidden, re-sending notification for:",
          pendingDecision.kind,
        );
        showManagerNotification(pendingDecision);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    const id = setInterval(() => {
      // Freeze the countdown while a blocking modal is open. The interval
      // continues to fire on its 1s cadence, but we skip the decrement and
      // skip-dispatch — auto-skip therefore CANNOT fire while paused.
      if (isPausedRef.current) return;
      setSecondsLeft((s) => {
        if (s <= 1) {
          dispatch({ type: "skip_decision" });
          return DECISION_TIMEOUT_SEC;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [pendingDecision, dispatch]);

  if (!pendingDecision) return null;

  const skip = () => dispatch({ type: "skip_decision" });
  const pct = (secondsLeft / DECISION_TIMEOUT_SEC) * 100;
  const pausePillId = "decision-panel-pause-pill";

  return (
    <Panel data-testid="manager-decision-panel">
      {isPaused && (
        <PausePill
          id={pausePillId}
          role="status"
          aria-live="polite"
          data-testid="decision-panel-pause-pill"
        >
          Paused while Saves is open
        </PausePill>
      )}
      {showResumeAnnouncement && (
        <ResumeAnnouncement role="status" aria-live="polite" data-testid="decision-panel-resumed">
          Resumed
        </ResumeAnnouncement>
      )}
      <DecisionButtons
        pendingDecision={pendingDecision}
        strategy={strategy}
        onSkip={skip}
        onDispatch={dispatch}
        paused={isPaused}
      />
      <CountdownRow $paused={isPaused}>
        <CountdownTrack
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={DECISION_TIMEOUT_SEC}
          aria-valuenow={secondsLeft}
          aria-label="Auto-skip countdown"
          aria-describedby={isPaused ? pausePillId : undefined}
        >
          <CountdownFill $pct={pct} $paused={isPaused} />
        </CountdownTrack>
        <CountdownLabel>auto-skip {secondsLeft}s</CountdownLabel>
      </CountdownRow>
    </Panel>
  );
};

export default DecisionPanel;
