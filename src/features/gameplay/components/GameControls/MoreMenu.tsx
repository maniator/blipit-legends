import * as React from "react";

import { MoreMenuMobileSlot, MoreMenuPanel, MoreTriggerButton, MoreTriggerChevron } from "./styles";

const PANEL_ID = "game-header-more";

type MoreMenuProps = {
  /**
   * Disabled while a manager decision is awaiting input. The trigger remains
   * visible (so the user can see it exists) but reports `aria-disabled` and
   * the panel auto-collapses if it was open.
   */
  disabled?: boolean;
  /** Children rendered inside the disclosure panel. */
  children: React.ReactNode;
};

/**
 * Find all focusable elements inside `root`, in DOM order.
 * Used to move focus to the first control when the panel opens.
 */
const queryFocusable = (root: HTMLElement): HTMLElement[] => {
  const selector = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    '[tabindex]:not([tabindex="-1"])',
  ].join(",");
  return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
    (el) => !el.hasAttribute("aria-hidden"),
  );
};

/**
 * Mobile-only disclosure that collapses non-critical game controls behind a
 * single "More" trigger. Bottom-anchored, non-modal — the game continues to
 * run underneath. Closes on Escape, click-outside, or repeat-tap.
 *
 * Renders the trigger inside `MoreMenuMobileSlot` (display:none on desktop)
 * and the panel inside `MoreMenuPanel` (also hidden on desktop), so on
 * desktop/tablet this component contributes no visible UI.
 */
const MoreMenu: React.FunctionComponent<MoreMenuProps> = ({ disabled = false, children }) => {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const panelRef = React.useRef<HTMLDivElement | null>(null);

  // Auto-collapse when a manager decision becomes active. The trigger reports
  // aria-disabled while disabled is true.
  React.useEffect(() => {
    if (disabled && open) setOpen(false);
  }, [disabled, open]);

  // Escape closes; click outside the panel and trigger closes.
  React.useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    const handlePointer = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("touchstart", handlePointer);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("touchstart", handlePointer);
    };
  }, [open]);

  // Focus management: on open, move focus into the panel; on close, return
  // focus to the trigger. Skipped if the panel never mounted with content.
  const wasOpenRef = React.useRef(false);
  React.useEffect(() => {
    if (open && !wasOpenRef.current) {
      // Defer to allow the panel to mount/animate in.
      const id = window.requestAnimationFrame(() => {
        if (panelRef.current) {
          const focusable = queryFocusable(panelRef.current);
          (focusable[0] ?? panelRef.current).focus();
        }
      });
      wasOpenRef.current = true;
      return () => window.cancelAnimationFrame(id);
    }
    if (!open && wasOpenRef.current) {
      wasOpenRef.current = false;
      triggerRef.current?.focus();
    }
    return undefined;
  }, [open]);

  const handleClick = () => {
    if (disabled) return;
    setOpen((prev) => !prev);
  };

  return (
    <>
      <MoreMenuMobileSlot>
        <MoreTriggerButton
          ref={triggerRef}
          type="button"
          $expanded={open}
          onClick={handleClick}
          aria-expanded={open}
          aria-controls={PANEL_ID}
          aria-haspopup="true"
          aria-label="More game controls"
          aria-disabled={disabled || undefined}
          title={disabled ? "Available after the decision" : undefined}
          data-testid="game-header-more-trigger"
        >
          {open ? "Less" : "More"}
          <MoreTriggerChevron aria-hidden="true" $expanded={open}>
            ▾
          </MoreTriggerChevron>
        </MoreTriggerButton>
      </MoreMenuMobileSlot>
      <MoreMenuPanel
        ref={panelRef}
        id={PANEL_ID}
        role="region"
        aria-label="Additional game controls"
        $open={open}
        // Use inert-style hiding when closed so off-screen controls don't
        // grab focus during keyboard navigation.
        aria-hidden={!open}
        tabIndex={-1}
        data-testid="game-header-more-panel"
        data-state={open ? "open" : "closed"}
      >
        {children}
      </MoreMenuPanel>
    </>
  );
};

export default MoreMenu;
