# 04 — Post-push validation status (current branch)

Validation run timestamp: 2026-05-11 (after commit `226d7ad` was pushed)

Method:

- Static code review of relevant routes/components/stores
- Existing unit + e2e test coverage review
- No claim of full live-production parity without a fresh interactive QA pass

Primary screenshot-derived finding source:

- `docs/league-v1-followup/screenshots/mixed-mode-review-dropdown-unreadable-user-screenshot.png`
- Referenced from `docs/league-v1-followup/01-qa-report.md` (Key Evidence Screenshot section)

---

## P0 findings from QA package

| Finding                                                  | Status                              | Evidence                                                                                                                                                                                                                     | Notes                                                                                                                                                                                                                                             |
| -------------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mixed-mode managed-team dropdown unreadable/inaccessible | **Partially fixed, still needs QA** | `LeagueSetupWizard` now uses native `<select>` with required validation (`src/features/leagues/pages/LeagueSetupWizard/index.tsx:351-377`, `src/features/leagues/wizard/validateWizardState.ts:45-49`)                       | Functional guard exists, but no dedicated visual/readability regression test for the control and no confirmed fix against screenshot evidence at `docs/league-v1-followup/screenshots/mixed-mode-review-dropdown-unreadable-user-screenshot.png`. |
| Watch mode still allows manager controls                 | **Confirmed open**                  | Watch launch passes `managedTeam: null` (`SeasonHomePage/index.tsx:326-337`), but Game controls still render Manager Mode toggle and allow enabling it (`GameControls/index.tsx:200-218`, `ManagerModeControls.tsx:107-116`) | This matches the QA report concern: spectator path can still turn on manager controls.                                                                                                                                                            |
| No headless auto-simulate option for managed-team games  | **Confirmed open**                  | When next managed game is ready, only "Play in Manager Mode" and "Watch" CTAs are rendered (`SeasonHomePage/index.tsx:309-339`)                                                                                              | No explicit "Auto-simulate" CTA for managed-team game branch.                                                                                                                                                                                     |
| Wizard validation allows invalid progression             | **Partially fixed**                 | Final-step validation blocks create for invalid states (`validateWizardState.ts`, `create-season-button` disabled in `LeagueSetupWizard/index.tsx:391-399`)                                                                  | Step-level UX gating/inline per-step enforcement remains weaker than requested in QA package.                                                                                                                                                     |

---

## P1 findings from QA package

| Finding                                                   | Status                                       | Evidence                                                                                                                                                                                        | Notes                                                                                                         |
| --------------------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| SeasonTeamPage missing/unused                             | **Implemented; discoverability still mixed** | Route exists in router (`src/router.tsx:257-261`), page implemented (`src/features/leagues/pages/SeasonTeamPage/index.tsx`), standings rows navigate to it (`SeasonHomePage/index.tsx:256-266`) | Core page exists; "View teams" from hub still routes to global `/teams` (`LeaguesHubPage/index.tsx:224-233`). |
| Roster-edit lock not visible in main team management path | **Partially fixed**                          | Storage-level lock guard exists (`customTeamStore.ts:85-97`, tests in `customTeamStore.test.ts`)                                                                                                | UI-level active-season lock messaging in Manage Teams list is still not explicit.                             |
| League hub canonical states incomplete                    | **Largely resolved**                         | Hub implements zero-season/no-team, zero-season/has-team, active season, and historical states (`LeaguesHubPage/index.tsx:75-261`)                                                              | Should be re-verified via live UX QA for copy/flow quality, but core state machine exists.                    |
| Season home next-game UX incomplete                       | **Partially open**                           | Advance flow + ready state exists (`SeasonHomePage/index.tsx:294-343`)                                                                                                                          | Missing managed-game auto-sim option keeps this from full closure.                                            |

---

## Non-league findings from QA package

| Finding                                         | Status                         | Evidence                                                                                                                           | Notes                                                                            |
| ----------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Team management drag-and-drop/reordering issues | **Likely resolved**            | DnD implementation + tests exist (`CustomTeamEditor/RosterSections.tsx`, `SortablePlayerRow.tsx`, `useEditorDragHandlers.test.ts`) | Re-verify with live QA persistence checks.                                       |
| Team export/import lacks feedback               | **Largely resolved**           | Success/error UI present in `ManageTeamsScreen` (`index.tsx:297-331`)                                                              | Validate end-to-end browser UX copy and file handling.                           |
| Saves export/import lacks feedback              | **Partially resolved**         | Import error/success states exist in Saves UI (`SavesPage/index.tsx`, `SavesModal/index.tsx`)                                      | Export success feedback still appears limited; verify UX expectations.           |
| Music/audio control unclear                     | **Resolved**                   | Accessible labels/tooltips + sliders present (`VolumeControls.tsx`)                                                                | Already includes mute/unmute semantics + persisted values via `useGameControls`. |
| PWA/offline expectations unclear                | **Not validated in this pass** | No new evidence gathered in this validation run                                                                                    | Needs dedicated offline/PWA flow QA.                                             |
| General readability/accessibility issues        | **Partially open**             | Improvements exist across controls, but QA screenshot concern for mixed-mode selector remains                                      | Requires targeted contrast/readability pass in league wizard + mobile.           |

---

## Priority-first execution order (validated)

1. **P0-1** Watch-mode permission enforcement (prevent manager controls in watch sessions)
2. **P0-2** Managed-team game auto-sim/headless advance option
3. **P0-3** Mixed-mode managed-team selector readability/accessibility hardening + regression tests
4. **P0-4** Step-level wizard validation UX hardening
5. P1 discoverability/lock UX items (SeasonTeamPage entry points + visible roster locks)
6. Remaining non-league polish items

This ordering intentionally matches the QA-first requirement before v2 expansion.
