import * as React from "react";

import type { DecisionType, Strategy } from "@feat/gameplay/context/index";

import PinchHitterDecisionButtons from "./PinchHitterDecisionButtons";
import { ActionButton, Odds, Prompt, SkipButton } from "./styles";

type Props = {
  pendingDecision: DecisionType;
  strategy: Strategy;
  onSkip: () => void;
  onDispatch: (action: { type: string; payload?: unknown }) => void;
  /** When true, all action buttons are visually and interactively disabled
   *  via `aria-disabled` (NOT the native `disabled` attribute) so focus
   *  return survives a modal close that triggered the pause. */
  paused?: boolean;
};

/**
 * `aria-disabled` (not native `disabled`) is intentional — keeping the
 * button focusable means keyboard focus is preserved across modal close.
 * The shared `disabled-style` styling (opacity 0.4, cursor not-allowed,
 * pointer-events none) is applied via the `$paused` styled-component prop.
 */
const DecisionButtons: React.FunctionComponent<Props> = ({
  pendingDecision,
  strategy,
  onSkip,
  onDispatch,
  paused = false,
}) => {
  const aria = paused ? { "aria-disabled": true as const } : {};
  switch (pendingDecision.kind) {
    case "steal": {
      const { base, successPct } = pendingDecision;
      return (
        <>
          <Prompt>Steal attempt from {base === 0 ? "1st" : "2nd"} base?</Prompt>
          <Odds>Est. success: {successPct}%</Odds>
          <ActionButton
            $paused={paused}
            {...aria}
            onClick={() => onDispatch({ type: "steal_attempt", payload: { base, successPct } })}
          >
            Yes, steal!
          </ActionButton>
          <SkipButton $paused={paused} {...aria} onClick={onSkip}>
            Skip
          </SkipButton>
        </>
      );
    }
    case "bunt":
      return (
        <>
          <Prompt>Sacrifice bunt?</Prompt>
          <ActionButton
            $paused={paused}
            {...aria}
            onClick={() => onDispatch({ type: "bunt_attempt", payload: { strategy } })}
          >
            Yes, bunt!
          </ActionButton>
          <SkipButton $paused={paused} {...aria} onClick={onSkip}>
            Skip
          </SkipButton>
        </>
      );
    case "count30":
      return (
        <>
          <Prompt>Count is 3-0. Take or swing?</Prompt>
          <ActionButton
            $paused={paused}
            {...aria}
            onClick={() => onDispatch({ type: "set_one_pitch_modifier", payload: "take" })}
          >
            Take (walk odds ↑)
          </ActionButton>
          <ActionButton
            $paused={paused}
            {...aria}
            onClick={() => onDispatch({ type: "set_one_pitch_modifier", payload: "swing" })}
          >
            Swing away
          </ActionButton>
          <SkipButton $paused={paused} {...aria} onClick={onSkip}>
            Skip
          </SkipButton>
        </>
      );
    case "count02":
      return (
        <>
          <Prompt>Count is 0-2. Protect or normal swing?</Prompt>
          <ActionButton
            $paused={paused}
            {...aria}
            onClick={() => onDispatch({ type: "set_one_pitch_modifier", payload: "protect" })}
          >
            Protect (contact ↑)
          </ActionButton>
          <ActionButton
            $paused={paused}
            {...aria}
            onClick={() => onDispatch({ type: "set_one_pitch_modifier", payload: "normal" })}
          >
            Normal swing
          </ActionButton>
          <SkipButton $paused={paused} {...aria} onClick={onSkip}>
            Skip
          </SkipButton>
        </>
      );
    case "ibb":
      return (
        <>
          <Prompt>Issue an intentional walk?</Prompt>
          <ActionButton
            $paused={paused}
            {...aria}
            onClick={() => onDispatch({ type: "intentional_walk" })}
          >
            Yes, walk them
          </ActionButton>
          <SkipButton $paused={paused} {...aria} onClick={onSkip}>
            Skip
          </SkipButton>
        </>
      );
    case "ibb_or_steal": {
      const { base, successPct } = pendingDecision;
      return (
        <>
          <Prompt>Intentional walk or steal?</Prompt>
          <Odds>Steal success: {successPct}%</Odds>
          <ActionButton
            $paused={paused}
            {...aria}
            onClick={() => onDispatch({ type: "intentional_walk" })}
          >
            🥾 Intentional Walk
          </ActionButton>
          <ActionButton
            $paused={paused}
            {...aria}
            onClick={() => onDispatch({ type: "steal_attempt", payload: { base, successPct } })}
          >
            ⚡ Steal! ({successPct}%)
          </ActionButton>
          <SkipButton $paused={paused} {...aria} onClick={onSkip}>
            ⏭ Skip
          </SkipButton>
        </>
      );
    }
    case "pinch_hitter":
      return (
        <PinchHitterDecisionButtons
          candidates={pendingDecision.candidates}
          teamIdx={pendingDecision.teamIdx}
          lineupIdx={pendingDecision.lineupIdx}
          pitcherHandedness={pendingDecision.pitcherHandedness}
          currentBatterMatchupDeltaPct={pendingDecision.currentBatterMatchupDeltaPct}
          currentBatterPlateAppearances={pendingDecision.currentBatterPlateAppearances}
          currentBatterFatigueContactPenalty={pendingDecision.currentBatterFatigueContactPenalty}
          currentBatterFatiguePowerPenalty={pendingDecision.currentBatterFatiguePowerPenalty}
          onSkip={onSkip}
          onDispatch={onDispatch}
          paused={paused}
        />
      );
    case "defensive_shift":
      return (
        <>
          <Prompt>Deploy defensive shift for this batter?</Prompt>
          <ActionButton
            $paused={paused}
            {...aria}
            onClick={() => onDispatch({ type: "set_defensive_shift", payload: true })}
          >
            Shift On (pop-outs ↑)
          </ActionButton>
          <ActionButton
            $paused={paused}
            {...aria}
            onClick={() => onDispatch({ type: "set_defensive_shift", payload: false })}
          >
            Normal Alignment
          </ActionButton>
          <SkipButton $paused={paused} {...aria} onClick={onSkip}>
            Skip
          </SkipButton>
        </>
      );
    default:
      return null;
  }
};

export default DecisionButtons;
