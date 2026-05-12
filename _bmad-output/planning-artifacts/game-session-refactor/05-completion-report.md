# 05 — Completion Report: Game Session Context + Route Split

**Epic:** Game Session Refactor (Block A — Pre-v2)  
**PR:** [#264](https://github.com/maniator/blipit-legends/pull/264)  
**Date completed:** 2026-05-12  
**Lead:** Amelia 💻 (implementation), Winston 🏗️ (architecture CR), John 📋 (PM)

---

## Summary

All three stories (S1 Route Split, S2 GameSessionContext Extraction, S3 GameInner Cleanup) shipped
in a single PR. The epic goal is fully met: the simulation engine stays pure, game-type rules are
encoded in `GameSessionContext` at the route level, and `GameInner`/`GameControls` are clean.

---

## Acceptance Criteria Status

| Criterion                                                                     | Status  | Evidence                                                                          |
| ----------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------- |
| `/game/exhibition` route loads correctly                                      | ✅ pass | `e2e/tests/game-routes.spec.ts` exhibition smoke test                             |
| `/game/league/:seasonGameId` route loads correctly                            | ✅ pass | `e2e/tests/game-routes.spec.ts` league smoke test                                 |
| `/game` (legacy) save-resume unaffected                                       | ✅ pass | `e2e/tests/game-routes.spec.ts` save-resume smoke test                            |
| `useGameSessionContext()` throws outside provider                             | ✅ pass | `GameSessionContext.test.tsx` unit test                                           |
| `GameControls` renders without `managerModeAllowed` prop                      | ✅ pass | `GameControls.test.tsx` updated; prop removed                                     |
| `GameInner` zero direct reads of `setup.disableSave/seasonGameId/managedTeam` | ✅ pass | grep confirms 0 results; comment-only references updated                          |
| `ExhibitionGameSetup.disableSave` / `.seasonGameId` deprecated correctly      | ✅ pass | `@deprecated` JSDoc clarified — field ignored; context is authoritative           |
| `yarn check:circular-deps` passes                                             | ✅ pass | CI run on commit `8566577`                                                        |
| Full regression E2E passes on all 7 Playwright device projects                | ✅ pass | Docker validation 131/131; CI E2E passes (unit, lint, E2E all green on `8566577`) |
| Unit tests green                                                              | ✅ pass | 2648/2648                                                                         |
| Lint + format clean                                                           | ✅ pass | CI lint run on `8566577`                                                          |
| CodeQL: 0 alerts                                                              | ✅ pass | CodeQL scan on PR #264                                                            |

---

## Beyond-Scope Fixes (included in PR)

The following issues were discovered and fixed as part of this epic's implementation phase. They are
not part of the original S1–S3 scope but were necessary for CI to pass and product quality:

| Fix                                                          | Root Cause                                                                |
| ------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Season naming: all seasons named "New Season"                | `LeagueSetupWizard` hardcoded `name: "New Season"` — wizard now has input |
| Season rename: could not rename existing seasons             | `renameSeason` not wired to UI; not wrapped in try/catch — both fixed     |
| `editorReducer SET_FIELD name` left stale `nickname`         | Caused custom team display name to show city + generated nickname         |
| `managerModeAllowed: true` in `GameProviderWrapper`          | Shadowed route-level session context — removed                            |
| `AppSessionContext` unconditional RxDB probe                 | Deferred to `HomeRoute` mount to avoid DB init on deep-links              |
| `probeFiredRef` set before async probe succeeded             | Transient DB failures silently blocked retry — fixed                      |
| `SeasonHomePage.handlePlayNextGame` ignored `asManager` flag | Users couldn't actually spectate from SeasonHomePage — fixed              |
| `Step5.tsx` inline `fontSize: "11px"`                        | Bypassed design tokens — replaced with `HintText` styled component        |
| `LockedTeamDisplay` no accessibility signals                 | Added `aria-disabled="true"` and `aria-label`                             |
| Enter key not saving in rename input                         | Added `handleRenameKeyDown` handler                                       |
| `setupRef` dead code in `LeagueGamePage`                     | Removed                                                                   |
| E2E game-routes.spec.ts wrong selectors/URL                  | Updated to use `data-testid` and correct `/game` URL for save-resume      |
| `QuickStartInput.seasonName` JSDoc stale                     | Updated to reflect actual default `Season ${YYYY}`                        |
| `customTeamToDisplayName` double-city bug                    | Fixed + regression tests added                                            |

---

## Files Introduced

| File                                                                            | Purpose                                                     |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `src/features/gameplay/context/GameSessionContext.tsx`                          | New `GameSessionContext` + `GameSessionProvider` hook       |
| `src/features/gameplay/utils/gameSessionDerive.ts`                              | `deriveExhibitionSession` / `deriveLeagueSession` helpers   |
| `src/features/exhibition/pages/ExhibitionGamePage/index.tsx`                    | New `/game/exhibition` route page                           |
| `src/features/leagues/pages/LeagueGamePage/index.tsx`                           | New `/game/league/:seasonGameId` route page                 |
| `src/features/gameplay/components/GamePageWrapper/index.tsx`                    | Shared navigation-blocking wrapper (eliminates duplication) |
| `src/shared/context/AppSessionContext.tsx`                                      | App-level session context (hasActiveSession, Career Stats)  |
| `e2e/tests/game-routes.spec.ts`                                                 | Route smoke spec (exhibition, league, save-resume)          |
| `src/features/gameplay/components/GameControls/styles.ts` (`LockedTeamDisplay`) | Read-only locked team display styled component for league   |
| `src/features/leagues/pages/LeagueSetupWizard/steps/` (5 files)                 | Extracted wizard steps (770 → 362 lines in index.tsx)       |

---

## Metrics

| Metric                         | Value     |
| ------------------------------ | --------- |
| Lines added                    | +2 849    |
| Lines removed                  | −872      |
| Changed files                  | 62        |
| Unit tests at PR open          | 2 648     |
| E2E tests passing (Docker)     | 131 / 131 |
| CI fix cycles required         | 3         |
| Review threads opened/resolved | 10 / 10   |
| CodeQL alerts                  | 0         |

---

## Known Deferred Items

None introduced by this epic. Block B (D-01 autogen dedup, D-02 hub discoverability, D-03 roster
lock UI) remains open per `docs/pre-v2-backlog.md` and is independent of this work.

**Party-mode final review identified two P1 follow-up test cases (not blockers):**

1. **`GameInner` `managerModeAllowed` four-restore-path unit test** — Parametrized test covering
   `(seasonGameId=null, managedTeam=null) → true`, `(seasonGameId=set, managedTeam=null) → false`,
   `(seasonGameId=set, managedTeam=set) → true` across all four restore paths (fresh start,
   rxAutoSave, pendingLoadSave, modal-load). E2E exercises these but no unit test anchors the formula.
   File as P1 issue for next maintenance cycle.

2. **`customTeamAdapter` — both name and nickname empty/undefined** — Confirm fallback chain
   terminates gracefully when both `name` and `nickname` are absent. Small gap; file alongside (1).

**Block B sequencing note (John 📋):** Lead Block B with D-03 (roster lock UI) rather than D-01 or D-02.
D-03 is the only item where the current shipped state is visually misleading in an active league game.

---

## Retro

See `_bmad-output/implementation-artifacts/game-session-refactor-epic-retro-2026-05-12.md`.
