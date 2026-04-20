# Custom Copilot Agents — Overview

This directory contains **GitHub Copilot custom agents** tailored for `maniator/blipit-legends`. Each agent is a `.md` file with YAML front-matter and domain-specific instructions that guide Copilot when working on specific task types.

---

## Agents

### `pm-agent`

**When to use:** Any time a task starts with planning, scoping, risk review, baseball-rule questions, or PR readiness — especially for gameplay engine, RxDB/saves, or rules-heavy work. This agent should be your **first stop** before invoking a specialist execution agent.

**Auto-routing triggers (no explicit `@pm-agent` needed):**

- Planning or scoping a feature that touches gameplay, saves, or routes.
- Questions about how a baseball rule works or how the simulator implements it.
- "What files change for X?", "What are the risks of Y?", "Is Z safe to do?"
- PR description drafts for gameplay engine, rules, or persistence changes.
- Any request mentioning: inning, pitch, batter, runner, steal, bunt, walk, strikeout, home run, extra innings, tiebreak runner, IBB, manager mode, defensive shift, pinch hitter, RxDB schema migration, save compatibility, PRNG replay, or visual snapshot impact.

**Key guardrails:**

- Always cites file + line range for simulator claims; always cites MLB rulebook section for official rules.
- Explicitly labels every baseball answer as `[Official MLB]` vs `[Ballgame]`.
- Never suggests code edits unless explicitly requested.
- Flags module cycle order, PRNG drift, schema migration, and snapshot impact on every applicable plan.
- Hands off to a specialist agent (see routing table in `pm-agent.md`) after producing a plan.
- Routes high-value changes to `@senior-lead` for technical review before implementation begins.

**Supporting docs:**

- Spec + system prompt: `.github/agents/pm-agent.md`
- Knowledge map: `docs/agent/pm-agent-knowledge-map.md`
- Baseball rules delta: `docs/agent/baseball-rules-delta.md`
- Eval suite: `docs/agent/pm-agent-eval-suite.md`
- Rollout playbook: `docs/agent/pm-agent-rollout.md`

---

### `senior-lead`

**When to use:** Any high-value change that requires cross-cutting technical review before implementation — including RxDB schema changes, PRNG-adjacent simulation changes, CI security changes, broad refactors, or any change flagged P0/P1 by `@pm-agent`.

**The Senior Lead is the final engineering sign-off layer.** All other agents execute; the Senior Lead reviews and approves/blocks.

**Mandatory review triggers (any one is sufficient):**

- Any RxDB schema `properties`, `required`, or `indexes` change
- Any change to simulation PRNG call order
- Any change to save/export format (FNV-1a signature, event `idx` structure)
- Any CI workflow permission change, container image bump, or new secret usage
- Any refactor touching ≥ 5 files in `src/features/gameplay/context/`
- Any change to `copilot-setup-steps.yml`
- Any change flagged P0 or P1 by `@pm-agent`

**Key guardrails:**

- Issues a structured verdict: **APPROVE**, **REQUEST_CHANGES**, or **BLOCK**
- Holds technical veto on BLOCK verdicts — `@pm-agent` cannot override a BLOCK
- Evaluates all five review categories: product risk, technical risk, determinism/regression risk, data/security risk, rollback readiness
- Does not replace domain agents — delegates implementation to the appropriate specialist after review

**Spec:** `.github/agents/senior-lead.md`

---

### `baseball-manager`

**When to use:** Reviewing completed game-run logs to identify what should be tuned for more realistic baseball outcomes. Also use after any gameplay-probability change to validate the result feels like real baseball.

> **Decision rule — realism vs correctness:**
>
> - Use `@baseball-manager` when the question is _"does this feel like baseball?"_ — the engine runs without errors but outcomes look implausible (e.g., walk rate 3× MLB average).
> - Use `@simulation-correctness` when the question is _"is this broken?"_ — the behavior is objectively wrong, reproducible with a seed, and fixable with a code change.

**Key guardrails:**

- Grounds recommendations in log evidence, not assumptions
- Separates must-fix realism issues from nice-to-have tuning
- Prefers targeted parameter/logic adjustments over broad rewrites
- Requires explicit expected effects, tradeoffs, and validation steps
- Routes any code-change recommendation to `@pm-agent` first for risk review and implementation planning

**Works with `@pm-agent`:** These two agents form the planning ↔ validation loop for gameplay changes. `@pm-agent` plans and scopes; `@baseball-manager` validates realism before and after. See the collaboration section in each agent's spec file for the full handoff protocol.

---

### `safe-refactor`

**When to use:** Any code reorganization, extraction, rename, or modularization task where observable behavior must not change.

**Key guardrails:**

- Preserves deterministic PRNG call order (no replay drift)
- Preserves reducer routing, invariants, and debug output
- Keeps PRs scoped — no opportunistic rewrites
- Requires layered test coverage (handler-level + root orchestration)

---

### `ui-visual-snapshot`

**When to use:** Any UI, layout, typography, styled-components, or responsive-design change — especially if Playwright visual snapshots may be affected.

**Key guardrails:**

- Assumes snapshots must be regenerated for any visible UI change
- Validates across all 6 device/viewport Playwright projects
- Enforces `dvh` over `vh` for modal sizing; `mq` helpers over raw `@media`

**Critical — Playwright container parity:**

> Visual snapshot baselines must be regenerated in an environment matching the Playwright E2E CI Docker container (`mcr.microsoft.com/playwright:v1.58.2-noble`). Font/system library differences between environments create false visual diffs. Use the Docker container locally or trigger the `update-visual-snapshots` workflow.

---

### `simulation-correctness`

**When to use:** Something in the simulation is **definitively broken** — a deterministic bug, an impossible game state (e.g., 3 hits in 1 AB), a stat inconsistency, a lineup/team mapping error, or a PRNG/seed replay mismatch.

> **Decision rule — correctness vs realism:**
>
> - Use `@simulation-correctness` when the question is _"is this broken?"_ — the behavior is objectively wrong, reproducible, and fixable.
> - Use `@baseball-manager` when the question is _"does this feel like baseball?"_ — the engine is technically correct but outcomes look unrealistic in game logs.

**Key guardrails:**

- Requires seed + event index captured before touching any code
- Validates invariants: batting line consistency, lineup wrap, home/away mapping, scoreboard totals
- Adds seed-anchored regression tests for every fixed bug
- All randomness flows through `src/utils/rng.ts` — no `Math.random()` in simulation code

---

### `ci-workflow`

**When to use:** GitHub Actions workflow changes — Playwright CI, lint/test CI, sharding, artifact uploads, or Copilot setup steps.

**Key guardrails:**

- Minimal, safe workflow diffs; artifact uploads preserved
- Does not assume system `apt` packages are cacheable
- For Playwright container jobs: browser binaries are pre-installed — no extra `playwright install` step

**Critical — Copilot Setup Steps workflow:**

> `.github/workflows/copilot-setup-steps.yml` must **NOT** use `container:`. Copilot's internal bootstrap steps can fail inside containers due to `/bin/sh` vs bash shell compatibility issues (e.g., `pipefail`). This is a known, intentional configuration for this repo.

---

### `rxdb-save-integrity`

**When to use:** RxDB persistence changes — save/load, export/import, event-log structure, `SaveStore` API, `stateSnapshot` format, or **any change to a collection's JSON schema**.

**Key guardrails:**

- Treats FNV-1a export signature and monotonic event `idx` as critical invariants
- **Schema changes require a version bump + migration strategy that never throws** — any properties change at the same version causes DB6 for all existing users
- Tests malformed import payloads, collisions, and partial-write safety
- Verifies correctness under long autoplay sessions (hundreds of events)
- Keeps `save-load.spec.ts` and `import.spec.ts` E2E tests passing

---

### `playwright-prod`

**When to use:** Live-browser QA sessions against the production site at blipit.net — taking screenshots, checking layout, verifying deployed features with the Playwright MCP.

**Key guardrails:**

- **Always start the proxy first** — run the bash snippet at the top of the agent file before any Playwright MCP tool call
- **Navigate to `http://localhost:3456`**, never `https://blipit.net` — the browser sandbox always strips non-localhost entries from `--allowed-origins`
- The proxy is started **on demand**, not always-on — only spun up when this agent is invoked
- blipit.net is in the repo-level firewall allowlist — no special config needed; the proxy works out of the box

---

### `e2e-test-runner`

**When to use:** Running, debugging, authoring, or updating Playwright E2E tests — especially when visual snapshot baselines need to be regenerated.

**Key guardrails:**

- Always runs tests inside `mcr.microsoft.com/playwright:v1.58.2-noble` via `docker run` — never on the host
- Can regenerate and **commit visual snapshot baselines directly** (no workflow wait) because the container is identical to CI
- Only commits PNGs for intentionally changed visuals — no unrelated snapshot churn
- Uses `loadFixture` for instant game-state setup; never adds `test.setTimeout()`

**Critical — Node 24 inside the container:**

> The Playwright container does not ship Node 24. Every `docker run` command must install it first: `npm install -g n && n 24 && hash -r` before `corepack enable && yarn install`.

---

## Senior Lead collaboration matrix

Use this table to determine when `@senior-lead` review is required and what evidence to bring.

| Agent                     | When `@senior-lead` review is required                                            | Evidence to provide                                                | Expected verdict                                                           |
| ------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `@safe-refactor`          | Refactor spans ≥ 5 gameplay context files OR touches reducer cycle order          | Diff summary, test coverage before/after, seed replay confirmation | Risk class + APPROVE / REQUEST_CHANGES                                     |
| `@simulation-correctness` | Fix alters PRNG call order OR touches `advanceRunners`, `gameOver`, or `hitBall`  | Seed + event index, before/after RNG call trace, regression test   | Determinism sign-off + technical verdict                                   |
| `@rxdb-save-integrity`    | Any schema version bump OR save/export format change                              | Schema diff, migration strategy code, upgrade-path test result     | Data integrity sign-off + go/no-go                                         |
| `@ci-workflow`            | Workflow permission change, container image bump, or new secret usage             | Workflow diff, permission scope, artifact impact summary           | Security sign-off + APPROVE / BLOCK                                        |
| `@ui-visual-snapshot`     | Layout changes affecting all 6 viewport/device Playwright projects simultaneously | Before/after screenshots, responsive-smoke test results            | Risk assessment (hard-block only if mobile CTA or accessibility is broken) |
| `@e2e-test-runner`        | Fixture format changes OR removal/skip of the determinism project test            | Fixture diff, test coverage impact, project list                   | APPROVE / REQUEST_CHANGES                                                  |
| `@playwright-prod`        | Production QA reveals a regression introduced by a recent merge                   | QA report, reproduction steps, affected route or component         | Root cause assessment + fix recommendation                                 |

---

## Common gotchas

| Gotcha                     | Detail                                                                                                                                                                                                                                                                                                                                 |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Determinism                | All `random()` calls flow through `src/utils/rng.ts`. Any conditional call insertion/removal breaks seed replay.                                                                                                                                                                                                                       |
| Snapshot environment       | Regenerate baselines inside `mcr.microsoft.com/playwright:v1.58.2-noble` using the `e2e-test-runner` agent (`docker run --update-snapshots`) or via the `update-visual-snapshots` workflow. Never commit locally generated PNGs.                                                                                                       |
| Copilot setup workflow     | `copilot-setup-steps.yml` must not use `container:` — known bootstrap shell compatibility issue.                                                                                                                                                                                                                                       |
| Reducer cycle order        | `strategy → advanceRunners → gameOver → playerOut → hitBall → buntAttempt → playerActions → reducer`. No circular imports.                                                                                                                                                                                                             |
| RxDB schema versioning     | Any change to a collection's `properties`, `required`, or `indexes` at the same `version` causes DB6 for all existing users. Always bump `version`, add a migration strategy that never throws, and add an upgrade-path unit test.                                                                                                     |
| `useSaveStore` in tests    | Requires `<RxDatabaseProvider>` in tree. Always mock with `vi.mock("@hooks/useSaveStore", ...)` in component tests.                                                                                                                                                                                                                    |
| `dvh` vs `vh`              | Always use `dvh` for modal `max-height` — `100vh` on mobile can exceed visible viewport.                                                                                                                                                                                                                                               |
| E2E test speed             | If a test waits >30 s for autoplay to reach a game state (decision panel, RBI on board, specific inning), use `loadFixture(page, "name.json")` with a pre-crafted fixture instead. See "Save Fixtures for E2E Testing" in `../docs/e2e-testing.md`.                                                                                    |
| PR title/description scope | Each `report_progress` call overwrites the PR title and description. Always run `git log --oneline` first to understand the full scope of all commits across all sessions before writing `prTitle`/`prDescription`. The PR title and description must summarize the **entire** PR, not only the current session's incremental changes. |
| PR description format      | Must follow `.github/pull_request_template.md` (Summary, Changes, Testing, Risks sections) with prose content. Checklist-only or random-list descriptions are rejected by the PR Description Check CI workflow.                                                                                                                        |
