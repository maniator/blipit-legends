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
