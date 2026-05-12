---
author: John (bmad-agent-pm)
date: 2026-05-10
plan: Dexie Storage Migration — v3 Dexie Repositories
parent: ../README.md
mode: M1
phase: v3
executionAgent: Amelia (bmad-agent-dev) — SR / RX menu
---

# v3 — Dexie repositories ("Parity off the runtime path")

> 📋 **John (M1 mode):** Cannot start until v2 is merged. Production runtime stays on RxDB.

## Summary

Ship Dexie implementations of every repository defined in v2, prove them interchangeable via the same contract test suites, and add a cross-store integration test for a synthetic 9-inning game. No production module imports the Dexie repositories yet.

## Implementation plan

1. **`DexieSaveRepository`** under `src/features/saves/storage/dexieSaveRepository.ts`. Wrap the v1 `dexieSaveStore` slice with the `SaveRepository` interface; add `subscribeToSaves` using `dexieDb.saves.hook("creating" | "updating" | "deleting", ...)` translated into a callback.
2. **`DexieCustomTeamRepository`** under `src/features/customTeams/storage/dexieCustomTeamRepository.ts`. All multi-table mutations run inside `dexieDb.transaction("rw", [dexieDb.teams, dexieDb.players], async () => { ... })`. On any inner failure the transaction rolls back so neither `teams` nor `players` retains partial writes.
3. **`DexieCareerStatsRepository`** under `src/features/careerStats/storage/dexieCareerStatsRepository.ts`. `recordCompletedGame` runs inside `dexieDb.transaction("rw", [dexieDb.completedGames, dexieDb.batterGameStats, dexieDb.pitcherGameStats], async () => { ... })`. Career-stat queries use the compound `[playerId+createdAt]` and `[teamId+createdAt]` indexes.
4. **Run the contract suites** against the Dexie implementations in CI. Both backends must be green before the PR may merge.
5. **Backend-specific tests** under `src/features/*/storage/__tests__/dexie/` cover Dexie quirks: transaction rollback, async-inside-tx error, error translation (`Dexie.DexieError` → `DuplicateTeamNameError`).
6. **Cross-store integration test** under `src/storage/__integration__/`: scripts a synthetic 9-inning game against the Dexie repositories — create teams, start a save, append every event, complete the game, persist batter and pitcher stats, then assert that querying career stats returns the recorded numbers and that the save's event log replays into the same final state.
7. **CI matrix**: extend the existing test workflow so contract suites run twice — once with RxDB repositories injected, once with Dexie. Routed to `ci-workflow` agent for the workflow change.
8. **No production wiring**: `RepositoriesProvider` continues to default to RxDB. The Dexie path is reachable only from the contract suite injector and the integration test.

## Evidence / citations

- v2 interface definitions: `src/storage/repositories/`.
- v1 Dexie slice to extend: `src/features/saves/storage/dexieSaveStore.ts`.
- Existing transaction-free RxDB patterns to translate into Dexie transactions: `src/features/customTeams/storage/customTeamStore.ts` (team + roster writes) and `src/features/careerStats/storage/gameHistoryStore.ts` (completed-game + per-player stats writes).
- Compound-index queries to match: `src/features/careerStats/storage/gameHistoryStore.ts:128`.
- `RepositoriesProvider` from v2.

## Risk flags

- [x] **PRNG call-order impact** — None. Storage layer stays out of `rng.ts`.
- [x] **Save/replay compatibility** — Closed by Dexie contract tests inheriting from v2 + the integration test asserting end-state parity.
- [x] **RxDB schema migration required?** — No.
- [x] **Visual snapshot regeneration required?** — No.
- [x] **E2E fixture update required?** — No (still off the runtime path).
- [x] **In-app rulebook update required?** — No.
- [x] **`baseball-rules-delta.md` update required?** — No.

Risk register references: R3, R6 (transaction semantics), R11 (duplicate-name detection), R12 (career-stats ordering).

## Validation checklist

```
yarn lint && yarn format:check && yarn typecheck && yarn typecheck:e2e && yarn test:coverage && yarn build && yarn test:e2e
```

Additional v3 gates:

- Contract suites green on both RxDB and Dexie injectors.
- Transaction rollback test green for `DexieCustomTeamRepository.createTeam`.
- Cross-store integration test green.

## Execution agent

**Amelia (`bmad-agent-dev`)** — SR menu (refactor) for repository wiring; RX menu (schema) for any new index added (each new index requires a `DEXIE_SCHEMA_VERSION` bump per D9). CI-matrix workflow change routed to **`ci-workflow`** agent.

## Open questions

- If any Dexie contract test reveals a backend-specific quirk that cannot be hidden behind error translation (e.g., differing semantics for empty `where` clauses), surface it as a new decision before merging. Update [`../decisions.md`](../decisions.md) and [`../risks.md`](../risks.md) in the same PR.
