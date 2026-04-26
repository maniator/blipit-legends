import * as React from "react";

import { Bubble, BubbleCloseButton, Trigger, Wrapper } from "./styles";

interface Props {
  /** The tooltip body text. Wired to the bubble (referenced by `aria-describedby`)
   *  and the native `title` attribute so screen readers and right-click "inspect"
   *  still surface it. The trigger button uses a short generic `aria-label`
   *  ("More info") to avoid overly verbose announcements. */
  label: string;
  /** Trigger glyph. Defaults to the ⓘ info icon used throughout the app. */
  children?: React.ReactNode;
  /** Optional test id forwarded to the trigger button. */
  triggerTestId?: string;
}

/**
 * Accessible tooltip that works on **both desktop hover and mobile tap**.
 *
 * Why this exists: native `<span title="…">` tooltips do not display on touch
 * devices (no hover state), so the steal/bunt/IBB explanations in the Manager
 * Decision Tuning panel were invisible on phones. This component:
 *
 * - Tap on touch devices toggles a small popover; tap-outside or tap-again
 *   dismisses it. A visible × close glyph is rendered inside the bubble on
 *   touch devices (`hover: none`) so users have an explicit dismiss affordance
 *   without needing to tap-outside.
 * - Desktop hover continues to work (CSS `(hover: hover)` media query) so
 *   existing UX is preserved.
 * - Keyboard `Escape` closes the popover.
 * - The `title` attribute is kept as a fallback so right-click → inspect and
 *   some assistive-tech surfaces still show the text.
 * - The Bubble uses the HTML `hidden` attribute (+ CSS override to keep it in
 *   layout) so the desktop hover selector still fires and ARIA references remain
 *   valid while the bubble is closed.
 *
 * Use sparingly for short helper text. For long-form explanations, link to the
 * Help page instead.
 */
const TouchTooltip: React.FunctionComponent<Props> = ({ label, children = "ⓘ", triggerTestId }) => {
  const [open, setOpen] = React.useState(false);
  const wrapperRef = React.useRef<HTMLSpanElement>(null);
  const bubbleId = React.useId();

  const close = React.useCallback(() => setOpen(false), []);

  // Close on outside pointer-down or Escape key.
  React.useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <Wrapper ref={wrapperRef}>
      <Trigger
        type="button"
        aria-label="More info"
        aria-describedby={open ? bubbleId : undefined}
        aria-expanded={open}
        // Native `title` retained as a fallback for assistive tech and
        // browser dev-tools surfaces — does NOT render on touch devices,
        // which is exactly why this component exists.
        title={label}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        data-testid={triggerTestId}
      >
        {children}
      </Trigger>
      {/*
       * The `hidden` attribute is used instead of a CSS `display:none` / prop
       * toggle so the element stays in the DOM (keeping aria-describedby valid)
       * and the desktop :hover selector still fires. The Bubble styled component
       * overrides [hidden]→display:none with display:block + visibility:hidden.
       */}
      <Bubble
        id={bubbleId}
        hidden={!open}
        role="tooltip"
        aria-hidden={!open}
        data-testid="touch-tooltip-bubble"
      >
        {/*
         * × close button — only visible on touch devices via CSS (hover: none).
         * Gives an explicit dismiss affordance without requiring tap-outside.
         */}
        <BubbleCloseButton
          type="button"
          aria-label="Dismiss tooltip"
          onClick={(e) => {
            e.stopPropagation();
            close();
          }}
          data-testid="touch-tooltip-close"
        >
          ×
        </BubbleCloseButton>
        {label}
      </Bubble>
    </Wrapper>
  );
};

export default TouchTooltip;
