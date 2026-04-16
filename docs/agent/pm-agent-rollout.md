# PM Agent — Rollout Playbook

Phase-gated deployment plan for the Ballgame Project Manager Agent.

---

## Overview

The PM Agent is a **GitHub Copilot custom agent** for `maniator/blipit-legends`. It provides repo-aware project planning, baseball rules adjudication, and guided implementation planning. This playbook defines how to roll it out safely, verify quality at each gate, and maintain it over time.

---

## Phase 1 — Internal preview

**Goal:** Validate that the agent prompt, knowledge map, and baseball delta produce correct, well-cited answers before any broader use.

**Activities:**
1. Invoke the agent manually using the prompts in `docs/agent/pm-agent-eval-suite.md` (Categories 1, 2, and 3).
2. Score each answer against the known-answer criteria and fill in the scorecard table.
3. For any `F` or `P*` result, update `.github/agents/pm-agent.md` (agent instructions), `docs/agent/baseball-rules-delta.md`, or `docs/agent/pm-agent-knowledge-map.md` as needed.
4. Re-run failing questions after each update.

**Entry criteria:** All deliverable docs merged to `main`.  
**Exit criteria:** Suite pass rate ≥ 85% (≥ 15 of 17 questions pass) on two consecutive runs with no changes between runs.

**Owner:** Core team.

---

## Phase 2 — Controlled usage

**Goal:** Use the agent on real tasks to surface gaps in routing, tone calibration, and citation accuracy under natural usage patterns.

**Activities:**
1. Route all gameplay-rule questions and feature planning requests through `@pm-agent` before starting implementation.
2. Route all PR description drafts for gameplay engine changes through `@pm-agent` for a risk-flag pass.
3. Log any answer that required manual correction; use corrections to improve the prompt.
4. Run the eval suite again at the end of Phase 2.

**Entry criteria:** Phase 1 exit criteria met.  
**Exit criteria:** No uncorrected agent errors in two consecutive weeks of active usage; eval suite still at ≥ 85%.

**Owner:** Core team.

---

## Phase 3 — Default PM assistant

**Goal:** The agent is the default first stop for all gameplay/rules-heavy tasks and PR planning.

**Activities:**
1. All issues tagged `gameplay`, `rules`, or `planning` get an `@pm-agent` planning pass before work begins.
2. The routing table in `.github/agents/README.md` and `.github/copilot-instructions.md` is the authoritative trigger list — no explicit `@pm-agent` invocation needed for covered request types.
3. Monthly knowledge refresh cycle begins (see Maintenance below).

**Entry criteria:** Phase 2 exit criteria met.  
**Exit criteria:** Ongoing; no graduation — agent is always active.

**Owner:** Core team.

---

## Maintenance

### Monthly cadence

Each month:
1. Re-run the full eval suite (`docs/agent/pm-agent-eval-suite.md`).
2. Spot-check all Layer A2 source files in `docs/agent/pm-agent-knowledge-map.md` for drift vs. the delta table.
3. Update `docs/agent/baseball-rules-delta.md` if any source file has changed since the last review.
4. Commit the updated scorecard row.

### Triggered refresh

Perform a targeted refresh whenever any of these happen:

| Trigger | Files to re-verify | Action |
|---|---|---|
| Any `src/features/gameplay/context/*.ts` file changes | All Layer A2 entries for that file | Update delta rows; re-run BA + MX eval questions that touch the file |
| New `DecisionType` added to `decisionTypes.ts` | `decisionTypes.ts`, `reducer.ts` | Add new delta row; add new BA eval question |
| RxDB schema version bumped | `rxdb-persistence.md`, `db.ts` | Update knowledge-map A1 entry; verify PM-04 still passes |
| New Playwright project added | `e2e-testing.md` | Update A1 entry; verify PM-03 still references all projects |
| New route added to app | `architecture.md`, `repo-layout.md` | Update A1 entries; verify MX-03 still reflects correct route-add checklist |
| MLB rule change | `baseball-rules-delta.md` B1 section | Update affected delta rows; re-run all BA questions in that rule area |

### Prompt update process

When updating `.github/agents/pm-agent.md`:
1. Make the smallest change that fixes the observed gap.
2. Re-run the full eval suite.
3. Commit with a message describing which eval question was failing and how the prompt change fixes it.
4. Update the scorecard with the new run results.

---

## Rollback

If the agent produces harmful or significantly incorrect answers at any phase:
1. Revert `.github/agents/pm-agent.md` to the last passing commit.
2. File a GitHub issue describing the failure, the prompt it was responding to, and the incorrect output.
3. Fix the root cause in a new branch; validate against the eval suite before re-merging.
