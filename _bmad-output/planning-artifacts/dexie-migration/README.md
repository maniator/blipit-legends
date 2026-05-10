---
author: John (bmad-agent-pm)
date: 2026-05-10
project: BlipIt Legends / Ballgame
plan: Dexie Storage Migration
status: v0 in review · v1 in flight
inputDocuments:
  - docs/project-context.md
  - docs/architecture.md
  - docs/rxdb-persistence.md
  - docs/repo-layout.md
  - docs/dexie-migration-plan.md
  - _bmad-output/planning-artifacts/prd.md
workflowType: pm-planning
---

# Dexie Storage Migration — PM Planning Artifact

> 📋 **John (Product Manager):** This is the bmad-way planning artifact for the entire Dexie storage migration. Pre-bmad notes used to live at `docs/dexie-migration-plan.md`; that file is now a pointer to this artifact. Per-phase M1 plans live in [`phase-plans/`](phase-plans/), and the implementation hand-off to Amelia / Winston is governed by [`epics-and-stories.md`](epics-and-stories.md).

## What this plan covers

The full migration from **RxDB v17 (beta) on the Dexie storage adapter** (`rxdb` + `rxjs` + `rxdb/plugins/storage-dexie` in `src/storage/db.ts:14-20`) to **direct Dexie / IndexedDB** (`src/storage/dexieDb.ts`), preserving every gameplay, save, custom-team, import/export, and career-stat behavior. Six phases v0–v5; v5 ends with RxDB and RxJS removed from `package.json`.

## Document map

| Doc                                                                                    | Purpose                                                                  |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| [`README.md`](README.md) (this file)                                                   | PM overview, status, doc map, locked contracts, execution agents         |
| [`roadmap.md`](roadmap.md)                                                             | Phase-by-phase scope, deferrals, dependency order                        |
| [`decisions.md`](decisions.md)                                                         | Locked decisions audit trail (must update when overriding)               |
| [`risks.md`](risks.md)                                                                 | Consolidated risk register with mitigations and owning phase             |
| [`epics-and-stories.md`](epics-and-stories.md)                                         | Bmad CE-menu epics & stories breakdown (one epic per phase v1–v5)        |
| [`cutover-checklist.md`](cutover-checklist.md)                                         | Gating checklist for the v4 runtime flip and v5 RxDB removal             |
| [`phase-plans/v1-foundation.md`](phase-plans/v1-foundation.md)                         | John M1 plan for v1 — typed Dexie DB + save/event slice (current PR)     |
| [`phase-plans/v2-repository-abstraction.md`](phase-plans/v2-repository-abstraction.md) | M1 plan for v2 — storage repository interfaces                           |
| [`phase-plans/v3-dexie-repositories.md`](phase-plans/v3-dexie-repositories.md)         | M1 plan for v3 — Dexie repository implementations + parity               |
| [`phase-plans/v4-cutover.md`](phase-plans/v4-cutover.md)                               | M1 plan for v4 — reactive hook cutover + bridge migration + runtime flip |
| [`phase-plans/v5-rxdb-removal.md`](phase-plans/v5-rxdb-removal.md)                     | M1 plan for v5 — RxDB / RxJS removal                                     |

## Status snapshot

| Phase | Status        | Open PR / Next action                                                                                                 |
| ----- | ------------- | --------------------------------------------------------------------------------------------------------------------- |
| v0    | **In review** | This planning artifact set                                                                                            |
| v1    | **In flight** | Existing PR (Add Dexie storage migration foundation): typed Dexie DB + save/event slice + parity tests                |
| v2    | Not started   | Awaits v1 merge; needs Winston AD on repository interface shape before story creation                                 |
| v3    | Not started   | Awaits v2 merge                                                                                                       |
| v4    | Not started   | Awaits v3 merge; pending decisions D-pending-1 and D-pending-2 in [`decisions.md`](decisions.md) must be locked first |
| v5    | Not started   | Awaits v4 stable release window; pending decisions D-pending-3 and D-pending-4 must be locked                         |

## Locked contracts (apply to every phase)

These override anything that conflicts in any sub-doc.

- **No silent data loss.** A user with saves, custom teams, or career stats in RxDB before v4 must end up with the same data in Dexie after v4. Bridge-migration tests must use realistic fixtures derived from real exported bundles.
- **One DB on the runtime path.** Production code reads and writes exactly one storage backend at any moment. Dual-write is forbidden. Cutover is a one-shot bridge migration gated by a local marker.
- **No service-worker storage access.** The service worker has never touched RxDB and must never touch Dexie either. Storage is window-only (see `docs/architecture.md`).
- **Portable save signature compatibility.** The portable save export envelope keeps `version: 1`, the field shape `{ version, header, events, sig }`, and the existing signature key string `"ballgame:rxdb:v1"` (`src/features/saves/storage/dexieSaveStore.ts:17`) verbatim so v1 bundles exported before the migration still import. The string is opaque magic, not a label. See [`decisions.md`](decisions.md) D4.
- **Seeded determinism unaffected.** All randomness still flows through `src/shared/utils/rng.ts`. Storage changes must not perturb event ordering, append index assignment, or save-resume PRNG state.
- **Schema evolution.** Dexie schema changes bump `DEXIE_SCHEMA_VERSION` and add a new `db.version(n).stores(...)` block plus a tested `.upgrade()` callback. Same-version schema changes are forbidden — this is the failure class we are leaving RxDB to escape.
- **ID generation.** All new document IDs come from `@storage/generateId` (`src/storage/generateId.ts:1-27`). Never `Date.now()` or `Math.random()`.
- **Hashing.** All hashing uses `fnv1a` from `@storage/hash`. Never reimplement.
- **Repository encapsulation.** Features (gameplay, saves, custom teams, career stats) consume storage through repository interfaces (Phase 2) and do not import Dexie or RxDB directly. Storage primitives stay encapsulated behind `@storage/*` and feature-local repositories.
- **No production cutover without architect APPROVE.** v4 (runtime flip) and v5 (RxDB removal) each require an explicit Winston (`bmad-agent-architect`) CR APPROVE recorded in [`decisions.md`](decisions.md).

## Out of scope

- Cloud sync. Storage stays local-only on IndexedDB.
- Multi-tab coordination beyond what Dexie provides natively.
- Replacing the gameplay event log model with a different shape.
- A standalone migration tool that runs outside the app.
- Backfilling historical RxDB beta releases — bridge migration starts from whatever schema epoch (`BETA_SCHEMA_EPOCH = "v1.2"` at `src/storage/db.ts:36`) the user is on at upgrade time.

## Risk flags (PM standing checklist applied to the migration as a whole)

- [x] **PRNG call-order impact** — None expected. Storage-layer changes do not call `rng.ts`. Phase 1 parity test asserts identical event-`idx` ordering under concurrent appends. Determinism Playwright project re-runs in v4 with a bridge fixture seeded.
- [x] **Save/replay compatibility** — Critical risk. Mitigated by D4 (signature key locked) and bridge-migration tests for max-saves fixture (R1, R3 in [`risks.md`](risks.md)).
- [x] **RxDB schema migration required?** — No new RxDB schema work. v5 removes RxDB entirely; bridge migration in v4 reads the existing v1 epoch. No `migrationStrategies` change.
- [x] **Visual snapshot regeneration required?** — None expected; no UI surface changes.
- [x] **E2E fixture update required?** — Yes, in v4 only. Playwright must seed an `IndexedDB` `ballgame` fixture before app launch to exercise the bridge. Routed to `e2e-test-runner` agent.
- [x] **In-app rulebook update required?** — No (`src/features/help/components/HelpContent/index.tsx` untouched).
- [x] **`baseball-rules-delta.md` update required?** — No.

## Validation gate (every phase PR must pass)

```
yarn lint && yarn format:check && yarn typecheck && yarn typecheck:e2e && yarn test:coverage && yarn build && yarn test:e2e
```

Coverage thresholds (`90% lines/functions/statements, 80% branches`) hold for every PR. Lowering them is forbidden.

## Execution agents

| Phase | Lead implementation agent       | Sign-off / support                                                             |
| ----- | ------------------------------- | ------------------------------------------------------------------------------ |
| v0    | John (PM, this artifact)        | Optional Paige (`bmad-agent-tech-writer`) for prose review                     |
| v1    | Amelia (`bmad-agent-dev` SR/RX) | Standard code review                                                           |
| v2    | Amelia (`bmad-agent-dev` SR)    | Winston (`bmad-agent-architect` AD) for interface shape sign-off               |
| v3    | Amelia (`bmad-agent-dev` SR/RX) | Winston AD if any new index is added                                           |
| v4    | Amelia (`bmad-agent-dev` SC/RX) | **Winston CR APPROVE required** + `e2e-test-runner` for bridge fixture seeding |
| v5    | Amelia (`bmad-agent-dev` SR)    | **Winston CR APPROVE required**                                                |

## Open questions (must resolve before listed phase begins)

| #   | Question                                                                                                 | Owner   | Required by |
| --- | -------------------------------------------------------------------------------------------------------- | ------- | ----------- |
| Q1  | What is the telemetry signal format for bridge-migration failures? `appLog` shape and severity.          | John    | v4          |
| Q2  | What is the `featureFlags.useDexieStorage` default and is the kill switch dev-menu only or user-facing?  | John    | v4          |
| Q3  | At v5, do we rename `docs/rxdb-persistence.md` to `docs/dexie-persistence.md` or keep both for one rel.? | Paige   | v5          |
| Q4  | How many stable releases on v4 before v5 may merge? (Concrete number.)                                   | Winston | v5          |

These match the pending-decisions table in [`decisions.md`](decisions.md). Each must be promoted to a Locked decision before the phase that depends on it can begin.
