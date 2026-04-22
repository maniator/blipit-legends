import styled, { css } from "styled-components";

/**
 * Universal disabled styling applied when the panel is in the UI-paused
 * state (a blocking modal — e.g. SavesModal — is open). We use
 * `aria-disabled` instead of native `disabled` so keyboard focus can return
 * to a button after the modal closes; this CSS suppresses interaction.
 */
const pausedStyle = css`
  opacity: 0.4;
  cursor: not-allowed;
  pointer-events: none;
`;

export const Panel = styled.div`
  background: ${({ theme }) => theme.colors.bgDecisionOverlay};
  border: 2px solid ${({ theme }) => theme.colors.accentPrimary};
  border-radius: ${({ theme }) => theme.radii.xl};
  padding: ${({ theme }) => theme.spacing.s14} ${({ theme }) => theme.spacing.s18}
    ${({ theme }) => theme.spacing.s10};
  margin-top: ${({ theme }) => theme.spacing.s10};
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.s10};
  align-items: center;
  font-size: ${({ theme }) => theme.fontSizes.md};
`;

/**
 * Pause indicator shown above the decision buttons when a blocking modal
 * is open. Uses warn-surface tokens so it reads as a soft, non-error
 * advisory rather than a destructive alert.
 */
export const PausePill = styled.div`
  /* Force the pill onto its own row in the flex-wrap layout. */
  flex: 0 0 100%;
  display: inline-flex;
  align-self: flex-start;
  width: fit-content;
  background: ${({ theme }) => theme.colors.bgWarnSurface};
  border: 1px solid ${({ theme }) => theme.colors.borderWarn};
  color: ${({ theme }) => theme.colors.textWarnBold};
  border-radius: ${({ theme }) => theme.radii.pill};
  padding: ${({ theme }) => theme.spacing.xxs} ${({ theme }) => theme.spacing.sm};
  font-size: ${({ theme }) => theme.fontSizes.label};
  letter-spacing: ${({ theme }) => theme.letterSpacing.wide};
  text-transform: uppercase;
  font-weight: 600;
`;

/** Visually-hidden live region used to announce "Resumed" to screen readers. */
export const ResumeAnnouncement = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
`;

export const CountdownRow = styled.div<{ $paused?: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  width: 100%;
  margin-top: ${({ theme }) => theme.spacing.xs};
  ${({ $paused }) =>
    $paused &&
    css`
      opacity: 0.6;
    `}
`;

export const CountdownTrack = styled.div`
  flex: 1;
  height: ${({ theme }) => theme.sizes.progressBar};
  background: ${({ theme }) => theme.colors.bgDecisionSection};
  border-radius: ${({ theme }) => theme.radii.xxs};
  overflow: hidden;
`;

export const CountdownFill = styled.div<{ $pct: number; $paused?: boolean }>`
  height: 100%;
  width: ${({ $pct }) => $pct}%;
  background: ${({ $pct, $paused, theme }) =>
    $paused
      ? theme.colors.textMuted
      : $pct > 50
        ? theme.colors.bsoBall
        : $pct > 25
          ? theme.colors.countdownWarn
          : theme.colors.countdownDanger};
  border-radius: ${({ theme }) => theme.radii.xxs};
  /* Suppress fill / color animation while paused so the bar visibly freezes. */
  transition: ${({ $paused }) =>
    $paused
      ? "none"
      : `width 0.95s linear,
    background 0.5s ease`};
`;

export const CountdownLabel = styled.span`
  color: ${({ theme }) => theme.colors.textSubdued};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  white-space: nowrap;
  min-width: ${({ theme }) => theme.sizes.countdownLabel};
  text-align: right;
`;

// ── Decision button variants ─────────────────────────────────────────────────

export const ActionButton = styled.button<{ $paused?: boolean }>`
  background: ${({ theme }) => theme.colors.accentPrimary};
  color: ${({ theme }) => theme.colors.btnPrimaryText};
  padding: ${({ theme }) => theme.spacing.s7} ${({ theme }) => theme.spacing.s14};
  border-radius: ${({ theme }) => theme.radii.pill};
  cursor: pointer;
  border: none;
  font-family: inherit;
  font-size: ${({ theme }) => theme.fontSizes.base};
  font-weight: 600;
  &:focus-visible {
    outline: 3px solid ${({ theme }) => theme.colors.textPrimary};
    outline-offset: 2px;
  }
  ${({ $paused }) => $paused && pausedStyle}
`;

export const SkipButton = styled(ActionButton)`
  background: ${({ theme }) => theme.colors.bgDecisionButton};
  color: ${({ theme }) => theme.colors.textLight};
`;

export const Prompt = styled.span`
  flex: 1 1 auto;
  color: ${({ theme }) => theme.colors.textDecisionActive};
  font-weight: 600;
`;

export const Odds = styled.span`
  color: ${({ theme }) => theme.colors.textDecisionHighlight};
  font-size: ${({ theme }) => theme.fontSizes.base};
`;
