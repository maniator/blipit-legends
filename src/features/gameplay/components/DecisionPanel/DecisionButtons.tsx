import * as React from "react";

import type { DecisionType, Strategy } from "@feat/gameplay/context/index";

import PinchHitterDecisionButtons from "./PinchHitterDecisionButtons";
import { ActionButton, Odds, Prompt, SkipButton } from "./styles";

type Props = {
  pendingDecision: DecisionType;
  strategy: Strategy;
  onSkip: () => void;
  onDispatch: (action: { type: string; payload?: unknown }) => void;
};

const DecisionButtons: React.FunctionComponent<Props> = ({
  pendingDecision,
  strategy,
  onSkip,
  onDispatch,
}) => {
  switch (pendingDecision.kind) {
    case "steal": {
      const { base, successPct } = pendingDecision;
      return (
        <>
          <Prompt>Steal attempt from {base === 0 ? "1st" : "2nd"} base?</Prompt>
          <Odds>Est. success: {successPct}%</Odds>
          <ActionButton
            onClick={() => onDispatch({ type: "steal_attempt", payload: { base, successPct } })}
          >
            Yes, steal!
          </ActionButton>
          <SkipButton onClick={onSkip}>Skip</SkipButton>
        </>
      );
    }
    case "bunt":
      return (
        <>
          <Prompt>Sacrifice bunt?</Prompt>
          <ActionButton onClick={() => onDispatch({ type: "bunt_attempt", payload: { strategy } })}>
            Yes, bunt!
          </ActionButton>
          <SkipButton onClick={onSkip}>Skip</SkipButton>
        </>
      );
    case "count30":
      return (
        <>
          <Prompt>Count is 3-0. Take or swing?</Prompt>
          <ActionButton
            onClick={() => onDispatch({ type: "set_one_pitch_modifier", payload: "take" })}
          >
            Take (walk odds ↑)
          </ActionButton>
          <ActionButton
            onClick={() => onDispatch({ type: "set_one_pitch_modifier", payload: "swing" })}
          >
            Swing away
          </ActionButton>
          <SkipButton onClick={onSkip}>Skip</SkipButton>
        </>
      );
    case "count02":
      return (
        <>
          <Prompt>Count is 0-2. Protect or normal swing?</Prompt>
          <ActionButton
            onClick={() => onDispatch({ type: "set_one_pitch_modifier", payload: "protect" })}
          >
            Protect (contact ↑)
          </ActionButton>
          <ActionButton
            onClick={() => onDispatch({ type: "set_one_pitch_modifier", payload: "normal" })}
          >
            Normal swing
          </ActionButton>
          <SkipButton onClick={onSkip}>Skip</SkipButton>
        </>
      );
    case "ibb":
      return (
        <>
          <Prompt>Issue an intentional walk?</Prompt>
          <ActionButton onClick={() => onDispatch({ type: "intentional_walk" })}>
            Yes, walk them
          </ActionButton>
          <SkipButton onClick={onSkip}>Skip</SkipButton>
        </>
      );
    case "ibb_or_steal": {
      const { base, successPct } = pendingDecision;
      return (
        <>
          <Prompt>Intentional walk or steal?</Prompt>
          <Odds>Steal success: {successPct}%</Odds>
          <ActionButton onClick={() => onDispatch({ type: "intentional_walk" })}>
            🥾 Intentional Walk
          </ActionButton>
          <ActionButton
            onClick={() => onDispatch({ type: "steal_attempt", payload: { base, successPct } })}
          >
            ⚡ Steal! ({successPct}%)
          </ActionButton>
          <SkipButton onClick={onSkip}>⏭ Skip</SkipButton>
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
        />
      );
    case "defensive_shift":
      return (
        <>
          <Prompt>Deploy defensive shift for this batter?</Prompt>
          <ActionButton onClick={() => onDispatch({ type: "set_defensive_shift", payload: true })}>
            Shift On (pop-outs ↑)
          </ActionButton>
          <ActionButton onClick={() => onDispatch({ type: "set_defensive_shift", payload: false })}>
            Normal Alignment
          </ActionButton>
          <SkipButton onClick={onSkip}>Skip</SkipButton>
        </>
      );
    default:
      return null;
  }
};

export default DecisionButtons;
