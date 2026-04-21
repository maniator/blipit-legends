import * as React from "react";

import type { ManagerDecisionValues } from "@feat/gameplay/context/managerDecisionValues";
import { DEFAULT_MANAGER_DECISION_VALUES } from "@feat/gameplay/context/managerDecisionValues";
import TouchTooltip from "@shared/components/TouchTooltip";

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

/**
 * Half-width of the "Modern" label deadband around the default
 * AI-pitching-aggressiveness value (50). Anything within ±MODERN_DEADBAND of
 * the default reads as "Modern" so small slider nudges don't flip the label
 * between Old-school / Modern / Bullpen.
 */
const MODERN_DEADBAND = 4;

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
                <TouchTooltip label="Minimum steal success % for you to be prompted. Lower = offer more steals." />
              </DecisionRowLabel>
              <input
                id="steal-min-offer-pct"
                type="range"
                min={62}
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
                <TouchTooltip label="Minimum steal success % for the AI to attempt a steal. Must be ≤ offer threshold." />
              </DecisionRowLabel>
              <input
                id="ai-steal-threshold"
                type="range"
                min={62}
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
              <label htmlFor="steal-enabled">
                Steal attempts
                <TouchTooltip label="Master switch for stolen-base attempts. Off = neither you nor the AI is ever offered or attempts a steal (team-wide stop sign)." />
              </label>
              <input
                id="steal-enabled"
                type="checkbox"
                checked={values.stealEnabled}
                onChange={(e) => set("stealEnabled", e.target.checked)}
                data-testid="steal-enabled-toggle"
              />
            </DecisionToggleRow>

            <DecisionToggleRow>
              <label htmlFor="bunt-enabled">
                Sacrifice bunt
                <TouchTooltip label="Offer / attempt sacrifice bunt only when tied or trailing in late close games (within 2 runs)." />
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
                <TouchTooltip label="Offer / attempt intentional walk: 1st base open, 2 outs, late inning, close game." />
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
                <TouchTooltip label="Offer / attempt pinch hitter substitution in late innings with runners on base." />
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
                <TouchTooltip label="Offer / apply defensive shift (pre-2023 rules). Off = 2023 MLB shift ban." />
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
                <TouchTooltip label="0 = old-school (complete games), 50 = modern MLB, 100 = bullpen-first." />
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
                {/*
                  Modern label deadband (see MODERN_DEADBAND constant): anything
                  within ±MODERN_DEADBAND of the default 50 reads as "Modern" so
                  small slider nudges don't flip the label. Below the band =
                  Old-school; above the band = Bullpen.
                */}
                {Math.abs(
                  values.aiPitchingChangeAggressiveness -
                    DEFAULT_MANAGER_DECISION_VALUES.aiPitchingChangeAggressiveness,
                ) <= MODERN_DEADBAND
                  ? `Modern (${values.aiPitchingChangeAggressiveness})`
                  : values.aiPitchingChangeAggressiveness <
                      DEFAULT_MANAGER_DECISION_VALUES.aiPitchingChangeAggressiveness
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
