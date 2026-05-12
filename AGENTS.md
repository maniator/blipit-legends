# AGENTS.md — Copilot Coding Agent Instructions

This repository is `maniator/blipit-legends`. All agent-routing guidance, custom agent descriptions, gotchas, and key file references live in the canonical sources below — this file is intentionally a thin pointer to avoid duplication.

| What you need                                    | Where to look                                                                         |
| ------------------------------------------------ | ------------------------------------------------------------------------------------- |
| **Agent routing (start here)**                   | [`.github/agents/README.md`](.github/agents/README.md)                                |
| bmad persistent facts for all agents             | [`docs/project-context.md`](docs/project-context.md)                                  |
| Code conventions, global rules & critical notes  | [`.github/copilot-instructions.md`](.github/copilot-instructions.md)                  |
| Gameplay realism (Buck ⚾)                       | `.agents/skills/bmad-agent-baseball-manager/`                                         |
| Planning / baseball rules (John 📋)              | `.agents/skills/bmad-agent-pm/` + `_bmad/custom/bmad-agent-pm.toml`                   |
| Engineering sign-off / architecture (Winston 🏗️) | `.agents/skills/bmad-agent-architect/` + `_bmad/custom/bmad-agent-architect.toml`     |
| Story implementation / code review (Amelia 💻)   | `.agents/skills/bmad-agent-dev/` + `_bmad/custom/bmad-agent-dev.toml`                 |
| UX design / personas (Sally 🎨)                  | `.agents/skills/bmad-agent-ux-designer/` + `_bmad/custom/bmad-agent-ux-designer.toml` |
| E2E test execution (operational specialist)      | [`.github/agents/e2e-test-runner.md`](.github/agents/e2e-test-runner.md)              |
| CI workflow (operational specialist)             | [`.github/agents/ci-workflow.md`](.github/agents/ci-workflow.md)                      |
| Live production QA (operational specialist)      | [`.github/agents/playwright-prod.md`](.github/agents/playwright-prod.md)              |
| PRD                                              | [`_bmad-output/planning-artifacts/prd.md`](_bmad-output/planning-artifacts/prd.md)    |
| Baseball rules delta                             | [`docs/agent/baseball-rules-delta.md`](docs/agent/baseball-rules-delta.md)            |
| PM knowledge map                                 | [`docs/agent/pm-agent-knowledge-map.md`](docs/agent/pm-agent-knowledge-map.md)        |
| Copilot surface notes (PR vs CLI vs cloud-agent) | [`docs/copilot-bmad-review.md`](docs/copilot-bmad-review.md)                          |

---

## Copilot Surface Notes

### Where real BMAD skills can execute

| Surface                                | Real BMAD skill execution?         | Notes                                                                                                                |
| -------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Copilot cloud agent** (coding agent) | ✅ Yes                             | Skills in `.agents/skills/` are available via the `skill` tool                                                       |
| **Copilot CLI**                        | ✅ Yes (when configured)           | Requires `COPILOT_CLI_PAT` secret with Copilot access                                                                |
| **Native GitHub PR review**            | ❌ No — instruction emulation only | Reads `.github/copilot-instructions.md` and `.github/instructions/bmad-review.instructions.md`; `EnableSkills=false` |

### Native GitHub PR review

Native GitHub pull-request code review does **not** reliably execute BMAD skills. It relies on:

- `.github/copilot-instructions.md` (BMAD emulation section at the top)
- `.github/instructions/bmad-review.instructions.md`

If reviewer logs show only `custom-instructions.json` and `EnableSkills=false`, that is **instruction emulation** — not real BMAD skill execution. Do not claim `bmad-code-review` or `bmad-party-mode` were invoked.

### Real BMAD skill directories

Both `bmad-code-review` and `bmad-party-mode` exist as real skill directories with `SKILL.md` files under `.agents/skills/`. These are consumed by Copilot cloud agent and Copilot CLI — not by native GitHub PR review.

See [`docs/copilot-bmad-review.md`](docs/copilot-bmad-review.md) for log evidence that distinguishes real skill execution from instruction emulation.
