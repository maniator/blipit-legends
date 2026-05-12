# Copilot BMAD Review — Verification Guide

This document explains the difference between native GitHub Copilot PR review
(instruction emulation) and real BMAD skill execution, and describes how to
verify which mode is active.

---

## Review surface comparison

| Surface                                | BMAD skill execution             | Instruction source                                                                    |
| -------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------- |
| **Copilot cloud agent** (coding agent) | ✅ Real skills via `skill` tool  | `.agents/skills/`                                                                     |
| **Copilot CLI**                        | ✅ Real skills (when configured) | `.agents/skills/`                                                                     |
| **Native GitHub PR review**            | ❌ Instruction emulation only    | `.github/copilot-instructions.md`, `.github/instructions/bmad-review.instructions.md` |

---

## Real BMAD skill directories

Both review skills exist with `SKILL.md` files in `.agents/skills/`:

- `.agents/skills/bmad-code-review/SKILL.md`
- `.agents/skills/bmad-party-mode/SKILL.md`

These directories are consumed by Copilot cloud agent and Copilot CLI. Native
GitHub PR review does not load them.

---

## Log evidence: real execution vs. emulation

### Evidence that proves real BMAD execution

- Runtime log shows a skill being **selected**, **loaded**, or **injected**:
  - `bmad-code-review` selected
  - `bmad-party-mode` selected
  - `SKILL.md` injected into context
  - Skill execution event recorded
- `EnableSkills=true` in the review session log

### Evidence that is **not enough** to confirm real BMAD execution

- Only `custom-instructions.json` appears in the log
- `EnableSkills=false`
- Review output _sounds_ like BMAD language but no skill loading is logged

If you see only `custom-instructions.json` and `EnableSkills=false`, the review
used **instruction emulation** — the BMAD-style instructions in
`.github/copilot-instructions.md` and `.github/instructions/bmad-review.instructions.md`
guided the response, but no actual skill was invoked.

---

## Smoke-test PRs

Use these PR types to verify that the instruction emulation is producing
appropriate BMAD-flavored review comments:

| PR type                              | Expected review lane | Expected comments                                                                  |
| ------------------------------------ | -------------------- | ---------------------------------------------------------------------------------- |
| RxDB / schema / save / export change | Persistence / Data   | Migration strategy checked; backward compatibility assessed; test coverage flagged |
| UI / responsive / layout change      | Frontend / UX        | Accessibility (WCAG AA) checked; mobile behavior assessed; `dvh` vs `vh` checked   |
| Behavior change without tests        | QA / Test Architect  | Missing test coverage flagged; regression risk called out                          |

If a PR of each type does not produce the corresponding lane comments, the
instruction file needs further adjustment.

---

## Copilot CLI workflow (recommended shape)

A Copilot CLI–based review workflow is not added to this repo because Copilot
CLI availability and authentication setup vary by environment. If you want to
add one, the recommended shape is:

```yaml
# .github/workflows/copilot-bmad-review.yml
# Manual-only workflow — does NOT run automatically on PRs.
# Requires a repo secret named COPILOT_CLI_PAT with Copilot access.
# Configure the secret in Settings → Secrets and variables → Actions.
name: Copilot BMAD Review (manual)

on:
  workflow_dispatch:
    inputs:
      pr_number:
        description: "PR number to review"
        required: true
        type: string

jobs:
  bmad-review:
    runs-on: ubuntu-latest
    # This job requires COPILOT_CLI_PAT to be configured in repo secrets.
    # The secret must belong to a GitHub account with an active Copilot subscription.
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Fetch PR diff
        env:
          GH_TOKEN: ${{ secrets.COPILOT_CLI_PAT }}
        run: |
          gh pr diff ${{ inputs.pr_number }} > /tmp/pr.diff

      - name: Run Copilot CLI BMAD review
        env:
          GH_TOKEN: ${{ secrets.COPILOT_CLI_PAT }}
        run: |
          # Requires GitHub CLI Copilot extension:
          #   gh extension install github/gh-copilot
          gh copilot suggest \
            --target shell \
            "Review this diff using bmad-code-review then bmad-party-mode synthesis. $(cat /tmp/pr.diff)" \
            | tee /tmp/bmad-review.md "$GITHUB_STEP_SUMMARY"

      - name: Upload review artifact
        uses: actions/upload-artifact@v4
        with:
          name: copilot-bmad-review
          path: /tmp/bmad-review.md
```

**Required manual steps before using this workflow:**

1. Create a repo secret named `COPILOT_CLI_PAT` with a GitHub PAT that has
   `copilot` scope and an active Copilot for Business or Individual subscription.
2. Install the GitHub CLI Copilot extension on the runner (add a setup step or
   use a self-hosted runner that already has it).
3. Validate that `gh copilot suggest` can accept a diff as input in your Copilot
   CLI version.

Do not merge this workflow until those prerequisites are verified.
