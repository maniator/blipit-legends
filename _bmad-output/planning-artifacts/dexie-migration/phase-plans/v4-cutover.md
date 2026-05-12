---
author: John (bmad-agent-pm)
date: 2026-05-10
plan: Dexie Storage Migration — v4 Cutover & Bridge Migration
parent: ../README.md
mode: M1
phase: v4
executionAgent: Amelia (bmad-agent-dev) — SC / RX menu; e2e-test-runner; CR APPROVE required from Winston
---

# v4 — Reactive cutover & bridge migration ("Flip the runtime")

> 📋 **John (M1 mode):** Highest-risk phase. Cannot start until v3 is merged. **Winston (`bmad-agent-architect`) CR APPROVE required** before merge, recorded in [`../decisions.md`](../decisions.md). D-pending-1 and D-pending-2 must be locked before this PR opens.

## Summary

Make Dexie the live storage path for every user. Replace `useLiveRxQuery` (and any other reactive RxDB hooks) with `useLiveQuery` from `dexie-react-hooks` behind unchanged hook signatures. Run a one-shot RxDB → Dexie bridge migration on first launch after upgrade. Ship a `featureFlags.useDexieStorage` kill switch so we can flip back to RxDB without a redeploy.

## Implementation plan

### Bridge migration runner

1. **Create `src/storage/migrations/bridgeRxdbToDexie.ts`** with a single exported `runBridgeMigration()` returning `{ ok: true, copied } | { ok: false, error, partialState }`.
2. **Algorithm** (must be invoked at app startup before any feature reads storage):
   1. Read `localStorage["ballgame:dexieMigrationComplete"]`. If equals `String(DEXIE_SCHEMA_VERSION)`, skip; runtime = Dexie.
   2. Else open RxDB at its current epoch read-only. If RxDB does not exist (fresh install), set the marker, runtime = Dexie, done.
   3. Open Dexie. Verify destination tables are empty. If non-empty, abort with `BridgeMigrationError("destination-not-empty")` (R17 — guards a second-tab corruption window).
   4. For each collection in order `teams → players → saves → events → completedGames → batterGameStats → pitcherGameStats`: read all source records, open a `rw` transaction over the destination table family, `bulkPut` records, verify count + representative ID, log structured `appLog` events.
   5. Set `localStorage["ballgame:dexieMigrationComplete"] = String(DEXIE_SCHEMA_VERSION)`.
   6. Switch the `RepositoriesProvider` to the Dexie implementations.
3. **Runner is idempotent** — repeated invocations from the same browser tab produce the same destination state and never double-write.
4. **Telemetry**: emit `dexie.bridge.start` / `dexie.bridge.success` / `dexie.bridge.failure` via `appLog` (`@shared/utils/logger`). Format per D-pending-1.

### Reactive hooks

5. **Replace `useLiveRxQuery`** call sites with `useLiveQuery` from `dexie-react-hooks` behind the existing hook signatures (`useSaveStore`, `useCustomTeams`, team-with-roster hooks, saves modal/page flows, career stats pages if reactive). Hook surface must be unchanged for callers.
6. **Hook-parity tests** prove insert/update/delete observability and timing match the previous RxDB-backed hooks within tolerance.

### Kill switch

7. **Add `featureFlags.useDexieStorage`** in the existing feature-flag mechanism. Default per D-pending-2. When `false`, `RepositoriesProvider` selects RxDB even if the marker is set; the marker is left intact so we do not re-bridge on next launch.
8. **Kill-switch surface** (dev-only vs user-facing) per D-pending-2.

### UX

9. **Non-blocking toast** "First launch may take a moment" if the migration takes >1s. No modal; reuse existing toast/snackbar pattern.

### Service worker guard

10. **Lint guard** in CI rejects any `dexie` or `dexie-react-hooks` import in `src/sw.ts` (R7). Routed to `ci-workflow` agent for the workflow change.

### E2E

11. **Playwright bridge smoke** in the `desktop` project: seed an `IndexedDB` `ballgame` fixture (the `max-saves-full-log` JSON snapshot) **before** app launch via `addInitScript`, open the app, observe the migration completes, navigate `home → manage teams → start game → save → reload → resume → finish game → career stats visible`. Routed to `e2e-test-runner` agent.
12. **Determinism Playwright project** re-runs both with and without a bridge fixture seeded; both runs must produce identical play-by-play (R3).

### Documentation

13. Update `docs/architecture.md` persistence section to reference the bridge migration.
14. Update [`../README.md`](../README.md) status snapshot to "v4 in flight" when the PR opens, "v4 shipped" on merge.

## Evidence / citations

- v3 Dexie repository implementations land the read/write APIs the bridge writes through.
- Existing logger to surface telemetry: `@shared/utils/logger` (`appLog`).
- Existing RxDB collection set the bridge reads from: `src/storage/db.ts:39-49,117-125`.
- Service worker location for the lint guard: `src/sw.ts`.
- Determinism Playwright project: `e2e/tests/determinism.spec.ts`, `package.json:22-27`.
- Existing feature-flag mechanism (used by league-mode flags) — locate at code-time to keep the same surface.

## Risk flags

- [x] **PRNG call-order impact** — None at the storage layer. Re-validated by the determinism Playwright project running with and without a bridge fixture.
- [x] **Save/replay compatibility** — Highest risk in this phase. Closed by the bridge fixture matrix below + max-saves event-log fixture.
- [x] **RxDB schema migration required?** — No (RxDB schema unchanged; we only read from it).
- [x] **Visual snapshot regeneration required?** — No (no UI surface changes beyond the optional toast; if the toast is added behind a transient state it should not fall into existing visual snapshots — re-verify with `e2e-test-runner`).
- [x] **E2E fixture update required?** — Yes. New `IndexedDB` fixture loader in Playwright. Routed to `e2e-test-runner`.
- [x] **In-app rulebook update required?** — No.
- [x] **`baseball-rules-delta.md` update required?** — No.

Risk register references: R1 (data loss), R3 (event-ordering drift), R4 + R15 (reactive hook semantics), R7 (SW guard), R8 (marker write atomicity), R9 (kill switch UX), R13 (fixture rot), R17 (second-tab corruption).

### Bridge fixture matrix (must all be green before merge)

- empty source DB
- one-save
- max-saves with full event log
- two custom teams with full rosters
- one completed game with full batter + pitcher stats
- corrupted source DB (must not data-loss; surfaces guarded error)
- destination-not-empty abort
- verify-failed abort
- idempotent re-run

Fixtures live under `src/storage/migrations/__fixtures__/` with sibling `.expected.json` files asserting post-migration counts and representative IDs.

## Validation checklist

```
yarn lint && yarn format:check && yarn typecheck && yarn typecheck:e2e && yarn test:coverage && yarn build && yarn test:e2e
```

Additional v4 gates (mirrored in [`../cutover-checklist.md`](../cutover-checklist.md)):

- All bridge fixture cases green.
- `featureFlags.useDexieStorage = false` test proves the kill switch routes back to RxDB.
- Hook-parity tests pass.
- Service-worker lint guard rejects deliberately broken `src/sw.ts` test fixture.
- Determinism Playwright project green with bridge fixture seeded.
- Bundle-size delta recorded in PR description (R10, informational).

## Execution agent

- **Amelia (`bmad-agent-dev`)** — SC menu (simulation correctness) for bridge runner + kill switch wiring; RX menu (schema) for the marker key contract.
- **`e2e-test-runner`** — Playwright bridge smoke fixture authoring and execution.
- **`ci-workflow`** — service-worker lint guard CI rule.
- **Winston (`bmad-agent-architect`)** — CR APPROVE required, recorded in [`../decisions.md`](../decisions.md) D7 sign-off table before merge.

## Open questions

- D-pending-1 (telemetry signal format) must be locked before this PR opens.
- D-pending-2 (`useDexieStorage` default + surface) must be locked before this PR opens.
- Decision needed before merge on whether to delete the legacy `ballgame` IndexedDB after a successful bridge cycle (current default: keep it for the v4 release window so the kill switch remains effective; delete in v5).
