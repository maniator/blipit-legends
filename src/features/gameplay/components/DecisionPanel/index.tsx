import * as React from "react";

import { Strategy, useGameContext } from "@feat/gameplay/context/index";
import { playDecisionChime } from "@feat/gameplay/utils/announce";
import { appLog } from "@shared/utils/logger";

import { DECISION_TIMEOUT_SEC } from "./constants";
import DecisionButtons from "./DecisionButtons";
import {
  closeManagerNotification,
  type ManagerNotificationData,
  showManagerNotification,
} from "./notificationHelpers";
import { CountdownFill, CountdownLabel, CountdownRow, CountdownTrack, Panel } from "./styles";

type Props = {
  strategy: Strategy;
};

const DecisionPanel: React.FunctionComponent<Props> = ({ strategy }) => {
  const { dispatch, gameInstanceId, pendingDecision, pitchKey } = useGameContext();
  const [secondsLeft, setSecondsLeft] = React.useState(DECISION_TIMEOUT_SEC);

  // Keep refs current so the SW message handler (registered once) always reads
  // the latest values without being torn down and re-added every pitch.
  const pendingDecisionRef = React.useRef(pendingDecision);
  pendingDecisionRef.current = pendingDecision;
  const pitchKeyRef = React.useRef(pitchKey);
  pitchKeyRef.current = pitchKey;
  const gameInstanceIdRef = React.useRef(gameInstanceId);
  gameInstanceIdRef.current = gameInstanceId;

  // Listen for actions dispatched from the service worker (notification button taps).
  // Validate the message origin so only same-origin SW messages are processed.
  // SW-to-page postMessages have event.origin === "" (empty string), so we only
  // reject messages whose origin is explicitly a different, non-empty origin.
  // Registered once with [dispatch] (stable) — reads pitchKey/pendingDecision from refs.
  React.useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const handler = (event: MessageEvent) => {
      if (event.origin && typeof window !== "undefined" && event.origin !== window.location.origin)
        return;
      if (event.data?.type !== "NOTIFICATION_ACTION") return;
      const currentPendingDecision = pendingDecisionRef.current;
      if (!currentPendingDecision) return;
      const {
        action,
        gameInstanceId: sourceGameInstanceId,
        payload,
        pitchKey: sourcePitchKey,
      } = event.data as {
        action?: string;
        gameInstanceId?: string;
        payload?: ManagerNotificationData["decision"];
        pitchKey?: number;
      };
      if (
        sourcePitchKey !== pitchKeyRef.current ||
        sourceGameInstanceId !== gameInstanceIdRef.current ||
        !payload ||
        payload.kind !== currentPendingDecision.kind
      )
        return;
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

    if (document.hidden) {
      showManagerNotification(pendingDecision, { gameInstanceId, pitchKey });
    }

    // Re-send if the user switches away while the decision is still pending
    // (e.g. they saw the in-page panel but then tabbed away).
    const handleVisibility = () => {
      if (document.hidden) {
        appLog.log(
          "visibilitychange — tab hidden, re-sending notification for:",
          pendingDecision.kind,
        );
        showManagerNotification(pendingDecision, { gameInstanceId, pitchKey });
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    const id = setInterval(() => {
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
  }, [pendingDecision, dispatch, gameInstanceId, pitchKey]);

  if (!pendingDecision) return null;

  const skip = () => dispatch({ type: "skip_decision" });
  const pct = (secondsLeft / DECISION_TIMEOUT_SEC) * 100;

  return (
    <Panel data-testid="manager-decision-panel">
      <DecisionButtons
        pendingDecision={pendingDecision}
        strategy={strategy}
        onSkip={skip}
        onDispatch={dispatch}
      />
      <CountdownRow>
        <CountdownTrack
          role="progressbar"
          aria-label="Decision countdown until auto-skip"
          aria-valuemin={0}
          aria-valuemax={DECISION_TIMEOUT_SEC}
          aria-valuenow={secondsLeft}
          aria-valuetext={`${secondsLeft} seconds remaining`}
        >
          <CountdownFill $pct={pct} />
        </CountdownTrack>
        <CountdownLabel>auto-skip {secondsLeft}s</CountdownLabel>
      </CountdownRow>
    </Panel>
  );
};

export default DecisionPanel;
