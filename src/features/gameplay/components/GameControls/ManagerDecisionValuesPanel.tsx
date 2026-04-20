import * as React from "react";

import type { ManagerDecisionValues } from "@feat/gameplay/context/managerDecisionValues";
import { DEFAULT_MANAGER_DECISION_VALUES } from "@feat/gameplay/context/managerDecisionValues";

import {
  DecisionPanelSection,
  DecisionPanelTitle,
  DecisionResetButton,
  DecisionRow,
  DecisionRowLabel,
  DecisionRowValue,
  DecisionToggleRow,
  DecisionTuningPanel,
  DecisionTuningToggle,
} from "./styles";

interface Props {
  values: ManagerDecisionValues;
  onChange: (values: ManagerDecisionValues) => void;
  onReset: () => void;
}

const ManagerDecisionValuesPanel: React.FunctionComponent<Props> = ({
  values,
  onChange,
  onReset,
}) => {
  const [open, setOpen] = React.useState(false);

  const set = <K extends keyof ManagerDecisionValues>(key: K, val: ManagerDecisionValues[K]) => {
    if (key === "stealMinOfferPct" && typeof val === "number") {
      // Keep aiStealThreshold ≤ stealMinOfferPct when user lowers the offer threshold.
      const newOffer = val as number;
      const clampedAi = Math.min(values.aiStealThreshold, newOffer);
      onChange({ ...values, stealMinOfferPct: newOffer, aiStealThreshold: clampedAi });
      return;
    }
    onChange({ ...values, [key]: val });
  };

  return (
    <div data-testid="manager-decision-tuning-container">
      <DecisionTuningToggle
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        data-testid="manager-decision-tuning-toggle"
      >
        ⚙️ Decision Tuning {open ? "▲" : "▼"}
      </DecisionTuningToggle>

      {open && (
        <DecisionTuningPanel data-testid="manager-decision-tuning-panel">
          <DecisionPanelTitle>Manager &amp; AI Decision Values</DecisionPanelTitle>

          {/* ── Steal ──────────────────────────────────────────────── */}
          <DecisionPanelSection>
            <DecisionRow>
              <DecisionRowLabel htmlFor="steal-min-offer-pct">
                Steal offer threshold
                <span title="Minimum steal success % for you to be prompted. Lower = offer more steals.">
                  {" "}
                  ⓘ
                </span>
              </DecisionRowLabel>
              <input
                id="steal-min-offer-pct"
                type="range"
                min={55}
                max={85}
                step={1}
                value={values.stealMinOfferPct}
                onChange={(e) => set("stealMinOfferPct", Number(e.target.value))}
                aria-label="Steal offer threshold"
                data-testid="manager-steal-min-pct-slider"
              />
              <DecisionRowValue data-testid="manager-steal-min-pct-value">
                {values.stealMinOfferPct}%
              </DecisionRowValue>
            </DecisionRow>

            <DecisionRow>
              <DecisionRowLabel htmlFor="ai-steal-threshold">
                AI steal threshold
                <span title="Minimum steal success % for the AI to attempt a steal. Must be ≤ offer threshold.">
                  {" "}
                  ⓘ
                </span>
              </DecisionRowLabel>
              <input
                id="ai-steal-threshold"
                type="range"
                min={55}
                max={values.stealMinOfferPct}
                step={1}
                value={values.aiStealThreshold}
                onChange={(e) => set("aiStealThreshold", Number(e.target.value))}
                aria-label="AI steal threshold"
                data-testid="ai-steal-threshold-slider"
              />
              <DecisionRowValue data-testid="ai-steal-threshold-value">
                {values.aiStealThreshold}%
              </DecisionRowValue>
            </DecisionRow>
          </DecisionPanelSection>

          {/* ── Tactical toggles ──────────────────────────────────── */}
          <DecisionPanelSection>
            <DecisionToggleRow>
              <label htmlFor="bunt-enabled">
                Sacrifice bunt
                <span title="Offer / attempt sacrifice bunt in late close games."> ⓘ</span>
              </label>
              <input
                id="bunt-enabled"
                type="checkbox"
                checked={values.buntEnabled}
                onChange={(e) => set("buntEnabled", e.target.checked)}
                data-testid="bunt-enabled-toggle"
              />
            </DecisionToggleRow>

            <DecisionToggleRow>
              <label htmlFor="ibb-enabled">
                Intentional walk (IBB)
                <span title="Offer / attempt intentional walk with 2 outs, late inning, close game.">
                  {" "}
                  ⓘ
                </span>
              </label>
              <input
                id="ibb-enabled"
                type="checkbox"
                checked={values.ibbEnabled}
                onChange={(e) => set("ibbEnabled", e.target.checked)}
                data-testid="ibb-enabled-toggle"
              />
            </DecisionToggleRow>

            <DecisionToggleRow>
              <label htmlFor="pinch-hitter-enabled">
                Pinch hitter
                <span title="Offer / attempt pinch hitter substitution in late innings with runners on base.">
                  {" "}
                  ⓘ
                </span>
              </label>
              <input
                id="pinch-hitter-enabled"
                type="checkbox"
                checked={values.pinchHitterEnabled}
                onChange={(e) => set("pinchHitterEnabled", e.target.checked)}
                data-testid="pinch-hitter-enabled-toggle"
              />
            </DecisionToggleRow>

            <DecisionToggleRow>
              <label htmlFor="defensive-shift-enabled">
                Defensive shift
                <span title="Offer / apply defensive shift (pre-2023 rules). Off = 2023 MLB shift ban.">
                  {" "}
                  ⓘ
                </span>
              </label>
              <input
                id="defensive-shift-enabled"
                type="checkbox"
                checked={values.defensiveShiftEnabled}
                onChange={(e) => set("defensiveShiftEnabled", e.target.checked)}
                data-testid="defensive-shift-enabled-toggle"
              />
            </DecisionToggleRow>
          </DecisionPanelSection>

          {/* ── AI pitching aggressiveness ─────────────────────────── */}
          <DecisionPanelSection>
            <DecisionRow>
              <DecisionRowLabel htmlFor="ai-pitching-aggressiveness">
                AI pitching aggressiveness
                <span title="0 = old-school (complete games), 50 = modern MLB, 100 = bullpen-first.">
                  {" "}
                  ⓘ
                </span>
              </DecisionRowLabel>
              <input
                id="ai-pitching-aggressiveness"
                type="range"
                min={0}
                max={100}
                step={5}
                value={values.aiPitchingChangeAggressiveness}
                onChange={(e) => set("aiPitchingChangeAggressiveness", Number(e.target.value))}
                aria-label="AI pitching change aggressiveness"
                data-testid="ai-pitching-aggressiveness-slider"
              />
              <DecisionRowValue data-testid="ai-pitching-aggressiveness-value">
                {values.aiPitchingChangeAggressiveness === DEFAULT_MANAGER_DECISION_VALUES.aiPitchingChangeAggressiveness
                  ? "Modern"
                  : values.aiPitchingChangeAggressiveness < 50
                    ? `Old-school (${values.aiPitchingChangeAggressiveness})`
                    : `Bullpen (${values.aiPitchingChangeAggressiveness})`}
              </DecisionRowValue>
            </DecisionRow>
          </DecisionPanelSection>

          <DecisionResetButton
            type="button"
            onClick={onReset}
            data-testid="manager-decision-tuning-reset"
          >
            Reset to defaults
          </DecisionResetButton>
        </DecisionTuningPanel>
      )}
    </div>
  );
};

export default ManagerDecisionValuesPanel;
