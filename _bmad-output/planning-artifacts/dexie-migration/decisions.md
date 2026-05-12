---
author: John (bmad-agent-pm)
date: 2026-05-10
plan: Dexie Storage Migration — Locked Decisions
parent: README.md
---

# Dexie Migration — Locked Decisions

> 📋 **John:** Audit trail of decisions taken during the migration. Anything that overrides a locked decision must update this file in the same commit, mark the old entry "superseded by X" with date and rationale, and add a new entry. Mirrors the convention used elsewhere in bmad planning artifacts.

## D1 — Use direct Dexie, not Dexie + a query layer

**Date:** 2026-05-10  
**Status:** Locked.

We pick Dexie alone. Alternatives considered: keep RxDB and pin to a stable release; switch to a wrapper such as `idb` or `idb-keyval`; build a custom IndexedDB layer. Dexie wins because the project already depends on it via the RxDB adapter (`rxdb/plugins/storage-dexie` at `src/storage/db.ts:20`), the API surface we need (typed tables, indexes, transactions, `useLiveQuery`) is small and stable, and direct Dexie removes both the beta-version risk (`rxdb@17.0.0-beta.7` in `package.json:49`) and the schema-hash failure class. No additional query DSL is introduced.

## D2 — Phase the migration in six versions, v0 through v5

**Date:** 2026-05-10  
**Status:** Locked.

See [`roadmap.md`](roadmap.md). The big-bang alternative (single PR that swaps storage and removes RxDB) is rejected because it is unreviewable, hard to roll back, and conflates the runtime flip with the data migration. Phasing keeps each PR scoped, gives parity tests at each boundary, and isolates the high-risk runtime flip (v4) from dependency removal (v5).

## D3 — Repository abstraction is a hard prerequisite for v3+

**Date:** 2026-05-10  
**Status:** Locked.

Feature modules (gameplay, saves, custom teams, career stats) must consume storage via repository interfaces from v2 onward. They must not import RxDB or Dexie symbols directly. The contract tests gating the interfaces are the seam that proves backend interchangeability. See [`phase-plans/v2-repository-abstraction.md`](phase-plans/v2-repository-abstraction.md).

## D4 — Keep the portable save export signature key as `"ballgame:rxdb:v1"`

**Date:** 2026-05-10  
**Status:** Locked.

The portable save export uses `sig = fnv1a("ballgame:rxdb:v1" + JSON.stringify({ header, events }))` (constant `PORTABLE_SAVE_EXPORT_KEY` at `src/features/saves/storage/dexieSaveStore.ts:17`, matching the RxDB store at `src/features/saves/storage/saveStore.ts:184-196`). Even after the storage switches to Dexie, the v1 export envelope **continues to use this key string verbatim**. Renaming would invalidate every previously exported v1 save bundle and break import for users who exported saves before the migration. The string is opaque versioned magic, not a label. A future v2 envelope (out of scope here) is the only place to revisit this.

## D5 — Bridge migration over data reset

**Date:** 2026-05-10  
**Status:** Locked.

For the v4 cutover we ship a one-shot RxDB → Dexie bridge migration, not a "reset local storage and ask users to re-import." The reset path was rejected because production users have saves, custom teams, and career stats that they cannot trivially re-import (career stats in particular are not exported). The bridge implementation, the marker key, and the rollback are specified in [`phase-plans/v4-cutover.md`](phase-plans/v4-cutover.md).

## D6 — Single runtime backend at any moment

**Date:** 2026-05-10  
**Status:** Locked.

After the v4 flip, every read and write goes to Dexie. We do not dual-write to RxDB and Dexie. Dual-write was considered as a "safety net" but rejected because it doubles the surface area of subtle ordering bugs (event idx, updatedAt, transaction boundaries), inflates IndexedDB usage, and offers no real recovery path that the kill switch + retained-RxDB-DB approach does not already give us.

## D7 — Architect CR APPROVE gates v4 and v5

**Date:** 2026-05-10  
**Status:** Locked.

The v4 runtime flip and the v5 RxDB removal both require Winston (`bmad-agent-architect`) CR APPROVE recorded as a comment in this file before the PR may merge. The v0–v3 phases are scoped tightly enough that normal code review suffices, though architect input is welcome.

## D8 — Service worker stays storage-free

**Date:** 2026-05-10  
**Status:** Locked.

The service worker has never touched RxDB and must not touch Dexie either. Storage is window-only. This is reaffirmed because Dexie's `useLiveQuery` works in workers and someone might be tempted to use it. Notification scheduling and message passing in the service worker remain storage-free; any persistent state the worker needs must come from `postMessage` payloads, never IndexedDB reads. (Reaffirms the existing rule in `docs/copilot-instructions.md`.)

## D9 — Dexie schema starts at v1 and follows standard upgrade pattern

**Date:** 2026-05-10  
**Status:** Locked.

`DEXIE_SCHEMA_VERSION = 1` (`src/storage/dexieDb.ts:14`) opens the database as `db.version(1).stores(...)`. Future schema changes append `db.version(2).stores(...)` blocks plus a tested `.upgrade(async tx => { ... })` callback. Same-version schema changes are forbidden — this is the failure class we are leaving RxDB to escape.

## D10 — Dexie database is named `ballgame-dexie`

**Date:** 2026-05-10  
**Status:** Locked.

The Dexie IndexedDB database is `ballgame-dexie` (`DEXIE_DB_NAME` at `src/storage/dexieDb.ts:13`). The legacy RxDB database stays on its existing name (`ballgame`, `src/storage/db.ts`). The two coexist during v4 (bridge migration) and only `ballgame-dexie` survives after v5. Distinct names are required so the bridge migration can read the source DB while writing the destination DB in the same session.

## D11 — Append-queue ordering matches RxDB SaveStore exactly

**Date:** 2026-05-10  
**Status:** Locked.

The Dexie save store preserves the per-save promise queue (`appendQueues`) and per-save next-index counter (`nextIdxMap`) (`src/features/saves/storage/dexieSaveStore.ts:22-23,60-101`) so concurrent `appendEvents` calls produce identical event indexes regardless of backend. This is verified by the parity test "serializes concurrent event appends without index collisions" (`src/features/saves/storage/dexieSaveStore.test.ts:101-123`). Diverging from this would risk replay/determinism issues for any saved game whose event log is consumed during resume.

---

## Pending decisions (must be locked before the listed phase)

| ID          | Decision                                                                                              | Phase that needs it | Owner               |
| ----------- | ----------------------------------------------------------------------------------------------------- | ------------------- | ------------------- |
| D-pending-1 | Telemetry signal format for bridge-migration failures (`appLog` shape and severity)                   | v4                  | John (PM)           |
| D-pending-2 | `featureFlags.useDexieStorage` default value, and whether to expose it dev-menu only or to users      | v4                  | John (PM)           |
| D-pending-3 | At v5, rename `docs/rxdb-persistence.md` to `docs/dexie-persistence.md`, or keep both for one release | v5                  | Paige (Tech Writer) |
| D-pending-4 | Concrete number of stable releases on v4 before v5 may merge                                          | v5                  | Winston (Architect) |

Each pending decision must be promoted above (with a Locked status) before the phase that depends on it can begin.

---

## Architect CR sign-offs

The v4 and v5 PRs each require a Winston CR APPROVE recorded here as a new entry below before merge.

| PR / Phase   | Verdict | Date | Notes |
| ------------ | ------- | ---- | ----- |
| _(none yet)_ | —       | —    | —     |
