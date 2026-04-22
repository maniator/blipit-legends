# RxDB Persistence Layer

> Part of the Ballgame reference docs. See the [docs index](README.md) or [`.github/copilot-instructions.md`](../.github/copilot-instructions.md) (Copilot-specific).

## RxDB Persistence Layer (`src/storage/`)

Local-only IndexedDB persistence via **RxDB v17** (`rxdb@17.0.0-beta.7`). No replication, no sync, no leader election.

### React integration — `rxdb/plugins/react`

**Provider setup** (`src/components/Game/index.tsx`):  
`Game` initializes the database via `getDb()`, then wraps the entire tree with `<RxDatabaseProvider database={db}>`. Until the DB promise resolves the tree renders `null`.

**`useSaveStore` hook** (`src/features/saves/hooks/useSaveStore.ts`):  
Uses `useLiveRxQuery` from `rxdb/plugins/react` to subscribe to the `saves` collection reactively. Exposes stable `useCallback` wrappers for all write operations. Always import from `@feat/saves/hooks/useSaveStore`; **never** call `SaveStore` methods directly in UI components.

`useSaveStore` **requires `<RxDatabaseProvider>`** in the tree. In component tests mock the entire hook:

```ts
vi.mock("@feat/saves/hooks/useSaveStore", () => ({
  useSaveStore: vi.fn(() => ({ saves: [], createSave: vi.fn(), ... })),
}));
```

**Dev-mode plugin** (`src/storage/db.ts`):  
`RxDBDevModePlugin` is registered via a dynamic `import()` inside `initDb`, guarded by `import.meta.env.MODE === "development"`. Dead-code-eliminated in production; never loaded in tests.

### Schema versioning & migration

**Any change to a collection's JSON schema MUST follow this checklist or it will break production for existing users (RxDB DB6 error).**

1. **Bump `version`** in the collection's `RxJsonSchema` (e.g. `version: 1` → `version: 2`).
2. **Add a migration strategy** for the new version in the `migrationStrategies` object passed to `addCollections`. The strategy must be a pure function that accepts an old document and returns a valid new document — it must **never throw**.
3. **Write defensive strategies** — always handle missing or `undefined` fields with a fallback value (`?? default`). Never assume the old document is complete.
4. **Test the upgrade path** — add a unit test that creates a real DB at the old schema version, inserts a legacy document, closes the DB, reopens it with the new code, and asserts all fields survive migration intact. See `src/storage/db.test.ts` `schema migration: v0 → v1` for the pattern.
5. **Never change a schema's `properties` or `required` at the same version** — doing so changes the schema hash and causes RxDB to throw DB6 for every existing user. If the change is purely descriptive (adding `title`/`description` annotations) and `additionalProperties: true` is set, it is still a hash change.

```ts
// ✅ Correct: bump version + safe identity strategy
{ version: 2,
  migrationStrategies: {
    2: (oldDoc) => ({ ...oldDoc, newField: oldDoc.newField ?? "default" }),
  }
}

// ❌ Wrong: schema changed but version unchanged — DB6 for all existing users
{ version: 1, /* properties added/changed */ }
```

**Last-resort fallback** (`getDb()` in `src/storage/db.ts`): if `initDb()` throws with RxError code `DB6` (hash mismatch at same version) or `DM4` (migration strategy execution failed), the entire database is wiped and recreated, and a user-facing reset notice is shown. This fallback exists only as a safety net — it must never be the primary recovery path. Every schema change must have a proper migration strategy so the fallback never fires. Lazy-opened collections (e.g. league-mode's `seasonArchives`, see `docs/league-mode/awards-and-archive.md` §Lazy-open operational contract) MUST reset their in-memory refcount and handle to zero/null on a wipe-and-recreate — **without** calling `close()` on the now-dead collection. The next `acquireXxx()` call will re-`addCollections` against the fresh DB. **Note (current implementation):** today both wipe paths (`resetIfEpochChanged` and the schema-failure recovery in `src/storage/db.ts:60-185`) execute inside the initial `getDb()` resolution before any consumer can call `acquireXxx()`, so the refcount-reset invariant is currently a forward guard with no observable trigger. If a future runtime-reset path is added (e.g. a "reset all data" user action), it MUST invoke registered reset callbacks via an `onDbReset(cb)` registry exported from `src/storage/db.ts` BEFORE clearing `dbPromise`, so lazy helpers can drop their handle and refcount.

### Upgrade checklist

Before bumping the `rxdb` version in `package.json`:

1. Recount collections in `src/storage/db.ts` and any lazy-opened collections (e.g. `seasonArchives` in league mode). Total must be ≤ the new RxDB version's `NON_PREMIUM_COLLECTION_LIMIT` (find via `node_modules/rxdb/dist/esm/plugins/utils/utils-premium.js`).
2. The cap is enforced at runtime in `node_modules/rxdb/dist/esm/rx-collection.js` (`COL23` error) regardless of dev-mode plugin presence; switching storage adapters does NOT bypass it. The cap is also process-wide (a global `OPEN_COLLECTIONS` Set), so a second `RxDatabase` does not help.
3. If the new cap would be exceeded, mitigations (in order of preference): fold collections together, make seldom-used collections lazy-open with `close()` on unmount, only as a last resort consider RxDB Premium (`setPremiumFlag()`).

### Collections

| Collection         | Purpose                                                                                                                                                                                                                                                                                       |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `saves`            | One header doc per save game (`SaveDoc`). Stores setup, progressIdx, stateSnapshot (full game `State` + `rngState`). **Current schema version: 1.**                                                                                                                                           |
| `events`           | Append-only event log (`EventDoc`). One doc per dispatched action, keyed `${saveId}:${idx}`.                                                                                                                                                                                                  |
| `customTeams`      | Custom team docs (`CustomTeamDoc`). Stores full roster (lineup/bench/pitchers) + metadata. **Current schema version: 3** (v0→v1: abbreviation + team fingerprint; v1→v2: per-player fingerprint backfill; v2→v3: `teamSeed`/`playerSeed` backfill with seed-based fingerprint recomputation). |
| `players`          | Global player identity docs (`PlayerDoc`). Keyed by `globalPlayerId`. Stores player metadata independent of team. **Current schema version: 0.**                                                                                                                                              |
| `games`            | Completed game docs (`GameDoc`). Keyed by `gameInstanceId` (idempotent — multiple saves of the same run share one row). **Current schema version: 0.**                                                                                                                                        |
| `playerGameStats`  | Batting stats per player per game (`PlayerGameStatDoc`). Keyed `${gameId}:${teamId}:${playerKey}`. **Current schema version: 0.**                                                                                                                                                             |
| `pitcherGameStats` | Pitching stats per pitcher per game (`PitcherGameStatDoc`). Keyed `${gameId}:${teamId}:${pitcherKey}`. Includes IP, H, BB, K, HR, R, ER, ERA, WHIP, SV, HLD, BS. **Current schema version: 0.**                                                                                               |

### SaveStore API

```ts
SaveStore.createSave(setup: GameSaveSetup, meta?: { name?: string }): Promise<string>
SaveStore.appendEvents(saveId: string, events: GameEvent[]): Promise<void>
SaveStore.updateProgress(saveId: string, progressIdx: number, summary?: ProgressSummary): Promise<void>
SaveStore.deleteSave(saveId: string): Promise<void>
SaveStore.exportRxdbSave(saveId: string): Promise<string>   // FNV-1a signed JSON bundle
SaveStore.importRxdbSave(json: string): Promise<string>     // verifies signature, upserts docs
```

Use `makeSaveStore(getDbFn)` to create an isolated instance for tests.

### CustomTeamStore API

```ts
CustomTeamStore.createCustomTeam(input: CreateCustomTeamInput): Promise<string>
  // Throws if a team with the same name (case-insensitive) already exists.
CustomTeamStore.updateCustomTeam(id: string, patch: UpdateCustomTeamInput): Promise<void>
CustomTeamStore.deleteCustomTeam(id: string): Promise<void>
CustomTeamStore.listCustomTeams(): Promise<CustomTeamDoc[]>
CustomTeamStore.exportPlayer(teamId: string, playerId: string): Promise<string>
  // Returns signed portable JSON bundle (type: "customPlayer", formatVersion: 1)
CustomTeamStore.importCustomTeams(json: string, options?: ImportCustomTeamsOptions): Promise<ImportCustomTeamsResult>
  // options.allowDuplicatePlayers = true → proceed despite duplicate players
```

`ImportCustomTeamsResult` carries `{ created, remapped, skipped, duplicateWarnings, duplicatePlayerWarnings, requiresDuplicateConfirmation }`.

When `requiresDuplicateConfirmation` is `true`, the import was blocked because incoming players match existing player fingerprints. Surface `duplicatePlayerWarnings` to the user, then retry with `{ allowDuplicatePlayers: true }`.

### Player Fingerprints (`fingerprint` on `TeamPlayer`)

Every player carries a persistent `fingerprint?: string` and `playerSeed?: string` stored in the DB. The fingerprint is `fnv1a(playerSeed + JSON.stringify({name, role, batting, pitching}))`, computed by `buildPlayerSig()` in `customTeamExportImport.ts` and written by `sanitizePlayer()` in `customTeamStore.ts`. The `playerSeed` is generated once at creation via `generateSeed()` and never changes. The v1→v2 migration backfills fingerprints; the v2→v3 migration backfills `playerSeed` values and recomputes fingerprints with the seed. The `playerSeed ?? ""` fallback in `buildPlayerSig` ensures legacy bundles without a seed still parse cleanly.

### Team Fingerprints (`fingerprint` on `CustomTeamDoc`)

Teams carry a `fingerprint?: string` and `teamSeed?: string`. The fingerprint is `fnv1a(teamSeed + name|abbreviation)` (both lowercased). Used for team-level duplicate detection on import — the same team re-imported after roster edits still deduplicates correctly (roster changes don't affect the fingerprint). Computed by `buildTeamFingerprint()` in `customTeamExportImport.ts`. The `teamSeed` is generated once at creation and never regenerated (not even on `updateCustomTeam`). The `teamSeed ?? ""` fallback ensures legacy bundles still parse cleanly.

### Export/Import Bundles

**Teams bundle** (`type: "customTeams"`, `formatVersion: 1`):

- Every player row carries an export-only `sig` (FNV-1a over `{name, role, batting, pitching}`) for tamper detection — stripped before DB storage.
- Bundle-level `sig` = `fnv1a(TEAMS_EXPORT_KEY + JSON.stringify(payload))`.

**Player bundle** (`type: "customPlayer"`, `formatVersion: 1`):

- Signed with `PLAYER_EXPORT_KEY`.
- Decoded by `parseExportedCustomPlayer(json)` — throws if tampered.

Import flow in `useImportCustomTeams` hook:

1. File upload or paste JSON triggers `importFn(json)`
2. If `result.requiresDuplicateConfirmation` → surface `duplicatePlayerWarnings`, await user choice
3. User confirms → `importFn(json, { allowDuplicatePlayers: true })`
4. User cancels → clear pending state

### Game Loop Integration

```
dispatch(action)
  ├─→ onDispatchRef.current(action)   ← pushes into actionBufferRef (Game/index.tsx)
  └─→ rawDispatch(action)             ← React state update → pitchKey++

useRxdbGameSync (runs when pitchKey changes, lives in GameInner.tsx)
  ├─→ drain actionBufferRef, filter non-game actions (reset, setTeams, restore_game)
  └─→ SaveStore.appendEvents(saveId, events)

half-inning / gameOver
  └─→ SaveStore.updateProgress(saveId, pitchKey, { stateSnapshot: { state, rngState } })
```
