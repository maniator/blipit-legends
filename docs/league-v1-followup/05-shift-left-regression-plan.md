# 05 — Shift-left regression plan for all QA findings

Goal: convert each QA finding into fast, repeatable automated checks (unit/component first, E2E second) so regressions are caught before release.

---

## Testing principles

1. **Unit/component first** for business rules and UI state branching.
2. **E2E second** for route wiring and real user flows.
3. Use stable `data-testid` selectors when available.
4. Keep deterministic logic (season advancement/write-back) covered with isolated unit/integration tests.
5. Add mobile viewport checks for league wizard and season pages where readability issues were reported.
6. Treat screenshot-derived evidence as a regression source, not just a one-time bug report.

---

## Regression matrix (all findings)

| Finding                                                         | Shift-left regression coverage to add/keep                                                                                                                                                                                           | Primary test layer      |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| P0-1 Mixed-mode managed-team dropdown readability/accessibility | Component test for managed-team selector visibility/enabled state in mixed mode; validation test that Create is blocked until explicit selection; E2E tab/keyboard interaction + visual assertion for readable control size/contrast | Unit + E2E              |
| P0-2 Watch mode allows manager controls                         | Unit test: launching with watch setup (`managedTeam: null`) keeps manager toggle hidden/disabled; E2E: Watch flow must not expose substitution/decision controls                                                                     | Unit + E2E              |
| P0-3 Missing headless auto-sim for managed-team games           | Unit/integration test for season advance branch to permit managed-team auto-sim path; E2E: when next managed game is ready, auto-sim CTA exists and updates standings/schedule                                                       | Integration + E2E       |
| P0-4 Wizard validation invalid progression                      | Unit tests for per-step gating rules; component tests for inline errors per field; E2E attempts to proceed with invalid state must fail at step boundary                                                                             | Unit + Component + E2E  |
| P1-5 SeasonTeamPage missing/unused                              | Route test for `/leagues/:seasonId/teams/:seasonTeamId`; component tests for roster/fatigue sections; E2E navigation from season standings to season-team page                                                                       | Unit + E2E              |
| P1-6 Roster-edit lock visibility in Manage Teams                | Storage tests (already present) remain required; add UI tests for active-season lock banner/disabled destructive actions                                                                                                             | Unit + Component        |
| P1-7 League hub canonical states incomplete                     | Component tests for each hub state branch (empty, active, historical, combined); E2E route assertions for key CTAs in each state                                                                                                     | Component + E2E         |
| P1-8 Season home next-game/schedule preview incomplete          | Component tests for next-game branch rendering; integration test for standings/day updates after each action path                                                                                                                    | Component + Integration |
| NL-1 Team management DnD/reordering issues                      | Keep DnD unit tests for reorder/transfer; add persistence assertion after save/reload                                                                                                                                                | Unit + Integration      |
| NL-2 Team export/import lacks feedback                          | Component tests for success/error banners; integration test for round-trip import/export visibility                                                                                                                                  | Component + Integration |
| NL-3 Saves modal export/import feedback                         | Component tests for import/export feedback states and errors; E2E round-trip save export/import/load                                                                                                                                 | Component + E2E         |
| NL-4 Music/audio control unclear                                | Keep VolumeControls tests (labels + sliders + mute/unmute); add E2E keyboard accessibility smoke check                                                                                                                               | Unit + E2E              |
| NL-5 PWA/offline expectations unclear                           | Add service-worker/offline E2E checks for app shell behavior and user messaging                                                                                                                                                      | E2E                     |
| NL-6 General readability/accessibility                          | Add axe/Lighthouse checks on wizard, season home, saves, team management; add targeted contrast assertions for known problem controls                                                                                                | E2E + a11y audits       |

---

## Screenshot-derived regression target

Source screenshot:

- `docs/league-v1-followup/screenshots/mixed-mode-review-dropdown-unreadable-user-screenshot.png`

Required regression checks tied to that screenshot:

1. Mixed-mode managed-team selector is visually legible at mobile and desktop breakpoints.
2. Selector supports mouse + keyboard selection reliably.
3. Selected value remains readable after selection (not only when dropdown is open).
4. A failing visual/a11y test blocks merge if selector contrast/size regresses.

---

## Minimal first wave (QA-priority)

Implement these regression checks first, in this order:

1. Watch-mode permission enforcement
2. Managed-team auto-sim branch
3. Mixed-mode managed-team selector + validation
4. Season write-back and schedule/standings consistency

These four capture the highest-risk correctness regressions before v2 expansion.
