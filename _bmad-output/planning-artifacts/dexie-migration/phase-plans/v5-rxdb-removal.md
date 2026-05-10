---
author: John (bmad-agent-pm)
date: 2026-05-10
plan: Dexie Storage Migration — v5 RxDB Removal
parent: ../README.md
mode: M1
phase: v5
executionAgent: Amelia (bmad-agent-dev) — SR menu; CR APPROVE required from Winston
---

# v5 — RxDB removal ("Burn the bridge")

> 📋 **John (M1 mode):** Final phase. Cannot start until v4 has shipped at least the number of stable releases agreed in D-pending-4 with no rollback events triggering the kill switch. **Winston (`bmad-agent-architect`) CR APPROVE required**, recorded in [`../decisions.md`](../decisions.md).

## Summary

Delete the RxDB-specific code paths and dependencies. Remove `rxdb` and `rxjs` from `package.json`, delete the bridge migration runner, the `featureFlags.useDexieStorage` kill switch, the `BETA_SCHEMA_EPOCH` reset machinery, and every `from "rxdb"` / `from "rxjs"` import in `src/`. Update docs to remove RxDB references.

## Implementation plan

1. **Confirm stability window** (D-pending-4). PM records release count in [`../decisions.md`](../decisions.md). Story S5.1 in [`../epics-and-stories.md`](../epics-and-stories.md).
2. **Remove dependencies** from `package.json`: `rxdb`, `rxjs`. Regenerate `yarn.lock`. Bundle-size delta recorded in PR description.
3. **Delete RxDB schema modules**:
   - `src/storage/db.ts`
   - `src/features/saves/storage/schemaV1.ts`
   - `src/features/customTeams/storage/schemaV1.ts`
   - `src/features/careerStats/storage/schemaV1.ts`
   - Any `useLiveRxQuery` utility and RxDB-only helpers.
4. **Delete the bridge runner** under `src/storage/migrations/bridgeRxdbToDexie.ts` and its fixtures (the marker is now permanent for migrated devices). Keep one final-release `indexedDB.deleteDatabase("ballgame")` cleanup call gated behind a one-shot marker, removed in a follow-up PR after the next stable release.
5. **Delete the `featureFlags.useDexieStorage` kill switch** and every call site that branched on it.
6. **Delete the `BETA_SCHEMA_EPOCH`** reset machinery (`src/storage/db.ts:32-37` and the `resetIfEpochChanged` helper).
7. **Add a CI grep gate** asserting that `src/` contains no remaining `from "rxdb"` or `from "rxjs"` import. Routed to `ci-workflow` agent.
8. **Update docs** per D-pending-3: either rename `docs/rxdb-persistence.md` to `docs/dexie-persistence.md` (with redirect note in the old path for one release) or rewrite in place. Update `docs/copilot-instructions.md`, `docs/architecture.md`, `docs/project-context.md`, `docs/repo-layout.md`, and `docs/README.md` to remove RxDB references except in historical context.
9. **Update [`../README.md`](../README.md)** status snapshot to "v5 shipped (migration complete)".

## Evidence / citations

- Files slated for deletion: `src/storage/db.ts:1-50,117-125`, `src/features/saves/storage/schemaV1.ts`, `src/features/customTeams/storage/schemaV1.ts`, `src/features/careerStats/storage/schemaV1.ts`.
- Existing `BETA_SCHEMA_EPOCH` reset machinery: `src/storage/db.ts:32-37`.
- Docs that mention RxDB: `docs/copilot-instructions.md` (numerous references), `docs/architecture.md`, `docs/project-context.md`, `docs/repo-layout.md`, `docs/rxdb-persistence.md`, `docs/README.md`.

## Risk flags

- [x] **PRNG call-order impact** — None.
- [x] **Save/replay compatibility** — Already migrated in v4; v5 only removes the bridge. New users go straight to Dexie.
- [x] **RxDB schema migration required?** — No (RxDB is being removed).
- [x] **Visual snapshot regeneration required?** — No.
- [x] **E2E fixture update required?** — Bridge fixtures deleted alongside the runner. Verify Playwright suites still pass without them.
- [x] **In-app rulebook update required?** — No.
- [x] **`baseball-rules-delta.md` update required?** — No.

Risk register references: R10 (bundle-size delta payoff), R14 (late edge case), R18 (doc cross-references).

## Validation checklist

```
yarn lint && yarn format:check && yarn typecheck && yarn typecheck:e2e && yarn test:coverage && yarn build && yarn test:e2e
```

Additional v5 gates (mirrored in [`../cutover-checklist.md`](../cutover-checklist.md)):

- CI grep gate green: no `from "rxdb"` or `from "rxjs"` import in `src/`.
- All tests still pass after RxDB removal.
- Bundle-size delta recorded in PR description.
- All doc cross-references resolve.

## Execution agent

- **Amelia (`bmad-agent-dev`)** — SR menu (safe-refactor) for the deletion sweep and call-site cleanup.
- **`ci-workflow`** — CI grep-gate workflow change.
- **Paige (`bmad-agent-tech-writer`)** — D-pending-3 doc-rename decision and execution if she owns it.
- **Winston (`bmad-agent-architect`)** — CR APPROVE required, recorded in [`../decisions.md`](../decisions.md) D7 sign-off table before merge.

## Open questions

- D-pending-3 (rename or rewrite `docs/rxdb-persistence.md`) must be locked before this PR opens.
- D-pending-4 (concrete number of stable v4 releases before v5 may merge) must be locked before this PR opens.
- Final removal of the one-shot legacy-DB cleanup helper happens in a follow-up PR, not v5 itself, to give devices that skipped a release one more chance to clean up.
