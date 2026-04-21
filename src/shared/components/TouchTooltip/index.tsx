import * as React from "react";

import { Bubble, Trigger, Wrapper } from "./styles";

interface Props {
  /** The tooltip body text. Also wired to `aria-label` and the native `title`
   *  attribute so screen readers and right-click "inspect" still surface it. */
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
 * devices (no hover state), so the steel/bunt/IBB explanations in the Manager
 * Decision Tuning panel were invisible on phones. This component:
 *
 * - Tap on touch devices toggles a small popover; tap-outside or tap-again
 *   dismisses it.
 * - Desktop hover continues to work (CSS `(hover: hover)` media query) so
 *   existing UX is preserved.
 * - Keyboard `Escape` closes the popover.
 * - The `title` attribute is kept as a fallback so right-click → inspect and
 *   some assistive-tech surfaces still show the text.
 *
 * Use sparingly for short helper text. For long-form explanations, link to the
 * Help page instead.
 */
const TouchTooltip: React.FunctionComponent<Props> = ({ label, children = "ⓘ", triggerTestId }) => {
  const [open, setOpen] = React.useState(false);
  const wrapperRef = React.useRef<HTMLSpanElement>(null);

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
        aria-label={label}
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
      <Bubble $open={open} role="tooltip">
        {label}
      </Bubble>
    </Wrapper>
  );
};

export default TouchTooltip;
