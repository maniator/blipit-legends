import { mq } from "@shared/utils/mediaQueries";
import styled from "styled-components";

export const Wrapper = styled.span`
  position: relative;
  display: inline-block;
  line-height: 1;
`;

export const Trigger = styled.button`
  background: none;
  border: 0;
  padding: 0 0.15rem;
  margin: 0;
  font: inherit;
  color: inherit;
  cursor: help;
  line-height: 1;
  /**
   * WCAG 2.5.8 target-size: minimum 24 × 24 px (1.5 rem at base 16px).
   * We set exactly 1.5 rem to satisfy the guideline without enlarging the
   * visual glyph size beyond what's needed.
   */
  min-width: 1.5rem;
  min-height: 1.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accentPrimary};
    outline-offset: 2px;
    border-radius: 4px;
  }
`;

/**
 * Bubble — the floating tooltip popover.
 *
 * Using the HTML `hidden` attribute (managed by React) lets us keep the
 * element in the DOM for ARIA references and for the desktop-hover CSS
 * selector to work, while semantically communicating "not relevant" to
 * assistive technology.
 *
 * The browser's default `[hidden] { display: none }` stylesheet would kill
 * hover on the parent Wrapper, so we override it to `display: block` and
 * rely on `visibility` + `opacity` for the show/hide animation instead.
 */
export const Bubble = styled.span`
  position: absolute;
  z-index: 50;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  white-space: normal;
  width: max-content;
  max-width: min(80vw, 22rem);
  padding: 0.5rem 0.625rem;
  background: ${({ theme }) => theme.colors.bgInput};
  color: ${({ theme }) => theme.colors.textPrimary};
  border-radius: 6px;
  font-size: ${({ theme }) => theme.fontSizes.sub};
  font-weight: 400;
  line-height: 1.35;
  text-align: left;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);

  /* ── Hidden state (default) ─────────────────────────────────────────────
     Override the browser's [hidden]→display:none so the element stays in
     layout and the ${Wrapper}:hover selector (desktop) still fires. */
  &[hidden] {
    display: block;
    visibility: hidden;
    opacity: 0;
    pointer-events: none;
    transition:
      opacity 100ms ease-in,
      visibility 0s linear 100ms;
  }

  /* ── Visible state ──────────────────────────────────────────────────── */
  &:not([hidden]) {
    visibility: visible;
    opacity: 1;
    pointer-events: auto;
    transition: opacity 100ms ease-in;
  }

  /* On devices that can hover (desktop), also show on hover regardless of
     the tap-toggle state, so existing hover UX is preserved. */
  ${mq.canHover} {
    ${Wrapper}:hover & {
      visibility: visible;
      opacity: 1;
    }
  }

  /* Small downward arrow */
  &::after {
    content: "";
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 5px solid transparent;
    border-top-color: ${({ theme }) => theme.colors.bgInput};
  }
`;

/**
 * × dismiss button rendered inside the Bubble.
 * Visible only on touch-primary devices (`hover: none`) — on desktop the
 * bubble dismisses via mouse-leave so the button would be redundant clutter.
 */
export const BubbleCloseButton = styled.button`
  /* Hidden on pointer/hover devices (desktop); shown on touch devices. */
  display: none;

  ${mq.noHover} {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    position: absolute;
    top: 0.25rem;
    right: 0.25rem;
    background: none;
    border: none;
    padding: 0;
    margin: 0;
    font: inherit;
    color: ${({ theme }) => theme.colors.textMuted};
    cursor: pointer;
    /* WCAG 2.5.8: 24 × 24 px minimum tap target */
    min-width: 1.5rem;
    min-height: 1.5rem;
    line-height: 1;
    font-size: 0.75rem;

    &:focus-visible {
      outline: 2px solid ${({ theme }) => theme.colors.accentPrimary};
      outline-offset: 2px;
      border-radius: 4px;
    }
  }
`;
