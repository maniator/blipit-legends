# 07 — League v1 QA done vs open summary

Date: 2026-05-11
Source of truth: `docs/league-v1-followup/04-validation-status.md`

## Summary

League v1 QA follow-up is **not closed**. P0 findings remain open or partially fixed, so v2 readiness is not met.

## Done vs open

### P0 findings

- Watch-mode permission enforcement: **Open**
- Managed-team headless auto-sim path: **Open**
- Mixed-mode selector readability/accessibility: **Partially fixed, still needs QA + regression hardening**
- Step-level wizard validation gating: **Partially fixed**

### P1 + non-league findings

- Several P1/non-league items are partially or largely resolved, but validation remains mixed and requires continued follow-up.

## Gate status for v2 readiness

Not ready. Required gates still pending:

1. All P0 findings closed with tests.
2. Screenshot-derived selector issue closed with regression coverage.
3. `04-validation-status.md` updated to closed P0 state.
4. `05-shift-left-regression-plan.md` first-wave checks implemented.
