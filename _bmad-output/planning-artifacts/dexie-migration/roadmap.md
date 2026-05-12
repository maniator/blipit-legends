---
author: John (bmad-agent-pm)
date: 2026-05-10
plan: Dexie Storage Migration — Roadmap
parent: README.md
---

# Dexie Migration — Roadmap (v0 → v5)

> 📋 **John:** Phase-by-phase scope, deferrals, and dependency order. Per-phase M1 plans live in [`phase-plans/`](phase-plans/). Locked decisions live in [`decisions.md`](decisions.md). Each phase ships in its own PR (or small PR series); no phase may begin until the prior phase is merged to `master`.

## v0 — Documentation (this artifact set)

**Goal:** establish a single bmad-way planning artifact for the entire Dexie migration before any further code lands.

**Ships:**

- The full doc set under `_bmad-output/planning-artifacts/dexie-migration/`.
- A pointer note replacing the pre-bmad `docs/dexie-migration-plan.md`.

**Acceptance:**

- All docs listed in the [`README.md`](README.md) document map exist.
- `yarn format:check` passes on all `.md` files.
- No source code changes; no schema changes; no new dependencies.

**Defers:** everything else.

---

## v1 — Foundation ("Dexie compiles and tests")

**Goal:** install Dexie next to RxDB, define the runtime-shape Dexie schema, and prove the save/event slice can reach behavior parity in isolation. M1 plan: [`phase-plans/v1-foundation.md`](phase-plans/v1-foundation.md).

**Ships (already in the open foundation PR):**

- `dexie@^4.2.0` and `dexie-react-hooks@^4.2.0` direct dependencies; regenerated `yarn.lock`.
- `src/storage/dexieDb.ts` — typed Dexie database with v1 schema mirroring `src/storage/db.ts` collection set.
- `src/features/saves/storage/dexieSaveStore.ts` — Dexie-backed save/event store mirroring `SaveStore`.
- `PortableSaveExport` typed neutrally in `@storage/types` so both backends share one envelope.
- Schema/index unit tests (`dexieDb.test.ts`).
- Save-store parity unit tests (`dexieSaveStore.test.ts`) covering create/list/update/delete, max-save eviction with event cleanup, per-save queued event appends with index ordering, signed export/import, corrupted-signature rejection, legacy v1 bundle compatibility, and missing-team rejection.

**Acceptance:**

- Validation gate passes (see [`README.md`](README.md)).
- Coverage thresholds hold without lowering.
- Dexie code is reachable only from tests; no production module imports `dexieDb` or `dexieSaveStore`.

**Defers:**

- Custom-team and career-stats Dexie stores.
- React reactive hooks against Dexie.
- Any runtime flip.
- Repository abstraction across stores.

---

## v2 — Repository abstraction ("One interface, two backends")

**Goal:** introduce storage repository interfaces so feature stores stop depending on RxDB-specific methods. After v2, swapping the backend is a wiring change. M1 plan: [`phase-plans/v2-repository-abstraction.md`](phase-plans/v2-repository-abstraction.md).

**Ships:**

- `SaveRepository`, `CustomTeamRepository`, `CareerStatsRepository` interfaces under `src/storage/repositories/`.
- The existing `SaveStore`, `CustomTeamStore`, and career-stats helpers refactored to implement those interfaces (no behavior changes).
- A `RepositoriesProvider` (React context) that injects the live implementations into hooks/components.
- Repository contract tests under `src/storage/repositories/__contract__/` that any backend implementation must pass; in v2 they run only against the RxDB implementations.

**Acceptance:**

- All existing tests keep passing.
- No feature module imports RxDB types or RxDB methods directly.
- Contract tests are stable (will be reused in v3 against Dexie).

**Defers:**

- Dexie implementations of `CustomTeamRepository` and `CareerStatsRepository`.
- Reactive hook replacement.

---

## v3 — Dexie repositories ("Parity off the runtime path")

**Goal:** ship Dexie implementations of every repository, verified by the v2 contract tests and per-store parity tests. Dexie still does not run in production. M1 plan: [`phase-plans/v3-dexie-repositories.md`](phase-plans/v3-dexie-repositories.md).

**Ships:**

- `DexieSaveRepository` (extends Phase 1's slice with the abstraction interface).
- `DexieCustomTeamRepository` covering team create/update/delete, transactional team + roster writes (with rollback on roster-write failure), import/export, free-agent sentinel behavior, and team-roster hydration.
- `DexieCareerStatsRepository` covering completed-game persistence, batter/pitcher game-stat persistence, and career-stat queries with ordering identical to RxDB.
- Parity tests for every repository, run against both backends in CI.
- Cross-store integration test: simulate a synthetic 9-inning game end-to-end against the Dexie repositories.

**Acceptance:**

- Dexie passes the same contract test suite RxDB passes.
- No production module imports Dexie repositories yet (still gated).
- Coverage thresholds hold.

**Defers:**

- React hook replacement.
- Bridge migration of real user data.

---

## v4 — Reactive cutover & bridge migration ("Flip the runtime")

**Goal:** make Dexie the live storage path for every user, with a one-shot bridge migration that copies RxDB data into Dexie on first launch after upgrade. M1 plan: [`phase-plans/v4-cutover.md`](phase-plans/v4-cutover.md).

**Ships:**

- `useLiveRxQuery` and any other reactive RxDB hooks replaced by `useLiveQuery` from `dexie-react-hooks`, behind the same hook signatures (`useSaveStore`, `useCustomTeams`, team-with-roster hooks, saves modal/page flows, career stats pages if reactive).
- Bridge migration runner under `src/storage/migrations/bridgeRxdbToDexie.ts`, invoked once at app startup before any feature reads storage. Algorithm in [`phase-plans/v4-cutover.md`](phase-plans/v4-cutover.md) and [`risks.md`](risks.md) R1, R8, R17.
- A `featureFlags.useDexieStorage` kill switch that forces the runtime back to RxDB. Default `true` after v4 ships.
- A bridge-migration telemetry log surfaced via `appLog`.
- A non-blocking "first launch may take a moment" toast if the migration takes >1s.
- E2E coverage: Playwright smoke `create team → start game → save → reload → resume → finish → see career stats`, run with the RxDB-fixture seeded into IndexedDB before app start.

**Acceptance:**

- Bridge migration tests pass for all fixtures listed in [`phase-plans/v4-cutover.md`](phase-plans/v4-cutover.md).
- `useLiveQuery` hooks return identical shape and update timing within tolerance vs RxDB hooks.
- **Winston CR APPROVE recorded in [`decisions.md`](decisions.md) before merge.**
- `featureFlags.useDexieStorage` kill switch verified in tests.
- Coverage thresholds hold.

**Defers:**

- Removing RxDB / RxJS dependencies (kept for one bridge release in case rollback is needed).

---

## v5 — RxDB removal ("Burn the bridge")

**Goal:** delete the RxDB-specific code paths and dependencies once v4 has shipped at least one stable release with no rollback events. M1 plan: [`phase-plans/v5-rxdb-removal.md`](phase-plans/v5-rxdb-removal.md).

**Ships:**

- Removal of `rxdb` and `rxjs` from `package.json` and the lockfile.
- Removal of `src/storage/db.ts` and every RxDB schema/collection module under `src/features/*/storage/schemaV1.ts` and similar.
- Removal of `useLiveRxQuery` and any RxDB-only utilities.
- Removal of the `featureFlags.useDexieStorage` kill switch and the bridge migration runner (the marker is now permanent).
- Removal of `BETA_SCHEMA_EPOCH` reset machinery (`src/storage/db.ts:32-37`); replaced by Dexie's standard `.upgrade()` pattern.
- Documentation update in `docs/architecture.md`, `docs/repo-layout.md`, `docs/rxdb-persistence.md` (renamed or rewritten — see Open Question Q3), and `docs/project-context.md`.

**Acceptance:**

- Build size delta recorded in PR description (informational, not a hard gate).
- All tests continue to pass.
- No remaining `from "rxdb"` or `from "rxjs"` import in `src/`.
- **Winston CR APPROVE recorded in [`decisions.md`](decisions.md) before merge.**

**Defers:**

- Nothing — this is the final phase.

---

## Phase dependency graph

```
v0 (docs) ──► v1 (foundation) ──► v2 (interfaces) ──► v3 (Dexie repos) ──► v4 (cutover) ──► v5 (removal)
```

A phase may not begin until the prior phase is merged to `master`. v3 and v4 are the highest-risk merges; v4 and v5 each require an explicit Winston CR APPROVE recorded in [`decisions.md`](decisions.md).
