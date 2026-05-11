# 07 — League v1 QA done vs open summary

Date: 2026-05-11 (updated after QA follow-up implementation)
Source of truth: `docs/league-v1-followup/04-validation-status.md`

## Summary

League v1 QA follow-up P0 findings are **closed**. All four P0 items have been implemented
with tests committed on this branch. v2 readiness gates are met for code quality; a
live interactive QA pass is recommended before merging to confirm visual/UX fidelity.

## Done vs open

### P0 findings

| Finding                                        | Status      | Commit / evidence                                                                                        |
| ---------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------- |
| Watch-mode permission enforcement              | ✅ **Done** | `managerModeAllowed` prop gates manager controls; E2E test in `league-qa-followup.spec.ts`               |
| Managed-team headless auto-sim path            | ✅ **Done** | "Auto-Simulate" CTA added to `SeasonHomePage`; `runHeadlessGame` return value now checked before advance |
| Mixed-mode managed-team selector accessibility | ✅ **Done** | Native `<select>` with required validation; `validateWizardStep` gates Next button per step              |
| Step-level wizard validation gating            | ✅ **Done** | `validateWizardStep` (structured error constants) + inline error rendering + Next-button disabled guard  |

### P1 + non-league findings

- `SeasonTeamPage` discoverability: implemented (route + standings link); "View teams" from hub
  still goes to `/teams` — tracked as v2 polish item.
- Roster-edit lock UI: storage-level guard present; explicit UI message deferred to v2.
- Team/saves export feedback: largely resolved; offline/PWA validation deferred to v2.

## Gate status for v2 readiness

**Ready for merge.** All P0 gates are closed:

1. ✅ All P0 findings closed with tests.
2. ✅ `validateWizardStep` uses structured error constants (no fragile string matching).
3. ✅ `handleAutoSimNextGame` guards on `runHeadlessGame` return status.
4. ✅ E2E helpers exported from barrel (`e2e/utils/helpers.ts`).

Open items deferred to v2 epic (see `docs/game-session-refactor/` planning artifacts).
