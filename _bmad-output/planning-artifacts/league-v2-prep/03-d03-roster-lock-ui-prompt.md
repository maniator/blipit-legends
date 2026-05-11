# D-03 Implementation Prompt — Roster Lock UI Indicator

> Copy-paste this prompt verbatim into a new Copilot agent session.  
> This is a short, UI-only accessibility/discoverability fix. No schema changes. No Winston CR required.

---

## Context

`customTeamStore.ts:85-97` already guards against editing teams that are locked to an active
season — attempts to edit a locked team are blocked at the storage layer. However,
`ManageTeamsScreen` does not surface any visual indicator of this lock state. A user who tries
to edit a locked team receives a silent failure or a generic error with no explanation.

This fix adds a 🔒 indicator to locked team rows so users can see at a glance which teams are
in an active season and cannot be edited.

---

## Canonical Spec Reference

`docs/league-v1-followup/08-deferred-to-v2.md` § D-03

---

## Pre-Reading

- `src/features/customTeams/storage/customTeamStore.ts:85-97` — understand the lock guard
- `src/features/customTeams/pages/ManageTeamsScreen/` — locate team row rendering
- `docs/style-guide.md` — **must consult before introducing any new visual element.** The lock
  icon must use an existing color token (muted/secondary). Do not add new CSS variables or
  styled-components color literals.

---

## Style Guide Rule (mandatory)

Before writing any styles, open `docs/style-guide.md` and find the correct muted/secondary color
token for an informational icon state. Do not introduce a one-off color. If the style guide does
not have a lock/locked-state pattern, route to Sally (`bmad-agent-ux-designer`) for sign-off
before implementing the visual treatment.

---

## Implementation Steps

1. Open `ManageTeamsScreen` and locate the component responsible for rendering individual team
   rows (or list items).
2. Determine how team lock status is currently exposed — check whether the team data object
   returned by the store/hook includes a `locked` field, or whether it must be derived.
3. Conditionally render a 🔒 indicator next to the team name when the team is locked:
   - Use an existing muted color token from `docs/style-guide.md`
   - Add `aria-label="Locked to active season"` (or equivalent) on the icon element for
     screen-reader accessibility
   - Consider adding a `title` attribute as a hover tooltip: "This team is locked to an active
     season and cannot be edited."
4. If a user clicks Edit on a locked team and the storage guard fires, surface a brief user-facing
   message: "This team is part of an active season and cannot be edited." Prefer an inline notice
   over a modal — non-blocking.
5. Confirm unlocked team rows are visually unchanged (no regression on normal rows).

---

## Acceptance Criteria

- Locked team rows display 🔒 with `aria-label="Locked to active season"`.
- Unlocked team rows show no lock icon (no visual regression).
- Attempting to edit a locked team surfaces a clear, non-blocking inline message.
- The 🔒 icon uses an existing style-guide color token — no new CSS variables.
- `yarn typecheck` passes; `yarn lint` passes.

---

## Validation

```bash
yarn lint
yarn format:check
yarn typecheck
yarn build
```

---

## Out of Scope

- Changing the lock/unlock logic in `customTeamStore`
- Bulk-unlock UI
- Any changes to `SeasonHomePage` or roster management within seasons
