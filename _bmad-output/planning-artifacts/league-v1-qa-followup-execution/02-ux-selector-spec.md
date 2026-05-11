# 02 — UX/a11y spec: mixed-mode managed-team selector

Reference screenshot: `docs/league-v1-followup/screenshots/mixed-mode-review-dropdown-unreadable-user-screenshot.png`

## Scope

Final UX specification for the mixed-mode “Which team will you manage?” selector and adjacent validation behavior.

## Readability requirements (mobile + desktop)

- Selector label and selected value must be readable without zoom at mobile and desktop breakpoints.
- Control width must prevent truncation of common team names in default state.
- Default, hover, focus, and selected states must keep text legible.
- Error message text must remain readable and anchored directly to the selector field.

## Contrast and typography requirements

- Field text, placeholder/selected text, label text, and error text must meet accessible contrast against their backgrounds.
- Typography must use app-approved body/input scale from `docs/style-guide.md` with no reduced one-off sizing.
- Disabled/invalid styles must remain distinguishable without sacrificing readability.

## Interaction requirements (keyboard + mouse)

- Mouse: click/tap reliably opens selector options and commits selection.
- Keyboard: focusable in tab order; open/select/close behaviors are operable via keyboard keys supported by native select/combobox patterns.
- Visible focus indicator is required for the control and must remain visible in invalid state.
- Selected value persists visibly after closing the options list.

## Inline validation/error placement requirements

- Managed-team selection is explicitly required before season creation.
- Validation message appears inline at the selector field (not only in top-level or late review summary).
- Step-level gating blocks progression when selection is missing/invalid.
- Error clears immediately after valid selection.

## Testable acceptance criteria (aligned to shift-left plan)

1. Component test: selector renders legibly and enabled in mixed mode.
2. Unit/component test: create/progress is blocked until explicit managed-team selection is made.
3. E2E test: mouse and keyboard interactions both produce a stable selection.
4. E2E + a11y guard: control readability/contrast regressions fail CI.
5. Mobile and desktop viewport assertions verify selector usability and readable selected value.
