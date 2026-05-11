# BlipIt Legends QA Follow-up Package

This package contains portable files for creating a GitHub issue or feeding BMAD/Copilot before starting League Mode v2.

## Priority Rule

QA follow-up fixes in this folder are **priority-first work** and should be planned/executed before new feature expansion. In particular, resolve P0/P1 League Mode v1 correctness and accessibility gaps before starting League Mode v2 scope.

Files:

- `01-qa-report.md` — QA report and next-step recommendations.
- `02-github-issue-body.md` — GitHub issue body ready to paste into `maniator/blipit-legends`.
- `03-bmad-implementation-plan-prompt.md` — prompt for BMAD to create the implementation plan.
- `04-validation-status.md` — post-push validation status of each QA finding against current branch code.
- `05-shift-left-regression-plan.md` — regression-testing strategy matrix (unit/component/integration/E2E) for every finding.
- `06-pr-comment-prompts-and-execution-plan.md` — ready-to-paste PR comment payload with prompts and parallel-vs-sequence execution guidance.
- `screenshots/mixed-mode-review-dropdown-unreadable-user-screenshot.png` — user-provided screenshot showing the unreadable/inaccessible mixed-mode “Which team will you manage?” field.

Note: Earlier QA screenshots from the live desktop run were not available as standalone files in this environment, so the textual findings are documented in `01-qa-report.md` and include the available user-provided screenshot.

Retention/update policy: treat `06-pr-comment-prompts-and-execution-plan.md` as a long-lived artifact. It should remain in this folder and only be updated when prompt content, agent ownership, sequencing rules, or QA gates materially change.
