---
author: John (bmad-agent-pm)
date: 2026-05-10
plan: Dexie Storage Migration — v1 Foundation
parent: ../README.md
mode: M1
phase: v1
executionAgent: Amelia (bmad-agent-dev) — SR / RX menu
---

# v1 — Foundation ("Dexie compiles and tests")

> 📋 **John (M1 mode):** This is the active phase, shipping in the open Dexie foundation PR.

## Summary

Install direct Dexie next to RxDB, add a typed Dexie database mirroring the current collection set, and ship a Dexie-backed save/event store slice with parity tests — without changing the production runtime storage path.

## Implementation plan

1. **Add direct dependencies** in `package.json`: `dexie@^4.2.0`, `dexie-react-hooks@^4.2.0`. Regenerate `yarn.lock`. Confirm Vercel-observed resolutions: `dexie@4.4.2`, `dexie-react-hooks@4.4.0`.
2. **Add `src/storage/dexieDb.ts`** with constants `DEXIE_DB_NAME = "ballgame-dexie"` and `DEXIE_SCHEMA_VERSION = 1`, opening the database with `db.version(1).stores(...)` for all 7 tables: `saves`, `events`, `teams`, `players`, `completedGames`, `batterGameStats`, `pitcherGameStats`. Indexes mirror the queries used in the existing RxDB stores (see `src/features/saves/storage/saveStore.ts`, `src/features/customTeams/storage/customTeamStore.ts:127-129`, `src/features/careerStats/storage/gameHistoryStore.ts:128`).
3. **Type the tables** using the existing `@storage/types` records (`SaveRecord`, `EventRecord`, `TeamRecord`, `PlayerRecord`, `CompletedGameRecord`, `BatterGameStatRecord`, `PitcherGameStatRecord`). No new record types.
4. **Add `src/features/saves/storage/dexieSaveStore.ts`** mirroring the API of `src/features/saves/storage/saveStore.ts:1-260` for: create, list, get, update progress, delete (with event cleanup), max-save eviction, queued event appends with monotonic per-save `idx`, signed export envelope, signed import with corrupted-signature rejection, missing-team import rejection. Reuse `fnv1a` from `@storage/hash` and `generateSaveId` from `@storage/generateId`.
5. **Use the locked signature key string** `"ballgame:rxdb:v1"` verbatim (`src/features/saves/storage/dexieSaveStore.ts:17`) so previously exported v1 bundles still import. Treat the string as opaque versioned magic. (D4 in `../decisions.md`.)
6. **Re-export `PortableSaveExport`** from `@storage/types` and have both backends import from there to keep envelope shape identical.
7. **Add unit tests**: `src/storage/dexieDb.test.ts` (schema, table existence, index reachability) and `src/features/saves/storage/dexieSaveStore.test.ts` (full parity matrix). Use `fake-indexeddb/auto` at the top of every test file that opens Dexie.
8. **Do not wire** any of the new files into production runtime. No `src/router.tsx`, `src/main.tsx`, `src/storage/db.ts`, or feature `useXxx` hook changes. Dexie code is reachable from tests only.

## Evidence / citations

- Existing RxDB-backed save store: `src/features/saves/storage/saveStore.ts:1-260` — the parity target.
- Existing collection set + epoch-reset machinery: `src/storage/db.ts:14-20,32-37,39-49,117-125`.
- Custom-team store query patterns mirrored into Dexie indexes: `src/features/customTeams/storage/customTeamStore.ts:54-67,83-86,127-129`.
- Career-stats store query patterns mirrored into Dexie indexes: `src/features/careerStats/storage/gameHistoryStore.ts:128`.
- ID generation contract: `src/storage/generateId.ts:1-27`.
- Hashing contract: `@storage/hash` (`fnv1a`).
- Portable save signature key already used by RxDB backend: `src/features/saves/storage/saveStore.ts:184-196`.

## Risk flags

- [x] **PRNG call-order impact** — None. Storage layer does not call `rng.ts`.
- [x] **Save/replay compatibility** — Critical. Closed by parity tests for queued event appends and the legacy v1 bundle import case (`dexieSaveStore.test.ts`).
- [x] **RxDB schema migration required?** — No. RxDB is untouched.
- [x] **Visual snapshot regeneration required?** — No.
- [x] **E2E fixture update required?** — No (Dexie is off the runtime path in v1).
- [x] **In-app rulebook update required?** — No.
- [x] **`baseball-rules-delta.md` update required?** — No.

Risk register references: R2 (signature key), R3 (event-ordering drift), R5 (schema-evolution discipline), R16 (lockfile drift).

## Validation checklist

```
yarn lint && yarn format:check && yarn typecheck && yarn typecheck:e2e && yarn test:coverage && yarn build && yarn test:e2e
```

Coverage thresholds (`90% lines/functions/statements, 80% branches`) must hold without modification.

## Execution agent

**Amelia (`bmad-agent-dev`)** — SR menu (safe-refactor) for the foundation work, RX menu (storage schema) for `dexieDb.ts`. The current foundation PR is in flight; subsequent phases route through the `CE`-menu story breakdown in [`../epics-and-stories.md`](../epics-and-stories.md).

## Open questions

None blocking v1. v2 onward depend on the questions tracked in [`../README.md`](../README.md) and [`../decisions.md`](../decisions.md) pending-decisions table.
