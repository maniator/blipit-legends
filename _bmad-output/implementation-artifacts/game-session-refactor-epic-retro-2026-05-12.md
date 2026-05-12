# Game Session Refactor Epic — Retrospective

**Date:** 2026-05-12  
**Epic:** Block A — Game Session Context + Route Split (Pre-v2)  
**PR:** [#264](https://github.com/maniator/blipit-legends/pull/264)  
**Retro format:** Multi-agent party mode (Winston 🏗️, Amelia 💻, John 📋, Sally 🎨, Buck ⚾)  
**Status:** ✅ All 3 stories complete; CI green; epic closed.

---

## Team

| Role                        | Agent      |
| --------------------------- | ---------- |
| Developer (facilitator)     | Amelia 💻  |
| Product Manager             | John 📋    |
| Architect (CR gate)         | Winston 🏗️ |
| UX Designer / a11y sign-off | Sally 🎨   |
| Baseball realism (no scope) | Buck ⚾    |
| Project Lead                | Runner     |

---

## Epic Summary & Metrics

| Story                   | Scope                                                         | Status  |
| ----------------------- | ------------------------------------------------------------- | ------- |
| S1 — Route Split        | New routes `/game/exhibition` + `/game/league/:id`            | ✅ done |
| S2 — GameSessionContext | Context + provider + hook + GameControls refactor             | ✅ done |
| S3 — GameInner Cleanup  | Remove if-checks; deprecate setup fields; E2E regression gate | ✅ done |

**Beyond-scope fixes also shipped:** Season naming, season rename, managed-team lock, file split,
`AppSessionContext` architecture, display-name bug, custom-team editor regression, a11y improvements.

**Delivery:** 3/3 stories (100%)  
**Test suite:** 2 648 unit tests, all passing  
**E2E:** 131/131 across all 7 Playwright device projects (Docker-validated)  
**CI fix cycles:** 3 (pre-push `GameProviderWrapper` conflict, TS cast, E2E selector mismatch)  
**Review threads:** 10 opened → 10 resolved  
**Technical debt incurred:** None (no known shortcuts)  
**Production incidents:** 0

---

## What Went Well

### 1. Architecture decision record guided the implementation faithfully (Winston 🏗️)

Winston's ADR (`01-architecture-decision-record.md`) with its 5 explicit BLOCK constraints was the
single most valuable artifact of this epic. The implementing agent followed every constraint without
deviation:

- `GameSessionContext` lives outside `GameContext` ✅
- `GameSessionProvider` wraps `GameProviderWrapper`, not inside it ✅
- No imports from `GameSessionContext` inside the cycle-free sim chain ✅
- Routes and context introduced in the same PR but cleanly separated (S1+S2+S3 in sequence within
  the same PR) ✅
- `/game` legacy route preserved ✅

**Lesson:** ADRs with explicit BLOCK constraints are highly effective guardrails. The constrained
form is more actionable than open-ended design guidance.

---

### 2. `deriveExhibitionSession` / `deriveLeagueSession` are clean factories (Winston 🏗️)

Encoding session rules (managerModeAllowed, disableSave, seasonGameId, managedTeam) into pure
factory functions that are called once at the route level produced exactly the "same inner game
loop, different wrappers" goal. The result is testable, deterministic, and easy to extend for
future session types (e.g. tournament mode).

**Lesson:** Route-level context derivation is the correct boundary for session-type rules. Keep
factory functions pure and co-locate them in `gameSessionDerive.ts`.

---

### 3. `AppSessionContext` was an emergent architecture win (Amelia 💻)

The original epic scope had no `AppSessionContext`. It emerged from the need to move Career Stats
gating and active-game Resume state out of `AppShell` (which should be a pure layout component).
The resulting `AppSessionProvider` + `requestCareerStatsProbe()` deferred-init pattern correctly
avoids RxDB startup cost on deep-links, which was the pre-existing intent.

**Lesson:** Sometimes a higher-level context (session-level above game-level) is the clean place
for cross-route state. This is worth anticipating in future route-heavy epics.

---

### 4. Shift-left test strategy caught the display-name regression (Amelia 💻)

The `editorReducer SET_FIELD name → nickname not cleared` bug would have required another full E2E
cycle to discover. Instead, the shift-left tests (`editorState.test.ts` pipeline round-trip +
`customTeamAdapter.test.ts` edge cases) added during the retro planning phase would catch the same
class of bug in < 1 second at unit-test time.

**Lesson:** When a bug is discovered via E2E, always ask "what unit test would have caught this?"
and add it immediately. The cost is low; the benefit persists forever.

---

### 5. File split produced immediate readability gains (Amelia 💻)

`LeagueSetupWizard/index.tsx` went from 770 → 362 lines by extracting Steps 1–3, 5, 6 into
`steps/` files. No circular dependencies were introduced. Future work on any individual wizard step
is now isolated.

**Lesson:** Files over ~400 lines in a feature page context are usually ripe for step/section
extraction. Plan this in the sprint scope, not as an afterthought.

---

### 6. Season naming UX was caught early (John 📋 + Sally 🎨)

The "all seasons named New Season" issue was found and fixed as part of this sprint rather than
slipping to v2. The inline rename on `SeasonHomePage` (with `✏️`, keyboard enter-to-save, a11y
tokens) delivered a minimal but complete UX in a single commit.

**Lesson:** Quick UX wins in a feature area that is already open for editing should be taken — they
have near-zero opportunity cost and avoid backlog accumulation.

---

## Challenges & What We Learned

### C1 — `GameProviderWrapper` inner `GameSessionProvider` conflict (CI fix cycle 1)

**What happened:** `GameProviderWrapper` (the shared `<Game>` wrapper) had an inner
`GameSessionProvider` with `managerModeAllowed: true` that was added in an earlier sprint. When the
epic's route-level `GameSessionProvider` was added, the inner one shadowed it, causing
`E2E (league-shard-1)` to fail — `GameControls` was always reading `managerModeAllowed: true` from
the inner provider instead of the route-configured session value.

**Root cause:** Legacy provider that predated the route-level session architecture was not removed
when the new architecture landed.

**Lesson:** When introducing a new context provider at a higher level, grep for all existing
providers of the same context in the subtree and remove them. Stale providers are silent bugs.

**Action item:** Add "grep for stale inner providers when adding a new context provider" to the
pre-PR mental checklist.

---

### C2 — `editorReducer SET_FIELD name` left stale `nickname` (CI fix cycle 2)

**What happened:** After a user clicked Generate Random (which set both `name` and `nickname`) and
then manually typed a new team name, `customTeamToDisplayName` returned `city + nickname` (the
generated one) instead of `city + name` (the user's typed name). This broke 6 E2E tests across
manage-teams, custom-team-editor, and import-export suites.

**Root cause:** `SET_FIELD` for `name` did not clear `nickname`. The generate-random path sets
`nickname` to enable a short name display; the clear path on manual edit was missing.

**Lesson:** Any reducer that sets multiple related fields in one action must also define the
clearing contract for those fields when a subset is manually overridden.

**Action item:** When `APPLY_DRAFT` (or similar "hydrate from external") sets fields that are
normally managed independently, document which fields are primary (user-editable) and which are
derived (auto-cleared on primary edit) in an inline comment.

---

### C3 — TypeScript cast in partial test fixture required `as unknown as T` (minor)

**What happened:** The `editorState.test.ts` shift-left tests needed to construct partial
`TeamWithRoster` fixture objects. TypeScript rejected `partialObject as TeamWithRoster` because
neither type sufficiently overlapped.

**Resolution:** Used the standard `as unknown as T` two-step cast.

**Lesson:** Test fixtures casting to complex DB record types always require `as unknown as T`. This
is the documented pattern (stored in memory). Not a surprise when you know it.

---

### C4 — E2E game-routes.spec.ts selector/URL issues (minor)

**What happened:** The initial `game-routes.spec.ts` used button text regexes `"Watch Game"` /
`"Play Game"` (not matching actual UI labels `"👁 Watch"` / `"▶ Play"`) and expected save-resume
to navigate to `/game/exhibition` (actual: `/game`).

**Root cause:** E2E test authored against design intent rather than the actual rendered UI.

**Lesson:** E2E tests for navigation flows must be verified against the actual DOM before pushing.
The `data-testid` selectors are always more reliable than text-based selectors that depend on
copy/emoji.

---

### C5 — `probeFiredRef` set-before-await was a subtle bug (caught in review)

**What happened:** `requestCareerStatsProbe()` set `probeFiredRef.current = true` before the async
`getDb()` call, so a transient DB failure would permanently prevent retry in the session.

**Root cause:** Setting the guard before the async operation instead of inside the `.then()`.

**Lesson:** For "fire-once" async gates, set the guard only after the operation succeeds (or at
least starts a chain that will set it on failure too). This is the standard pattern for retry-able
operations.

---

## Decisions Made During Epic Execution

| Decision                                    | Owner         | Rationale                                                                               |
| ------------------------------------------- | ------------- | --------------------------------------------------------------------------------------- |
| Bundle S1+S2+S3 in single PR                | John + Amelia | Stories are tightly sequenced; separate PRs would block for ~3 review cycles. Accepted. |
| `AppSessionContext` as new higher-level ctx | Winston       | `AppShell` must be a pure layout component; session state needs a real provider home.   |
| Season naming in Wizard Step 1              | John + Sally  | Natural home — user is deciding on configuration at that point.                         |
| `LockedTeamDisplay` (not disabled select)   | Sally         | Disabled `<select>` is not consistently accessible; custom display is more reliable.    |
| `requestCareerStatsProbe()` deferred init   | Winston       | Avoids RxDB startup cost on deep-links (pre-existing AppShell intent preserved).        |
| Keep `/game` legacy route                   | Winston       | ADR BLOCK constraint — not deprecated in this epic.                                     |

---

## Action Items

| #   | Action                                                                                                                                                                   | Owner  | When                | Success Criteria                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | ------------------- | ---------------------------------------------------------------------------------------- |
| A1  | Add "grep for stale inner providers when adding new context provider" to pre-PR checklist                                                                                | Amelia | Next epic kickoff   | Rule is visible in contributing docs or `CLAUDE.md`                                      |
| A2  | Add shift-left test rule: "when bug found via E2E, always add unit test for the same root cause"                                                                         | Amelia | Next epic kickoff   | Rule referenced in `CLAUDE.md` or in `docs/e2e-testing.md`                               |
| A3  | Update `docs/pre-v2-backlog.md` Block A checkboxes to ✅                                                                                                                 | John   | ✅ done in PR #264  | All Block A items checked                                                                |
| A4  | Lead Block B with D-03 (roster lock UI) — only item where shipped state is visually misleading to active league game users                                               | John   | Block B kickoff     | D-03 scheduled as first Block B story                                                    |
| A5  | Begin Block B (D-01, D-02, D-03) planning after PR #264 merges                                                                                                           | John   | After PR #264 merge | D-01 prompt at `_bmad-output/planning-artifacts/league-v2-prep/01-d01-...` is ready      |
| A6  | Add `GameInner` `managerModeAllowed` 4-restore-path parametrized unit test (identified in party-mode retro by Amelia)                                                    | Amelia | Next sprint cycle   | Covers `(seasonGameId=null,managedTeam=null)→true`, `(set,null)→false`, `(set,set)→true` |
| A7  | Add `customTeamAdapter` both-fields-empty fallback test — confirm graceful termination when name and nickname are both absent (identified in party-mode retro by Amelia) | Amelia | Next sprint cycle   | Test added; no throw/`undefined` display                                                 |
| A8  | Track removal of deprecated `ExhibitionGameSetup.disableSave` + `.seasonGameId` fields before next schema bump (identified in party-mode retro by Winston)               | Amelia | Pre-next-schema     | Fields removed; callers confirmed 0                                                      |
| A9  | Consider "bundle S1+S2+S3 if tightly coupled" guidance in `01-pm-execution-board.md`                                                                                     | John   | Backlog             | Future epic boards document bundling policy                                              |

---

## Readiness Assessment

| Area                   | Status                                                                                  |
| ---------------------- | --------------------------------------------------------------------------------------- |
| Testing & Quality      | ✅ 2648/2648 unit tests pass; 131/131 E2E across 7 device projects                      |
| CI                     | ✅ All checks passing (lint, typecheck, tests, E2E) on commit `8566577`                 |
| Stakeholder Acceptance | ✅ All 10 PR review threads resolved; no blocking issues on final architect review pass |
| Technical Health       | ✅ No new debt; no circular deps; no type errors; CodeQL 0 alerts                       |
| Unresolved Blockers    | None                                                                                    |

---

## Key Takeaways

1. **ADRs with explicit BLOCK constraints are the most actionable form of architecture guidance.**
   They eliminate ambiguity and give the implementing agent clear accept/reject criteria.

2. **Route-level session context derivation is the correct boundary for game-type rules.**
   `GameSessionContext` at the route level keeps `GameInner` pure. This pattern should be used
   for any future session type (tournament, replay, broadcast).

3. **Shift-left tests (unit → integration → E2E) pay dividends immediately.**
   The `editorReducer + customTeamAdapter` regression tests added during this sprint would catch
   any future `SET_FIELD`/display-name regression at unit-test speed.

4. **Stale context providers are silent, hard-to-debug bugs.**
   The `GameProviderWrapper` inner provider bug required a CI failure to surface. Proactive
   grepping for stale providers when adding new ones would catch this pre-push.

5. **Season UX items with near-zero opportunity cost should ship in the same sprint.**
   Deferring "all seasons named New Season" to a later sprint would have created backlog noise and
   a worse user experience. Taking it while the files were open was the right call.

6. **`as unknown as T` is the standard TypeScript pattern for partial test fixtures.**
   Attempting `as T` directly on a partial fixture always fails when the types don't overlap
   sufficiently. Store this as muscle memory and don't spend time on workarounds.

---

## Next Steps

1. ✅ Game Session Refactor epic complete — retro done (party-mode validated: Winston APPROVE ✅, John GO ✅, Amelia SHIP ✅)
2. 📋 Block B kickoff: **lead with D-03** (roster lock UI) → D-01 autogen dedup → D-02 hub discoverability (John's sequencing recommendation from party-mode retro)
3. 🏗️ Winston CR required for D-01 (RxDB schema change with fingerprint index)
4. 📝 Address Action Items A1–A2 at next epic kickoff (shift-left rule + stale-provider checklist)
5. 🧪 File P1 issues for A6 (`GameInner` restore-path unit test) and A7 (`customTeamAdapter` empty-fields fallback) — Amelia's recommendations from party-mode retro
6. 🗑️ Track A8: `ExhibitionGameSetup.disableSave`/`.seasonGameId` removal before next schema bump — Winston's forward note
