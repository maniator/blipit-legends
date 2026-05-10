---
author: John (bmad-agent-pm)
date: 2026-05-10
plan: Dexie Storage Migration — v2 Repository Abstraction
parent: ../README.md
mode: M1
phase: v2
executionAgent: Amelia (bmad-agent-dev) — SR menu; Winston AD sign-off on interface shape
---

# v2 — Repository abstraction ("One interface, two backends")

> 📋 **John (M1 mode):** Lands the storage seam. Cannot start until v1 is merged.

## Summary

Introduce `SaveRepository`, `CustomTeamRepository`, and `CareerStatsRepository` interfaces under `src/storage/repositories/`, refactor existing RxDB-backed stores to implement them, and stand up contract tests so any backend implementation is provably interchangeable. Production runtime stays on RxDB.

## Implementation plan

1. **Author the interfaces** in `src/storage/repositories/`. Method shapes are the locked sketches in [`../README.md`](../README.md) "Locked contracts" — promise-based for one-shots, callback-based for live subscriptions, domain types from `@storage/types` only.
2. **Refactor `SaveStore`** (`src/features/saves/storage/saveStore.ts`) to implement `SaveRepository` — internal RxDB queries unchanged; just publish the repository surface.
3. **Refactor `CustomTeamStore`** (`src/features/customTeams/storage/customTeamStore.ts`) to implement `CustomTeamRepository`.
4. **Refactor career-stats helpers** (`src/features/careerStats/storage/gameHistoryStore.ts`) to implement `CareerStatsRepository`.
5. **Add `RepositoriesProvider`** React context exposing `{ saves, customTeams, careerStats }`. Default wiring returns the RxDB-backed implementations. Mount it once in `src/main.tsx` (or wherever the existing top-level providers compose). Tests inject fakes via the provider's `value`.
6. **Migrate feature call sites** off direct RxDB types one at a time: `useSaveStore` → saves modal/page → `useCustomTeams` → manage-teams flows → career-stats pages. Each call-site migration is its own commit per E2 stories in [`../epics-and-stories.md`](../epics-and-stories.md).
7. **Add the contract test suite** under `src/storage/repositories/__contract__/` exporting `describeRepositoryContract(makeRepo)` per interface. Wire the suite to run against the RxDB implementation today; v3 will reuse it for Dexie.
8. **Translate backend errors** to domain errors at the repository boundary (`SaveNotFoundError`, `DuplicateTeamNameError`, etc.) so callers stop sniffing RxDB internals. New error types live alongside the interface files.

## Evidence / citations

- `SaveStore` API surface to mirror: `src/features/saves/storage/saveStore.ts:1-260`.
- `CustomTeamStore` query patterns and free-agent sentinel behavior: `src/features/customTeams/storage/customTeamStore.ts:54-67,83-86,127-129`.
- Career-stats query patterns: `src/features/careerStats/storage/gameHistoryStore.ts:128`.
- Existing React hooks that will switch to provider injection: `src/features/saves/hooks/useSaveStore.ts`, `src/features/customTeams/hooks/useCustomTeams.ts` (if present), and any `useGameHistory` hooks.
- ID generation contract: `src/storage/generateId.ts:1-27`.

## Risk flags

- [x] **PRNG call-order impact** — None.
- [x] **Save/replay compatibility** — None (no behavior change).
- [x] **RxDB schema migration required?** — No.
- [x] **Visual snapshot regeneration required?** — No.
- [x] **E2E fixture update required?** — No.
- [x] **In-app rulebook update required?** — No.
- [x] **`baseball-rules-delta.md` update required?** — No.

Risk register references: R5 (schema-evolution discipline reinforced by contract tests).

## Validation checklist

```
yarn lint && yarn format:check && yarn typecheck && yarn typecheck:e2e && yarn test:coverage && yarn build && yarn test:e2e
```

Additional gates specific to v2:

- Grep gate: no `from "rxdb"` import remains under `src/features/` (storage-layer files exempt).
- Contract suites pass on RxDB implementations.

## Execution agent

**Amelia (`bmad-agent-dev`)** — SR menu (safe-refactor). **Winston (`bmad-agent-architect`) AD** sign-off requested on the interface shape before story S2.5 begins, since v3 cannot diverge from it.

## Open questions

- None blocking implementation, assuming Winston's AD sign-off on the interface shape lands before S2.5. Any change to interface shape must update [`../decisions.md`](../decisions.md).
