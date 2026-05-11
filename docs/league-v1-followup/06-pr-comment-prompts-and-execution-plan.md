# 06 — PR comment payload: prompts + sync vs sequence execution plan

Use the block below as the PR comment body.

```md
## ✅ League v1 QA Follow-up: Prompt Pack + Execution Orchestration

This comment provides:

1. All prompts needed for BMAD-driven execution
2. What can run in parallel safely
3. What must run in strict sequencing order to avoid conflicts

### 0) Ground rules (applies to every track)

- QA fixes are priority-first before any v2 expansion.
- Route work through BMAD specialists (PM/UX/Dev/Tech Writer) and operational agents.
- Keep tests shift-left (unit/component first, then E2E).
- Preserve screenshot-derived finding coverage:
  `docs/league-v1-followup/screenshots/mixed-mode-review-dropdown-unreadable-user-screenshot.png`
- Use these source docs:
  - `docs/league-v1-followup/01-qa-report.md`
  - `docs/league-v1-followup/04-validation-status.md`
  - `docs/league-v1-followup/05-shift-left-regression-plan.md`

---

### 1) Master PM kickoff prompt (run first, sequence)

**Agent:** `bmad-agent-pm` (John)

**Prompt:**

> Create the implementation-ready execution board for League v1 QA follow-up using:
>
> - `docs/league-v1-followup/01-qa-report.md`
> - `docs/league-v1-followup/04-validation-status.md`
> - `docs/league-v1-followup/05-shift-left-regression-plan.md`
>
> Requirements:
>
> - Preserve QA-first order: watch-mode permissions, managed auto-sim, mixed-mode selector/readability + validation, step-level wizard gating, then P1/non-league.
> - Produce PR slices with owners, dependencies, and acceptance criteria.
> - Mark each slice as `parallel-safe` or `sequence-gated`.
> - Include test requirements per slice (unit/component/integration/E2E).

---

### 2) UX spec prompt for screenshot-critical issue (sequence after PM)

**Agent:** `bmad-agent-ux-designer` (Sally)

**Prompt:**

> Produce final UX/a11y spec for the mixed-mode managed-team selector issue shown in:
> `docs/league-v1-followup/screenshots/mixed-mode-review-dropdown-unreadable-user-screenshot.png`
>
> Deliverables:
>
> - Mobile + desktop readability requirements
> - Contrast and typography requirements
> - Keyboard/mouse interaction requirements
> - Inline validation/error placement requirements
> - Testable acceptance criteria aligned with `docs/league-v1-followup/05-shift-left-regression-plan.md`

---

### 3) Dev implementation prompt pack (Amelia)

#### 3A) P0-1 watch-mode permission enforcement (sequence-gated, first code slice)

> Implement watch-mode permission enforcement so spectator launches cannot enable manager controls. Add unit + E2E regression tests.

#### 3B) P0-2 managed-team auto-sim branch (sequence-gated, after 3A)

> Implement managed-team game auto-sim/headless progression path from season home, with standings/schedule write-back and tests.

#### 3C) P0-3/P0-4 mixed-mode selector + wizard gating (sequence-gated, after UX spec)

> Implement mixed-mode managed-team selector readability/accessibility + explicit selection enforcement + step-level validation gating. Add unit/component/E2E tests and screenshot-linked a11y checks.

#### 3D) P1 and non-league polish slices (parallel-safe once P0 slices are merged or rebased)

> Execute remaining validated P1/non-league slices per PM board with shift-left tests.

---

### 4) Tech-writer prompt for ongoing documentation updates (parallel-safe with code)

**Agent:** `bmad-agent-tech-writer` (Paige)

**Prompt:**

> Keep `docs/league-v1-followup/` updated as each slice lands:
>
> - Update validation status deltas
> - Update regression matrix status
> - Keep screenshot references current
> - Publish final “done vs open” summary for QA findings

---

### 5) What can run in parallel vs sequence

### Sequence-only (avoid conflicts)

1. PM kickoff board
2. UX spec for screenshot-critical selector
3. Dev P0-1 (watch-mode permissions)
4. Dev P0-2 (managed auto-sim)
5. Dev P0-3/P0-4 (mixed-mode selector + validation/gating)

Reason: these slices overlap routes/state and can cause merge conflicts or stale assumptions if run out of order.

### Parallel-safe tracks

- Tech-writer documentation updates can run in parallel with dev slices
- Test authoring for already-stable files in current slice can run in parallel inside that slice
- Non-overlapping P1/non-league polish can run in parallel after P0 branch stabilization

---

### 6) Conflict-minimization rules

- One logical slice per PR/commit group
- Rebase before starting each sequence-gated slice
- Do not overlap edits to the same route/state modules across two active slices
- Keep test IDs stable and prefer unit/component assertions first
- Re-run validation artifacts after each merged slice

---

### 7) Definition of ready-for-v2 gate

Only consider v2 ready when:

- P0 findings are closed with tests
- Screenshot-derived selector issue is closed with regression coverage
- `docs/league-v1-followup/04-validation-status.md` reflects closed P0 status
- `docs/league-v1-followup/05-shift-left-regression-plan.md` first-wave checks are implemented
```

## Notes

- This comment template is aligned to:
  - `docs/league-v1-followup/04-validation-status.md`
  - `docs/league-v1-followup/05-shift-left-regression-plan.md`
- If PR-comment posting tools are unavailable in the active agent runtime, copy/paste the markdown block above directly into the PR conversation.
