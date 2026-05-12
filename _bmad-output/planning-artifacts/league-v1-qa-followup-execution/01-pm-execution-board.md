# 01 — PM execution board (implementation-ready)

## Objective

Close League v1 QA follow-up in QA-first order before any v2 expansion.

## Sequence-gated slices

| Slice                                     | Priority | Owner                        | Dependency        | Parallel/Schedule                   | Acceptance criteria                                                                                                  | Required tests                                         |
| ----------------------------------------- | -------- | ---------------------------- | ----------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| S1: Watch-mode permission enforcement     | P0       | Amelia (Dev)                 | None              | `sequence-gated` (first code slice) | Watch launches are spectator-only; manager controls cannot be enabled in watch sessions                              | Unit + E2E                                             |
| S2: Managed-team auto-sim/headless branch | P0       | Amelia (Dev)                 | S1 merged/rebased | `sequence-gated`                    | Managed-team ready game supports auto-sim without entering manage/watch flow; standings/schedule write-back succeeds | Integration + E2E                                      |
| S3: Mixed-mode selector readability/a11y  | P0       | Amelia (Dev) with Sally spec | S2 + UX spec      | `sequence-gated`                    | Managed-team selector is legible on mobile/desktop, keyboard+mouse operable, explicit user selection required        | Unit + Component + E2E + screenshot-linked a11y checks |
| S4: Wizard step-level gating              | P0       | Amelia (Dev)                 | S3                | `sequence-gated`                    | Invalid states cannot proceed between steps; inline errors shown at field/step level                                 | Unit + Component + E2E                                 |

## Parallel-safe slices (after P0 stabilization)

| Slice                                    | Priority      | Owner               | Dependency               | Parallel/Schedule                              | Acceptance criteria                                                                | Required tests                                       |
| ---------------------------------------- | ------------- | ------------------- | ------------------------ | ---------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------- |
| S5: Remaining validated P1 league slices | P1            | Amelia (Dev)        | P0 slices merged/rebased | `parallel-safe` (non-overlapping modules only) | P1 findings from validation matrix resolved without regressions                    | Unit/Component/Integration/E2E as mapped per finding |
| S6: Non-league polish slices             | P1/NL         | Amelia (Dev)        | P0 slices merged/rebased | `parallel-safe`                                | Non-league QA findings closed with shift-left coverage                             | Unit/Component/Integration/E2E as mapped per finding |
| S7: Ongoing docs/status deltas           | Cross-cutting | Paige (Tech Writer) | None                     | `parallel-safe` (runs with active dev slice)   | Validation and regression docs remain current and accurate after each merged slice | Documentation review + evidence link checks          |

## Operational constraints

- Rebase before each sequence-gated slice.
- One logical slice per PR/commit group.
- No concurrent edits to shared route/state modules across active slices.
- Keep `data-testid` selectors stable.
- Re-run validation artifacts after each merged slice.

## Ready-for-v2 gate

Only pass when all are true:

1. P0 findings closed with tests.
2. Screenshot-derived selector issue closed with regression coverage.
3. `docs/league-v1-followup/04-validation-status.md` shows closed P0 status.
4. `docs/league-v1-followup/05-shift-left-regression-plan.md` first-wave checks implemented.
