import * as React from "react";

import type { ManagerDecisionValues } from "@feat/gameplay/context/managerDecisionValues";
import {
  DEFAULT_MANAGER_DECISION_VALUES,
  getDefaultDecisionValues,
  STEAL_PCT_MAX,
  STEAL_PCT_MIN,
} from "@feat/gameplay/context/managerDecisionValues";
import TouchTooltip from "@shared/components/TouchTooltip";

import {
  DecisionPanelClose,
  DecisionPanelFooter,
  DecisionPanelSection,
  DecisionPanelTitle,
  DecisionPanelTitleRow,
  DecisionResetButton,
  DecisionResetConfirmRow,
  DecisionRow,
  DecisionRowLabel,
  DecisionRowValue,
  DecisionToggleRow,
  DecisionTuningBackdrop,
  DecisionTuningPanel,
  DecisionTuningToggle,
} from "./styles";

interface Props {
  values: ManagerDecisionValues;
  onChange: (values: ManagerDecisionValues) => void;
  onReset: () => void;
  /**
   * Optional callback fired whenever the panel opens or closes. Used by the
   * parent to auto-pause the simulation while the mobile bottom-sheet covers
   * the field, then restore the prior pause state on close.
   */
  onOpenChange?: (open: boolean) => void;
}

/**
 * Half-width of the "Modern" label deadband around the default
 * AI-pitching-aggressiveness value (50). Anything within ±MODERN_DEADBAND of
 * the default reads as "Modern" so small slider nudges don't flip the label
 * between Old-school / Modern / Bullpen.
 */
const MODERN_DEADBAND = 4;

/** Returns true when every field of `values` matches the current defaults. */
const isAtDefaults = (values: ManagerDecisionValues): boolean => {
  const defaults = getDefaultDecisionValues();
  return (Object.keys(defaults) as Array<keyof ManagerDecisionValues>).every(
    (key) => values[key] === defaults[key],
  );
};

const ManagerDecisionValuesPanel: React.FunctionComponent<Props> = ({
  values,
  onChange,
  onReset,
  onOpenChange,
}) => {
  const [open, setOpen] = React.useState(false);
  const [confirmReset, setConfirmReset] = React.useState(false);
  const toggleRef = React.useRef<HTMLButtonElement>(null);
  const closeBtnRef = React.useRef<HTMLButtonElement>(null);
  const titleId = React.useId();

  // Notify parent so it can pause/restore the sim while the panel is open.
  React.useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  // Move focus into the dialog when it opens (WCAG 2.1 APG dialog pattern).
  // Focus the ✕ close button so keyboard users can dismiss immediately or Tab
  // into the controls. Focus is restored to the toggle on close (see closePanel).
  React.useEffect(() => {
    if (open) closeBtnRef.current?.focus();
  }, [open]);

  // Clear confirm-reset state when the panel closes.
  React.useEffect(() => {
    if (!open) setConfirmReset(false);
  }, [open]);

  // Close on Escape and restore focus to the toggle for keyboard users.
  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const closePanel = React.useCallback(() => {
    setOpen(false);
    toggleRef.current?.focus();
  }, []);

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

  /** First click on "Reset to defaults" enters confirmation mode. */
  const handleResetClick = () => {
    setConfirmReset(true);
  };

  const atDefaults = isAtDefaults(values);
  const stealDisabled = !values.stealEnabled;

  return (
    <div data-testid="manager-decision-tuning-container">
      <DecisionTuningToggle
        ref={toggleRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        data-testid="manager-decision-tuning-toggle"
      >
        ⚙️ Decision Tuning{atDefaults ? " · defaults" : ""} {open ? "▲" : "▼"}
      </DecisionTuningToggle>

      {open && (
        <>
          <DecisionTuningBackdrop
            as="button"
            type="button"
            aria-label="Close Decision Tuning panel"
            onClick={closePanel}
          />
          {/*
           * TODO (accessibility): A full focus trap is recommended for aria-modal dialogs
           * (WCAG APG dialog pattern). Currently focus is moved into the dialog on open
           * and restored on close, but keyboard users can Tab out of the panel without
           * dismissing it. A future pass should wrap the panel content in a focus-trap
           * library or a custom useFocusTrap hook.
           */}
          <DecisionTuningPanel
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            data-testid="manager-decision-tuning-panel"
          >
            <DecisionPanelTitleRow>
              <DecisionPanelTitle id={titleId}>Manager &amp; AI Decision Values</DecisionPanelTitle>
              <DecisionPanelClose
                ref={closeBtnRef}
                type="button"
                aria-label="Close Decision Tuning panel"
                onClick={closePanel}
                data-testid="manager-decision-tuning-close"
              >
                ✕
              </DecisionPanelClose>
            </DecisionPanelTitleRow>

            {/* ── Steal ──────────────────────────────────────────────── */}
            <DecisionPanelSection>
              {/* Master switch lives at the top of its dependent-sliders section
                so the reading order matches dependency order. */}
              <DecisionToggleRow>
                <label htmlFor="steal-enabled">
                  Steal attempts
                  <TouchTooltip label="Master switch for stolen-base attempts. Off = neither you nor the AI is ever offered or attempts a steal (team-wide stop sign). Disables the two steal-threshold sliders below." />
                </label>
                <input
                  id="steal-enabled"
                  type="checkbox"
                  checked={values.stealEnabled}
                  onChange={(e) => set("stealEnabled", e.target.checked)}
                  data-testid="steal-enabled-toggle"
                />
              </DecisionToggleRow>

              <DecisionRow $disabled={stealDisabled}>
                <DecisionRowLabel htmlFor="steal-min-offer-pct">
                  Steal offer threshold
                  <TouchTooltip label="Minimum steal success % for you to be prompted. Lower = offer more steals." />
                </DecisionRowLabel>
                <input
                  id="steal-min-offer-pct"
                  type="range"
                  min={STEAL_PCT_MIN}
                  max={STEAL_PCT_MAX}
                  step={1}
                  value={values.stealMinOfferPct}
                  onChange={(e) => set("stealMinOfferPct", Number(e.target.value))}
                  aria-label="Steal offer threshold"
                  // aria-disabled omitted: the `disabled` HTML attribute already communicates
                  // disabled state to AT. aria-disabled is only needed when preserving keyboard
                  // focus while visually indicating disabled state, which is not the intent here.
                  disabled={stealDisabled}
                  data-testid="manager-steal-min-pct-slider"
                />
                <DecisionRowValue data-testid="manager-steal-min-pct-value">
                  {values.stealMinOfferPct}%
                </DecisionRowValue>
              </DecisionRow>

              <DecisionRow $disabled={stealDisabled}>
                <DecisionRowLabel htmlFor="ai-steal-threshold">
                  AI steal threshold
                  <TouchTooltip label="Minimum steal success % for the AI to attempt a steal. Must be ≤ offer threshold." />
                </DecisionRowLabel>
                <input
                  id="ai-steal-threshold"
                  type="range"
                  min={STEAL_PCT_MIN}
                  max={values.stealMinOfferPct}
                  step={1}
                  value={values.aiStealThreshold}
                  onChange={(e) => set("aiStealThreshold", Number(e.target.value))}
                  aria-label="AI steal threshold"
                  // aria-disabled omitted: same reason as steal-min-offer-pct above.
                  disabled={stealDisabled}
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
                {/*
                 * datalist provides semantic tick marks at the three named
                 * positions (Passive / Balanced / Aggressive) without replacing
                 * the free-range slider. Browser support is ≥ Chrome 20,
                 * Firefox 4, Safari 12.1.
                 */}
                <datalist id="ai-pitching-aggressiveness-ticks">
                  <option value="0" label="Passive" />
                  <option value="50" label="Balanced" />
                  <option value="100" label="Aggressive" />
                </datalist>
                <input
                  id="ai-pitching-aggressiveness"
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  list="ai-pitching-aggressiveness-ticks"
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

            {/*
             * Footer — contains the reset action. On mobile, safe-area-inset-bottom
             * padding ensures the buttons sit above the home-indicator bar on
             * notched/swipe-gesture iPhones.
             */}
            <DecisionPanelFooter>
              {confirmReset ? (
                <DecisionResetConfirmRow data-testid="manager-decision-tuning-reset-confirm-row">
                  <span>Reset to defaults?</span>
                  <button
                    type="button"
                    onClick={() => {
                      onReset();
                      setConfirmReset(false);
                    }}
                    data-testid="manager-decision-tuning-reset-confirm"
                  >
                    Yes, reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    data-testid="manager-decision-tuning-reset-cancel"
                  >
                    Cancel
                  </button>
                </DecisionResetConfirmRow>
              ) : (
                <DecisionResetButton
                  type="button"
                  onClick={handleResetClick}
                  data-testid="manager-decision-tuning-reset"
                >
                  Reset to defaults
                </DecisionResetButton>
              )}
            </DecisionPanelFooter>
          </DecisionTuningPanel>
        </>
      )}
    </div>
  );
};

export default ManagerDecisionValuesPanel;
