# Dexie Storage Migration Plan

## Goal

Move BlipIt Legends from RxDB-on-Dexie to direct Dexie/IndexedDB storage while preserving current gameplay, save, custom-team, import/export, and career-stat behavior.

This migration should remove RxDB-specific operational risks, especially the non-premium collection limit, DB6 schema-hash failures, and the current need for emergency schema-mismatch wipes. Direct Dexie keeps the local IndexedDB model but lets the app define normal versioned table migrations.

## Current state

The app currently uses RxDB with the Dexie storage adapter in `src/storage/db.ts`. Runtime collections are:

- `saves`
- `events`
- `teams`
- `players`
- `completedGames`
- `batterGameStats`
- `pitcherGameStats`

The first Dexie schema should mirror the current indexed query patterns:

```ts
saves: "id, updatedAt"
events: "id, saveId, [saveId+idx]"
teams: "id, updatedAt, nameLowercase"
players: "id, teamId"
completedGames: "id, playedAt, [homeTeamId+playedAt], [awayTeamId+playedAt]"
batterGameStats: "id, gameId, [playerId+createdAt], [teamId+createdAt]"
pitcherGameStats: "id, gameId, [playerId+createdAt], [teamId+createdAt]"
```

## Migration strategy

### Phase 1: Foundation, no runtime behavior change

- Add direct `dexie` and `dexie-react-hooks` dependencies.
- Add `src/storage/dexieDb.ts` with typed table definitions.
- Keep RxDB as the live production storage path.
- Add tests for the Dexie schema foundation using `fake-indexeddb`.

### Phase 2: Repository abstraction

Introduce storage repository interfaces so feature stores stop depending directly on RxDB methods such as `find().exec()`, `findOne().exec()`, `doc.patch()`, `doc.remove()`, `bulkInsert()`, and `bulkUpsert()`.

The first abstraction should cover the operations already used by:

- `SaveStore`
- `CustomTeamStore`
- career stats persistence/query helpers
- team roster hydration helpers
- import/export helpers

Keep the RxDB implementation behind those interfaces until the Dexie implementation reaches parity.

### Phase 3: Dexie repository implementation

Implement Dexie-backed repositories with behavior parity:

- Save creation, max-save eviction, and save deletion with event cleanup.
- Event append ordering, including the existing per-save queue/counter behavior.
- Save export/import, including signature validation and missing-team rejection.
- Team create/update/delete, including rollback if roster writes fail.
- Player CRUD, free-agent sentinel behavior, and team roster hydration.
- Completed game and player game-stat persistence.
- Career-stat query ordering and aggregation inputs.

Use Dexie transactions for multi-table operations that must stay consistent, especially team + roster writes and save + event deletes.

### Phase 4: React live query replacement

Replace `useLiveRxQuery` usage with `useLiveQuery` from `dexie-react-hooks`, while preserving public hook APIs.

Important hooks/pages to audit:

- `useSaveStore`
- `useCustomTeams`
- team-with-roster hooks
- Saves page/modal flows
- Career stats pages if they rely on reactive DB reads

Do not let UI components call Dexie tables directly. Keep table access inside storage hooks/repositories.

### Phase 5: RxDB-to-Dexie data transition

Choose one of two rollout modes before flipping production runtime to Dexie.

#### Preferred if preserving real user data matters

Ship a bridge migration:

1. Open existing RxDB database.
2. Read every RxDB collection into plain records.
3. Write records into the new Dexie database inside grouped transactions.
4. Verify counts and representative IDs.
5. Store a local migration marker such as `ballgame:dexieMigrationComplete`.
6. Switch runtime reads/writes to Dexie.
7. Keep RxDB dependency for exactly one bridge release, then remove it in a follow-up PR.

#### Simpler beta-only option

Bump the storage epoch and intentionally reset local storage, with user-facing guidance to export teams/saves before upgrading. This is technically simpler but should not be used if production users have data that must be preserved automatically.

## Dexie migration rules after cutover

- Any table/index shape change must bump `DEXIE_SCHEMA_VERSION` and add a new `db.version(n).stores(...)` declaration.
- Any persisted document shape change that needs backfill must use `.upgrade(async (tx) => { ... })`.
- Do not rely on TypeScript alone for imported user data. Keep runtime validation/sanitization at import and repository boundaries.
- Prefer additive migrations over destructive migrations.
- For destructive migrations, add a user-facing notice and test the old-version-to-new-version upgrade path.

## Testing checklist

Before RxDB removal:

- `yarn typecheck`
- `yarn lint`
- `yarn test:coverage`
- `yarn build`
- Targeted unit coverage for Dexie schema creation and table indexes.
- Save lifecycle parity tests.
- Event append race/ordering tests.
- Save import/export tests, including missing-team rejection.
- Custom team create/update/delete/import/export tests.
- Player import/export and free-agent tests.
- Career stats persistence/query tests.
- At least one Playwright smoke path for create team → start game → save/load → finish game → career stats visible.

## Commit hygiene

Keep this migration split into small, meaningful commits. Do not combine RxDB removal with unrelated gameplay, league-mode, or UI feature work. If coverage thresholds fail, restore coverage before marking the PR complete and report the passing coverage state in the final PR notes.
