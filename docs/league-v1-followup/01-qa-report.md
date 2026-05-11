# BlipIt Baseball Legends QA Report and League Mode v1 Completion Review

Date: 2026-05-11
Repository: `maniator/blipit-legends`
Site reviewed: https://blipit.net
Relevant docs: `_bmad-output`, especially League Mode v1 implementation/planning artifacts.

## Summary

League Mode v1 is partially functional. A user can create a league season, advance standings in at least some flows, open a schedule, watch games, and play a managed game. However, v1 does not appear complete enough to move safely into League Mode v2 yet.

The highest-risk gaps are around mixed-mode season setup, managed vs watched game permissions, headless advancement, missing or incomplete league pages, and several accessibility/readability issues. There are also non-league issues in team management, save/export UX, drag-and-drop behavior, audio controls, and general UI feedback that should be addressed before v2 expands the surface area.

## Scope Tested

This QA pass covered:

- Home screen and league entry points.
- League creation wizard, including auto-generated and mixed team modes.
- Season home page and standings.
- Season schedule page.
- Watching games from the schedule.
- Playing a managed season game.
- Attempting to headlessly advance games.
- Team management create/edit/export/import/delete areas.
- Exhibition games and saves modal.
- General UI, accessibility, and responsiveness concerns.

Desktop testing was performed in browser. Mobile was reviewed through the available user-provided screenshot and responsive/layout observations; direct mobile-device QA should still be done before closing this issue.

## Key Evidence Screenshot

The included screenshot shows the mixed-mode review step where the “Which team will you manage?” field appears as a small unreadable field and does not behave like a usable dropdown.

Screenshot path in this package:

`screenshots/mixed-mode-review-dropdown-unreadable-user-screenshot.png`

## League Mode v1 Completion Assessment

League Mode v1 should not be considered complete yet.

The docs/spec appear to require a v1 experience where users can create a season, select a managed team, play or watch scheduled games with correct permissions, headlessly advance AI-managed games, and navigate through season home/schedule/team views. The current implementation has pieces of this, but several user-facing flows are incomplete or incorrect.

## Priority Findings

### P0: Watch mode still allows manager controls

When a scheduled league game is launched using **Watch**, the game view still exposes the **Manager Mode** toggle and manager-only controls such as substitutions and decision tuning. This violates the expected distinction between watching and managing.

Expected behavior:

- Watch mode should be spectator-only.
- Manager Mode should be hidden or disabled when the user selected **Watch**.
- Substitution controls, strategy controls, and decision-tuning controls should not be available to a spectator.
- The route/query/state should preserve whether the user launched the game as `watch` or `manage`.

Impact:

This is a v1 correctness issue, not just UI polish. It allows the user to manage teams when the selected mode says they are watching.

### P0: Missing true headless advancement for managed-team games

On the mixed season home page, clicking **Advance Season** surfaces a message like “Your next game is ready!” and offers **Play in Manager Mode** or **Watch**. There does not appear to be an option to auto-simulate the game without watching or managing.

Expected behavior:

- If the user does not want to play/watch the managed team’s game, they should be able to auto-simulate it.
- The AI should manage both teams.
- The game should complete headlessly.
- The score should write back to the schedule/standings.
- The season should advance when applicable.

Impact:

The user can advance non-managed games through the season flow, but when their managed team’s game is ready, they are forced into watching or playing. This blocks the “advance the schedule without watching/playing” v1 use case.

### P0: Mixed-mode “Which team will you manage?” field is inaccessible and unreadable

In Mixed mode, the review step includes a “Which team will you manage?” field. It appears as a very small low-contrast field and does not reliably open as a dropdown when clicked. Keyboard interaction also appears unreliable.

Observed behavior:

- The field is hard to read.
- Clicking the field does not present a useful dropdown.
- It is unclear which team is selected.
- The season can still be created, and the app appears to auto-assign a managed team from the picked teams.

Expected behavior:

- The field should be a clearly styled select/combobox.
- Options should be legible.
- It should work with mouse and keyboard.
- The user must explicitly select the managed team before creating the season.
- If no team is selected, creation should be blocked with an inline error.

Impact:

This breaks a central Mixed mode promise: the user should control which team they manage.

### P0: League setup validation allows invalid progression

The wizard lets the user proceed through steps even when team selection is incomplete or invalid. For example, hand-picking too few teams can reach the review step and then fail late.

Expected behavior:

- Validate each wizard step before allowing **Next**.
- For handpick mode, enforce exactly eight teams for the current Mini preset.
- For mixed mode, clearly show how many teams are user-picked and how many will be auto-generated.
- For mixed mode, require a managed team selection from the user-picked teams.
- Show inline validation next to the relevant field, not only on final review.

Impact:

This creates confusing failures and permits invalid wizard states.

### P1: SeasonTeamPage appears missing or unused

The v1 docs call for a season team page at a route like `/leagues/:seasonId/teams/:seasonTeamId` with roster/fatigue information. I did not find a working season-specific team page from the UI. The **View teams** flow sends users to global Manage Teams rather than a season-team view.

Expected behavior:

- Season home or hub should link to season-specific team pages.
- Season team pages should show roster snapshot, batting order, pitching/bench info, and fatigue status.
- The page should be read-only or lock protected where applicable.

Impact:

This leaves users without a proper way to inspect league rosters and fatigue in context.

### P1: Roster-edit lock is not visible in the main team management path

The docs describe a locked mode for teams in active seasons. The current Manage Teams page appears to allow normal edit paths and does not clearly surface active-season locking or read-only behavior.

Expected behavior:

- Teams currently enrolled in an active season should show a lock/banner.
- Destructive actions should be hidden or blocked.
- Editing should be disabled or limited to sanctioned league paths.
- Storage-layer guards should still enforce this even if the UI is bypassed.

Impact:

This risks corrupting the season roster snapshot or creating inconsistency between team data and league data.

### P1: League hub states are incomplete

The `/leagues` page has a basic active/completed season experience, but it does not appear to support all expected canonical states.

Expected behavior:

- Empty state with clear start-season CTA.
- Active season continue state.
- Completed/champion state.
- Quick start or bypass state where appropriate.
- Clear path to create a new season when allowed.
- Clear handling for only-one-active-season constraints.

Impact:

Users can get into league flows, but the hub does not yet feel like the canonical league dashboard.

### P1: Season home page lacks a complete next-game/schedule preview UX

The season home page shows standings and an advance button, but the next-game flow is not complete. It should clearly present the next scheduled game and allow the correct mode: manage, watch, or headless sim.

Expected behavior:

- Show next game or next day preview.
- If the next game involves the managed team, offer Play, Watch, and Auto-simulate.
- If the next day only has non-managed games, allow headless advance.
- After game completion, update standings and schedule without stale state.

Impact:

The user cannot efficiently control how to progress a season.

## Non-League QA Findings

### Team management: drag-and-drop/reordering issues

Player reordering did not work reliably in Manage Teams. Attempting to drag players did not visibly reorder them or persist a changed order.

Recommended fix:

- Implement or repair drag-and-drop for batting order and pitching rotation.
- Ensure changes persist after save.
- Add keyboard-accessible alternatives for reordering.
- Add regression tests for player ordering persistence.

### Team export/import lacks feedback

Clicking **Export** beside a team did not clearly download a file or show a success message. Importing from text/file also lacks clear success/failure feedback.

Recommended fix:

- Export should download a JSON file by default.
- Also optionally support copy-to-clipboard, but show a toast.
- Import should validate the file and show success/failure messages.
- After successful import, the new/updated team should be visible immediately.

### Saves modal export/import lacks feedback

The in-game Saves modal allows save/export/import actions, but export/import feedback is unclear.

Recommended fix:

- Export saves as JSON files.
- Show clear success/failure toast messages.
- Validate imported save format and show actionable errors.
- Add round-trip tests: export save, import save, load save.

### Music/audio control is unclear

The music note control appears to toggle audio, but there is no label, tooltip, or volume control.

Recommended fix:

- Add accessible label and tooltip.
- Add volume slider or basic mute/unmute text.
- Persist audio preference.

### PWA/offline expectations are unclear

The app shows install affordances, but offline behavior and PWA capability are unclear.

Recommended fix:

- Add offline fallback page or offline banner.
- Cache app shell and essential assets.
- Document what works offline.

## Accessibility and Readability Issues

- Low-contrast text appears in several form controls and dropdowns.
- The “Which team will you manage?” field is especially hard to read.
- Some controls lack visible focus states.
- Some icon buttons likely lack accessible names.
- Sliders and custom controls need keyboard support.
- Small font sizes make prompts hard to read, especially on mobile.
- Modals should use `dvh` sizing and be checked on narrow screens.

Recommended fix:

- Run an accessibility audit on league wizard, game page, team manager, and saves modal.
- Add `aria-label` to icon-only controls.
- Use native controls where possible or implement full ARIA combobox behavior.
- Increase contrast and font sizes for form fields and prompts.
- Ensure all controls are reachable and operable by keyboard.

## Suggested Implementation Order

1. Fix Mixed-mode managed team selection dropdown and validation.
2. Fix watch vs manage permissions in GamePage.
3. Add auto-simulate/headless advancement for managed-team games.
4. Add tests for Play, Watch, Auto-simulate, and standings write-back.
5. Finish SeasonHome/SeasonSchedule UX polish.
6. Implement SeasonTeamPage and roster/fatigue view.
7. Add roster-edit lock UI and storage verification.
8. Improve LeaguesHubPage canonical states.
9. Fix export/import feedback for teams and saves.
10. Repair or implement player reordering in Manage Teams.
11. Run accessibility/readability pass.
12. Add mobile/responsive tests and screenshots.
13. Only then start League Mode v2.

## Acceptance Criteria

League Mode v1 can be considered ready when:

- Mixed mode requires and correctly saves the user’s selected managed team.
- The managed-team selector is legible and works with mouse and keyboard.
- Watch mode cannot enable or access manager controls.
- Manager mode works only when the user chooses to play/manage the relevant team.
- The user can auto-simulate a managed-team game and advance the season without watching/playing.
- Auto-simulated games write final scores to the schedule and update standings.
- The season schedule shows completed scores and upcoming actions accurately.
- Season team pages exist and show roster/fatigue info.
- Active-season teams are protected from unsafe edits.
- Export/import flows provide clear feedback.
- Core flows have unit and E2E coverage.
- Mobile layouts are tested directly.
- Accessibility basics are satisfied: labels, keyboard navigation, focus states, and readable contrast.
