# 03 — Dev implementation orchestration (Amelia)

## Sequence-gated execution order

### 3A) P0-1 watch-mode permission enforcement

Deliver:

- Spectator/watch launches cannot enable manager controls.
- Manager-only controls are hidden/disabled in watch sessions.
- Unit + E2E regression coverage added.

### 3B) P0-2 managed-team auto-sim branch

Deliver:

- Season-home flow supports managed-team auto-sim/headless progression.
- Auto-sim completion writes scores to schedule and updates standings.
- Integration + E2E tests added for branch and write-back behavior.

### 3C) P0-3/P0-4 mixed-mode selector + wizard gating

Deliver:

- Screenshot-critical selector readability/accessibility hardening.
- Explicit managed-team selection enforcement.
- Step-level wizard validation gating and inline error placement.
- Unit/component/E2E + screenshot-linked a11y checks added.

## Post-P0 parallel-safe execution

### 3D) P1 + non-league polish slices

Deliver:

- Execute remaining PM-board slices in parallel only when module overlap risk is absent.
- Keep each slice independently testable and rebase against latest stabilized P0 state.

## Validation cadence per slice

Run at minimum for each merged slice:

- `yarn lint`
- `yarn format:check`
- `yarn typecheck`
- `yarn typecheck:e2e`
- `yarn test:coverage`
- `yarn build`
- `yarn test:e2e`

## Conflict minimization

- One logical slice per PR.
- No simultaneous edits to same route/state modules.
- Keep test IDs stable.
- Prefer unit/component assertions before E2E expansion.
