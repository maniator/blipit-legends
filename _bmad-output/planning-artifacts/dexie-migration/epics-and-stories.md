---
author: John (bmad-agent-pm)
date: 2026-05-10
plan: Dexie Storage Migration — Epics & Stories
parent: README.md
menuItem: CE
---

# Dexie Migration — Epics & Stories

> 📋 **John:** This is the bmad CE-menu (Create Epics & Stories) artifact for the Dexie migration. One epic per phase v1–v5; each story is sized to land in a single PR (or a small reviewable PR series). Stories list acceptance criteria, file refs, the lead execution agent, and the risk flags they must close. Stories within an epic may be parallelized when they don't share files; stories across epics are strictly sequential per [`roadmap.md`](roadmap.md).

## Epic E0 — Planning artifact (this PR)

**Lead:** John (PM, this artifact). **Goal:** the bmad-way planning artifact set is in place under `_bmad-output/planning-artifacts/dexie-migration/` and the pre-bmad `docs/dexie-migration-plan.md` is replaced by a pointer.

| Story | Title                                                                      | Acceptance                                                                                    |
| ----- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| S0.1  | Author the planning artifact set                                           | All docs listed in [`README.md`](README.md) document map exist and `yarn format:check` passes |
| S0.2  | Replace `docs/dexie-migration-plan.md` with a pointer to the bmad location | File contains a one-paragraph pointer; no broken doc links                                    |

---

## Epic E1 — Foundation

**Lead:** Amelia (`bmad-agent-dev` SR/RX). **Goal:** Dexie compiles and tests next to RxDB; production runtime unchanged. **PR:** the open foundation PR. **M1 plan:** [`phase-plans/v1-foundation.md`](phase-plans/v1-foundation.md).

| Story | Title                                                                    | Acceptance                                                                                          | Risk flags closed |
| ----- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ----------------- |
| S1.1  | Add direct `dexie` and `dexie-react-hooks` deps + lockfile               | `package.json` has both deps; `yarn.lock` regenerated; `yarn install` is deterministic              | R16               |
| S1.2  | Add typed Dexie database `src/storage/dexieDb.ts` with v1 schema         | All 7 tables and indexes from `data-model` table exist; schema test passes                          | R5                |
| S1.3  | Add `dexieSaveStore.ts` with parity for `SaveStore` save-lifecycle slice | All parity test cases listed in [`phase-plans/v1-foundation.md`](phase-plans/v1-foundation.md) pass | R2, R3            |
| S1.4  | Add neutral `PortableSaveExport` type re-export in `@storage/types`      | Both backends import from `@storage/types`; no duplicate type definitions                           | R2                |

---

## Epic E2 — Repository abstraction

**Lead:** Amelia (`bmad-agent-dev` SR), **AD sign-off:** Winston. **Goal:** all feature stores consume storage via repository interfaces; RxDB stays the live backend. **M1 plan:** [`phase-plans/v2-repository-abstraction.md`](phase-plans/v2-repository-abstraction.md).

| Story | Title                                                                   | Acceptance                                                                                | Risk flags closed |
| ----- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------- |
| S2.1  | Define `SaveRepository` interface + RxDB implementation                 | `SaveStore` is refactored to implement the interface; existing tests pass unchanged       | —                 |
| S2.2  | Define `CustomTeamRepository` interface + RxDB implementation           | `CustomTeamStore` is refactored to implement the interface; existing tests pass unchanged | —                 |
| S2.3  | Define `CareerStatsRepository` interface + RxDB implementation          | Career-stats helpers refactored to implement the interface; existing tests pass unchanged | —                 |
| S2.4  | Add `RepositoriesProvider` context wiring                               | One injection point in app root; tests can swap implementations via provider              | —                 |
| S2.5  | Add contract test suites under `src/storage/repositories/__contract__/` | RxDB implementations pass all contract suites; suites are reusable for v3                 | R5                |
| S2.6  | Migrate feature call sites off direct RxDB imports                      | No `from "rxdb"` import remains under `src/features/` (storage-layer files exempt)        | R5                |

---

## Epic E3 — Dexie repository implementations

**Lead:** Amelia (`bmad-agent-dev` SR/RX). **Goal:** Dexie passes the same contract suites; production runtime still on RxDB. **M1 plan:** [`phase-plans/v3-dexie-repositories.md`](phase-plans/v3-dexie-repositories.md).

| Story | Title                                                           | Acceptance                                                                    | Risk flags closed |
| ----- | --------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------- |
| S3.1  | `DexieSaveRepository` — wrap Phase 1 slice with the abstraction | Passes `SaveRepository` contract suite                                        | R2, R3            |
| S3.2  | `DexieCustomTeamRepository` with team + roster transaction      | Passes `CustomTeamRepository` contract suite; rollback test green             | R6, R11           |
| S3.3  | `DexieCareerStatsRepository` with completed-game transaction    | Passes `CareerStatsRepository` contract suite; ordering test green            | R6, R12           |
| S3.4  | Cross-store integration test on Dexie (synthetic 9-inning game) | New test under `src/storage/__integration__/`; passes                         | R3, R12           |
| S3.5  | CI matrix runs contract suites against both RxDB and Dexie      | CI workflow change ships via `ci-workflow` agent; both backend rows are green | R5                |

---

## Epic E4 — Reactive cutover & bridge migration

**Lead:** Amelia (`bmad-agent-dev` SC/RX), **CR APPROVE required:** Winston, **E2E support:** `e2e-test-runner`. **Goal:** Dexie is the live runtime path; RxDB remains on disk for rollback. **M1 plan:** [`phase-plans/v4-cutover.md`](phase-plans/v4-cutover.md).

| Story | Title                                                                                  | Acceptance                                                                                | Risk flags closed |
| ----- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------- |
| S4.1  | Replace `useLiveRxQuery` with `useLiveQuery` from `dexie-react-hooks` behind hook seam | Hook signatures unchanged; hook-parity tests pass                                         | R4, R15           |
| S4.2  | Bridge migration runner `src/storage/migrations/bridgeRxdbToDexie.ts`                  | Algorithm in [`phase-plans/v4-cutover.md`](phase-plans/v4-cutover.md); fixture tests pass | R1, R8, R17       |
| S4.3  | `featureFlags.useDexieStorage` kill switch                                             | Flag default per D-pending-2; toggling test passes                                        | R9                |
| S4.4  | Telemetry events `dexie.bridge.{start,success,failure}` via `appLog`                   | Format per D-pending-1; emitted in tests                                                  | R8, R13           |
| S4.5  | Non-blocking "first launch may take a moment" toast at >1s migration time              | Toast appears in synthetic slow-migration test                                            | —                 |
| S4.6  | Service-worker lint guard rejecting `dexie` import in `src/sw.ts`                      | CI rule fails on a deliberately broken `src/sw.ts` test fixture                           | R7                |
| S4.7  | Playwright bridge-migration smoke (`desktop` project)                                  | Seeds RxDB fixture, completes full game flow against Dexie runtime                        | R1                |
| S4.8  | Architect CR APPROVE recorded in [`decisions.md`](decisions.md)                        | New row added to D7 sign-off table                                                        | D7                |

---

## Epic E5 — RxDB removal

**Lead:** Amelia (`bmad-agent-dev` SR), **CR APPROVE required:** Winston. **Goal:** RxDB and RxJS are gone. **M1 plan:** [`phase-plans/v5-rxdb-removal.md`](phase-plans/v5-rxdb-removal.md).

| Story | Title                                                           | Acceptance                                                            | Risk flags closed |
| ----- | --------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------- |
| S5.1  | Stable-release window satisfied per D-pending-4                 | PM confirms release count; recorded in [`decisions.md`](decisions.md) | R14               |
| S5.2  | Remove `rxdb` and `rxjs` from `package.json` and lockfile       | `yarn install` succeeds; build size delta recorded in PR description  | —                 |
| S5.3  | Delete `src/storage/db.ts` and feature `schemaV1.ts` modules    | `tsc --noEmit` passes; no orphan exports                              | R14               |
| S5.4  | Delete bridge migration runner + `featureFlags.useDexieStorage` | All call sites removed; `BETA_SCHEMA_EPOCH` reset machinery deleted   | —                 |
| S5.5  | CI grep gate: no `from "rxdb"` or `from "rxjs"` in `src/`       | New CI step fails on a deliberately broken test fixture               | R14               |
| S5.6  | Doc updates per D-pending-3                                     | Affected docs updated; index in `docs/README.md` resolves             | R18               |
| S5.7  | Architect CR APPROVE recorded in [`decisions.md`](decisions.md) | New row added to D7 sign-off table                                    | D7                |

---

## Story sequencing summary

```
E0 ──► E1 ──► E2 ──► E3 ──► E4 ──► E5
       (S1.1..S1.4 parallel-OK)
              (S2.1..S2.3 parallel-OK; then S2.4..S2.6 sequential)
                     (S3.1..S3.3 parallel-OK; then S3.4..S3.5)
                            (S4.1..S4.7 mostly parallel; S4.8 last)
                                   (S5.1 first; S5.2..S5.6 parallel-OK; S5.7 last)
```

## Definition of done (every story)

- All listed acceptance criteria are verified in CI.
- Validation gate from [`README.md`](README.md) passes.
- Coverage thresholds hold without lowering.
- Risk flags listed in the story row are explicitly closed (test exists, decision recorded, etc.).
- Story-specific docs updated where listed.
- For E4 / E5: Winston CR APPROVE recorded.
