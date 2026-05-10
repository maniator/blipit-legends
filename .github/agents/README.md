# Custom Copilot Agents — BlipIt Legends

This directory contains the **3 remaining operational specialist agents** for `maniator/blipit-legends`. All planning, design, engineering, and review roles have been consolidated into **bmad agents** (see `.agents/skills/`).

---

## Agent Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  BMAD AGENTS  (.agents/skills/)                                 │
│  All load docs/project-context.md as persistent facts           │
│                                                                 │
│  John 📋  bmad-agent-pm        Planning, PRD, baseball rules,  │
│                                 risk review (Mode 1 / Mode 2)   │
│  Buck ⚾   bmad-agent-baseball  Gameplay realism review,        │
│            -manager             log analysis, MLB delta          │
│  Winston 🏗️ bmad-agent-         Architecture, engineering       │
│             architect           sign-off (APPROVE/BLOCK/        │
│                                 REQUEST_CHANGES verdicts)       │
│  Amelia 💻  bmad-agent-dev     Story impl, code review,        │
│                                 SC/RX/SR/UI/E2E menus           │
│  Sally 🎨   bmad-agent-         UX design, wireframes,          │
│             ux-designer         personas P1–P6, a11y            │
│  Mary 📊    bmad-agent-analyst  Research, requirement elicit.   │
│  Paige 📚   bmad-agent-         Docs, API docs, changelogs      │
│             tech-writer                                         │
└─────────────────────────────────────────────────────────────────┘
                          │ hands off to
┌─────────────────────────────────────────────────────────────────┐
│  OPERATIONAL SPECIALISTS  (.github/agents/)                     │
│  Kept because they carry non-obvious operational setup steps   │
│  whose failure is silent or catastrophic if missed             │
│                                                                 │
│  e2e-test-runner   Docker container baseline regen             │
│  ci-workflow       copilot-setup-steps.yml container caveat    │
│  playwright-prod   localhost reverse proxy for blipit.net QA   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Global sub-agent push rule

Sub-agents **must never** run `git push`, `gh`, or `report_progress`. Sub-agents may create local commits, then must report the commit SHA back to the root Copilot agent to push via `report_progress`.

---

## Routing Table

| Task                                                 | Agent                                              |
| ---------------------------------------------------- | -------------------------------------------------- |
| Feature planning, PRD creation, sprint planning      | `bmad-agent-pm` (John) → M1 menu                   |
| Baseball rules question (MLB vs simulator)           | `bmad-agent-pm` (John) → M2 menu                   |
| Risk review / "what could break?"                    | `bmad-agent-pm` (John) → M1 or RF menu             |
| PR description review                                | `bmad-agent-pm` (John) → PR menu                   |
| Gameplay realism review (logs look unrealistic)      | `bmad-agent-baseball-manager` (Buck) → RL menu     |
| Post-change realism validation                       | `bmad-agent-baseball-manager` (Buck) → VR menu     |
| Architecture decision, module boundary               | `bmad-agent-architect` (Winston) → AD menu         |
| Engineering sign-off on high-value change            | `bmad-agent-architect` (Winston) → CR menu         |
| Story implementation, feature coding                 | `bmad-agent-dev` (Amelia) → story impl             |
| Code review                                          | `bmad-agent-dev` (Amelia) → bmad-code-review skill |
| Simulation correctness bug (broken/impossible state) | `bmad-agent-dev` (Amelia) → SC menu                |
| RxDB schema change, migration, SaveStore             | `bmad-agent-dev` (Amelia) → RX menu                |
| Safe refactor (behavior-preserving)                  | `bmad-agent-dev` (Amelia) → SR menu                |
| UI/styled-components implementation                  | `bmad-agent-dev` (Amelia) → UI menu                |
| E2E test authoring, fixture creation                 | `bmad-agent-dev` (Amelia) → E2E menu               |
| UX design, wireframes, accessibility                 | `bmad-agent-ux-designer` (Sally) → HR/SD menu      |
| User persona interview (any of 6 personas)           | `bmad-agent-ux-designer` (Sally) → P1–P6 menu      |
| Multi-agent deliberation on a cross-cutting question | `bmad-party-mode` skill                            |
| **Visual snapshot baseline regen**                   | **`e2e-test-runner`** ← operational specialist     |
| **GitHub Actions / CI workflow YAML**                | **`ci-workflow`** ← operational specialist         |
| **Live QA against blipit.net**                       | **`playwright-prod`** ← operational specialist     |

---

## Operational Specialist Agents

### `e2e-test-runner`

**When to use:** Running, debugging, authoring, or updating Playwright E2E tests — **especially visual snapshot baseline regeneration**. This agent is kept because baselines generated outside the Docker container are subtly wrong due to font/rendering differences, and the failure mode is silent (tests pass locally, fail on CI intermittently).

**Critical operational requirement:**

- Always runs tests inside `mcr.microsoft.com/playwright:v1.58.2-noble` via `docker run` — **never on the host machine**
- Every `docker run` must install Node 24 first: `npm install -g n && n 24 && hash -r` before `corepack enable && yarn install`
- Can regenerate and **commit visual snapshot baselines directly** (no workflow wait)
- Uses `loadFixture` for instant game-state setup; never adds `test.setTimeout()`

---

### `ci-workflow`

**When to use:** GitHub Actions workflow changes — Playwright CI, lint/test CI, sharding, artifact uploads, or Copilot setup steps. This agent is kept because the `copilot-setup-steps.yml` / `container:` incompatibility is catastrophic and non-obvious to diagnose.

**Critical operational requirement:**

> `.github/workflows/copilot-setup-steps.yml` must **NOT** use `container:`. Copilot's internal bootstrap steps fail inside containers due to `/bin/sh` vs bash shell compatibility issues (e.g., `pipefail`). This is a known, intentional constraint. Do not add `container:` thinking it will improve isolation.

Other guardrails:

- Minimal, safe workflow diffs; artifact uploads preserved
- Playwright container jobs: browser binaries are pre-installed — no extra `playwright install` step needed
- Does not assume system `apt` packages are cacheable

---

### `playwright-prod`

**When to use:** Live-browser QA sessions against the production site at blipit.net using the Playwright MCP. This agent is kept because the localhost reverse proxy **must be started before any Playwright MCP call**, and there is no other documented path to live production QA.

**Critical operational requirement:**

- **Always start the proxy first** — run the bash snippet at the top of the agent file before any Playwright MCP tool call
- **Navigate to `http://localhost:3456`** — never `https://blipit.net` (the browser sandbox strips non-localhost entries)
- The proxy starts on demand, not always-on

---

## Common Gotchas

| Gotcha                     | Detail                                                                                                                                                                                                               |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Snapshot environment       | Baselines MUST be in `mcr.microsoft.com/playwright:v1.58.2-noble`. Never commit host-generated PNGs. Route all regen to `e2e-test-runner`.                                                                           |
| Copilot setup workflow     | `copilot-setup-steps.yml` must not use `container:` — known bootstrap shell compatibility issue.                                                                                                                     |
| Reducer cycle order        | `strategy → advanceRunners → gameOver → playerOut → hitBall → buntAttempt → playerActions → reducer`. No circular imports.                                                                                           |
| RxDB schema versioning     | Any change to `properties`, `required`, or `indexes` at the same `version` causes DB6 for all existing users. Always bump `version`, add migration strategy, add upgrade-path test. Route to Amelia RX → Winston CR. |
| PRNG call order            | Any new `rng()` call added, removed, or reordered breaks seed replay for all existing seeds. Requires Winston CR sign-off.                                                                                           |
| `dvh` vs `vh`              | Always use `dvh` for modal `max-height` — `100vh` on mobile can exceed visible viewport.                                                                                                                             |
| PR title/description scope | Always `git log --oneline` first to understand the full branch scope before writing the PR description. Must follow `.github/pull_request_template.md`.                                                              |
| Sub-agent push permissions | Sub-agents cannot push. If they create commits, they must return commit SHAs to the root Copilot agent to push via `report_progress`.                                                                                |
