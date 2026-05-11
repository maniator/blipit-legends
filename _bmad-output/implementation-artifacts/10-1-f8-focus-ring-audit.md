# Story 10.1 — F8: Focus Indicator Audit

**Sprint:** Sprint 2  
**Epic:** F8 — Focus Indicator on Home Navigation  
**Status:** planned  
**Owner:** Amelia (impl) → Sally (sign-off)  
**Effort:** S  
**WCAG:** 2.4.7 "Focus Visible" Level AA; 2.4.11 "Focus Appearance" Level AA (WCAG 2.2)

---

## User Story

**As** a keyboard-only or power user navigating the app by tab,  
**I want** a clearly visible focus indicator on every interactive element,  
**so that** I always know which element is active and can navigate confidently.

---

## Background

The app currently uses `focus-visible`-only focus rings — these may miss keyboard users on older
browsers, and the ring styles may not be prominent enough (Winston: "Out of Sprint 1; reconsider
for Sprint 2 alongside F6 Tier 2"). Power users (P3, P5, P6) specifically flagged focus ring
quality as a productivity and accessibility concern.

Winston's Sprint 1 ruling: **deferred**. Sprint 2 candidate: **yes, alongside F6 Tier 2**.

---

## Acceptance Criteria

- [ ] All interactive elements (buttons, links, inputs, select, modal close buttons, save card actions) show a clearly visible focus ring when tabbed to
- [ ] Focus ring uses `:focus-visible` (not bare `:focus`) to avoid showing on mouse click
- [ ] Focus ring contrast meets WCAG 2.4.11: minimum 3:1 against adjacent colors, minimum area offset 2px, minimum perimeter
- [ ] Tab order is logical (document order, no tab traps except modals)
- [ ] Modal close button is reachable by keyboard; dialog can be dismissed with Escape
- [ ] E2E test: tab through home page key interactive elements; verify each receives visible focus
- [ ] No regression on existing visual snapshots (focus ring should not appear in non-focus screenshots)

---

## Files to Investigate

```bash
# Find existing focus styles
rg "focus\|focus-visible\|outline" src/ --files-with-matches | grep -v "\.snap$"
rg ":focus" src/shared/ src/features/ --files-with-matches
```

Likely:

- `src/shared/theme.ts` — may have a `focusRing` token
- Individual styled-components where `:focus` / `:focus-visible` is defined
- `src/index.scss` — any global focus reset

---

## Pre-PR Checklist

```bash
yarn lint
yarn typecheck
yarn typecheck:e2e
yarn test
yarn check:style-guide
# No snapshot regen expected (focus rings don't appear in idle screenshots)
# If snapshot diffs appear, review individually
```

---

## Notes

- If the fix is purely token-based (e.g., `outline: 2px solid ${theme.colors.primary.main};`),
  coordinate with Sally on the ring color choice — it must contrast against both the element
  background and the page background.
- Do not add `:focus` (without `-visible`) to elements that already handle mouse correctly.
- Modal tab-trap behavior: if a dialog is open, Tab should cycle within the dialog, not escape to
  the page behind it. Verify this for `InstructionsModal` and `SavesModal`.

---

## Routing

- Implementation: Amelia
- Sign-off: Sally (`bmad-agent-ux-designer`)
- Architectural CR: Winston (`bmad-agent-architect`) if focus ring affects design system tokens
