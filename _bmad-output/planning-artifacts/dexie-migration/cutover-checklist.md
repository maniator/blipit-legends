---
author: John (bmad-agent-pm)
date: 2026-05-10
plan: Dexie Storage Migration — Cutover Checklist
parent: README.md
---

# Dexie Migration — Cutover Checklist

> 📋 **John:** Items that must be **100% green** before the v4 runtime cutover PR may merge. Phase 5 (RxDB removal) has its own short list at the bottom.

## v4 cutover gates

### Engineering

- [ ] All Phase 2 repository contract tests pass against both RxDB and Dexie implementations.
- [ ] All Phase 3 backend-specific tests pass (transaction rollback, error translation).
- [ ] Cross-store integration test (synthetic 9-inning game on Dexie repositories) passes.
- [ ] Bridge-migration tests pass for every fixture in `src/storage/migrations/__fixtures__/`:
  - [ ] empty source DB
  - [ ] one-save
  - [ ] max-saves with full event log
  - [ ] two custom teams with rosters
  - [ ] one completed game with batter + pitcher stats
  - [ ] corrupted source DB (no data loss; surfaces guarded error)
  - [ ] destination-not-empty abort
  - [ ] verify-failed abort
  - [ ] idempotent re-run
- [ ] `featureFlags.useDexieStorage = false` test proves the kill switch routes back to RxDB.
- [ ] Reactive hook parity tests pass (`useLiveQuery` shape and timing).
- [ ] Service-worker lint guard rejects any `dexie` import in `src/sw.ts`.

### CI / build / coverage

- [ ] `yarn lint` passes.
- [ ] `yarn format:check` passes.
- [ ] `yarn typecheck` passes.
- [ ] `yarn typecheck:e2e` passes.
- [ ] `yarn test:coverage` passes; thresholds (`90% / 80%`) hold without modification.
- [ ] `yarn build` succeeds.
- [ ] Playwright `determinism` project passes both with and without a bridge fixture seeded.
- [ ] Playwright `desktop` smoke covers the full bridge → game → save/load → career-stats path.
- [ ] Bundle-size delta recorded in PR description (informational).

### Risk & telemetry

- [ ] Bridge-migration `appLog` events (`dexie.bridge.start`, `dexie.bridge.success`, `dexie.bridge.failure`) are emitted and visible in DevTools.
- [ ] D-pending-1 (telemetry signal format) locked in [`decisions.md`](decisions.md).
- [ ] D-pending-2 (`useDexieStorage` default + surface) locked in [`decisions.md`](decisions.md).
- [ ] [`risks.md`](risks.md) reviewed; no risk above Medium impact lacks a mitigation.

### Sign-off

- [ ] **Winston (`bmad-agent-architect`) CR verdict recorded as APPROVE on the v4 PR**, captured in the D7 sign-off table in [`decisions.md`](decisions.md).
- [ ] John confirms scope matches [`roadmap.md`](roadmap.md) v4.
- [ ] Decision audit trail in [`decisions.md`](decisions.md) updated for any decisions taken during implementation.

### Documentation

- [ ] `docs/architecture.md` references the bridge migration in the persistence section.
- [ ] [`README.md`](README.md) status snapshot updated to "v4 shipped".
- [ ] `docs/copilot-instructions.md` and `docs/project-context.md` reflect the runtime change (RxDB references still allowed until v5).

---

## v5 RxDB removal gates

### Stability window

- [ ] Number of stable releases agreed in D-pending-4 have shipped on top of v4 with no rollback events triggering the kill switch.
- [ ] Telemetry shows no `dexie.bridge.failure` events from new installs (informational).

### Code

- [ ] `src/` contains no remaining `from "rxdb"` or `from "rxjs"` imports (CI grep gate).
- [ ] `package.json` no longer lists `rxdb` or `rxjs` as runtime dependencies.
- [ ] Lockfile regenerated.
- [ ] `BETA_SCHEMA_EPOCH` reset machinery removed.
- [ ] `featureFlags.useDexieStorage` kill switch removed.
- [ ] Bridge-migration runner removed; legacy `ballgame` IndexedDB deletion logic kept for one release then removed in a follow-up.

### Tests & build

- [ ] All tests still pass.
- [ ] `yarn build` succeeds; bundle-size delta recorded in PR description.
- [ ] Coverage thresholds hold.

### Documentation

- [ ] D-pending-3 resolved: `docs/rxdb-persistence.md` either renamed to `docs/dexie-persistence.md` (with redirect note) or rewritten in place.
- [ ] `docs/copilot-instructions.md`, `docs/architecture.md`, `docs/project-context.md`, `docs/repo-layout.md` no longer mention RxDB except in historical context.
- [ ] [`README.md`](README.md) status snapshot updated to "v5 shipped (migration complete)".

### Sign-off

- [ ] **Winston (`bmad-agent-architect`) CR verdict recorded as APPROVE on the v5 PR**, captured in the D7 sign-off table in [`decisions.md`](decisions.md).
