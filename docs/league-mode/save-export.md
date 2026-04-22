# League Mode — Save Export / Import Integration

> Companion to [`README.md`](README.md). Resolves RxDB review P0-4: how league state integrates with the existing `SaveStore` export/import bundles. Without this, exporting a save during an active season silently drops league progress and the bundle's signature is partially unverified.

## Locked decision

**League state is included in the SaveStore export bundle** starting in v1. The bundle format version bumps from `1` to `2`; v2 importers handle both. v1 importers reject v2 bundles with a friendly error.

Rationale: a user who exports during an active season expects the season to come along. Silent data loss on import would violate the existing repo invariant ("save data correctness and replay determinism are critical invariants" — `@rxdb-save-integrity` agent contract).

## Bundle format v2 — collection set

| Collection           | Included  | Notes                                                                                                                                  |
| -------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `saves`              | yes       | Existing v1 inclusion; unchanged.                                                                                                      |
| `events`             | yes       | Existing v1 inclusion; unchanged.                                                                                                      |
| `customTeams`        | yes       | Already shared between exhibition + league. Critical because league state references team IDs.                                         |
| `seasons`            | yes       | v1.                                                                                                                                    |
| `seasonTeams`        | yes       | v1.                                                                                                                                    |
| `seasonGames`        | yes       | v1.                                                                                                                                    |
| `seasonPlayerState`  | yes       | v1.                                                                                                                                    |
| `seasonTransactions` | yes (v2+) | Empty array if exported on a v1-build save.                                                                                            |
| `seasonArchives`     | **no**    | Already-compressed redundant data; including it would double-pack and break checksums on re-export. Document as an explicit exclusion. |
| `gameHistory`        | yes       | Existing collection (career stats). Unchanged.                                                                                         |

## Bundle envelope

The v1 `SaveStore` bundle envelope shape is `{ version, header, events, sig }` (see `src/features/saves/storage/types.ts`). v2 **keeps the same top-level field names** so the existing import path can sniff `version` and `sig` consistently across versions; the league payload moves into `header.collections`:

```
{
  "version": 2,                   // bumped from 1; same field name as v1 envelope
  "header": {
    "exportedAt": <epoch ms>,
    "appVersion": "<package.json version>",
    "rulesetVersion": <CURRENT_RULESET_VERSION at export time>,
    "collections": {
      "saves":              [...],
      "events":             [...],
      "customTeams":        [...],
      "seasons":            [...],
      "seasonTeams":        [...],
      "seasonGames":        [...],
      "seasonPlayerState":  [...],
      "seasonTransactions": [...],   // v2+
      "gameHistory":        [...]
    }
  },
  "sig": "<fnv1a hex over RXDB_EXPORT_KEY + canonical-JSON of `header`>"
}
```

- **Field-name alignment with v1.** `version` (not `format`) and `sig` (not `checksum`) match the existing `SaveStore` envelope; v1 importers can still read `version` to decide accept/reject. The v1 envelope's `events` array is preserved at the top level **only on v1 bundles**; in v2 envelopes the equivalent data lives under `header.collections.events`.
- **Signature scope.** The v2 `sig` is computed as `fnv1a(RXDB_EXPORT_KEY + canonicalJSON(header))` (same helper + key as v1; only the serializer changes — v1 used `JSON.stringify`, v2 must use `canonicalJSON()` from `src/features/saves/storage/canonicalJSON.ts` for cross-runtime determinism). Because `header` now contains every league collection, league state is part of the signed payload — partial coverage would leave league data unverified.
- **Canonical JSON.** Keys sorted lex at every level, no whitespace, before signing. **Per-collection arrays inside `header.collections` MUST also be sorted by `id` ascending before signing** (`canonicalJSON` sorts object keys but does not reorder arrays; without an explicit array sort, RxDB returning docs in a different order between exports would produce a non-deterministic `sig` even on byte-identical data). **There is no existing canonicalization helper in `saveStore.ts`** — v1 uses plain `JSON.stringify({ header, events })` (no key sorting, no array sorting). Write a new `canonicalJSON(obj: unknown): string` utility for v2 (suggested path: `src/features/saves/storage/canonicalJSON.ts`). The v1 verification path in `importRxdbSave` must remain unchanged — applying key-sorting to v1 sig verification would invalidate all existing exported saves.
- **`RxdbExportedSave` discriminated union.** The existing `types.ts` has `version: 1` as a literal type. Adding v2 requires converting to a discriminated union: `type RxdbExportedSave = { version: 1; header: SaveRecord; events: EventRecord[]; sig: string } | { version: 2; header: V2BundleHeader; sig: string }`. The v1 branch is unchanged.

## Import behavior

| Scenario                                  | Bundle version | Behavior                                                                                                                           |
| ----------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| v1 import path / v1 bundle                | `1`            | Existing behavior — exhibition saves only.                                                                                         |
| v1 import path / v2 bundle                | `2`            | Reject with: _"This save was created with a newer version of the app. Update first to import."_                                    |
| v2+ import path / v1 bundle               | `1`            | Accept. League collections default to empty.                                                                                       |
| v2+ import path / v2 bundle               | `2`            | Verify `sig` → import every collection. Apply `id` collision policy below.                                                         |
| Signature mismatch                        | any            | Reject with: _"This save file appears corrupted. Try re-exporting from the source."_                                               |
| `rulesetVersion` newer than current build | any            | Reject with: _"This save was created with a newer ruleset. Update the app first."_ (Prevents replaying with mismatched constants.) |

## ID collision policy (per collection)

| Collection                                         | Collision behavior                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `customTeams`                                      | If imported `customTeam` `id` exists, the imported one wins (overwrite). Standard exhibition-save behavior.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `seasons`                                          | If imported `seasons` `id` exists with `status='active'`, **reject the import entirely** with: _"You already have an active season ('{name}'). Finish or abandon it before importing this save."_                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `seasons` (existing complete / abandoned)          | Suffix imported id (`{originalId}-imported-{shortToken}`) and rewrite **every** `seasonId` reference in the same bundle. **This is exhaustive — not just FK columns:** the suffix MUST also rewrite the composite primary key `seasonPlayerState.id` (= `${seasonId}:${playerId}`), plus `seasonTeams.seasonId`, `seasonGames.seasonId`, `seasonTransactions.seasonId`, `seasonArchives.seasonId`. (Awards live inside `seasons.awards[]` and travel with their parent doc — no separate PK rewrite needed.) Forgetting a composite-PK rewrite produces either PK collisions against the user's prior history or docs whose `id` and `seasonId` disagree. Preserves history. |
| `seasonTeams`/`Games`/`PlayerState`/`Transactions` | Always tracked by their parent `seasonId`; collision behavior follows whichever `seasons` policy applied above. (`seasons.awards[]` is part of the parent doc and follows the parent's policy automatically.)                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

The "active season blocks import" rule is the only hard reject; everything else is non-destructive.

## Schema-version compatibility

The bundle's per-collection docs include the schema version they were exported under (RxDB embeds `_meta.lwt` etc.; collection-level `version` is implicit on creation). On import:

1. If the importing build's collection version is **>=** the exported version → run normal RxDB migration on insert.
2. If the importing build is **<** the exported version → reject (the build can't run forward migrations from the future).

This pairs with the `version: 2` envelope check above; `version` blocks gross version mismatch, the per-collection schema check blocks subtle ones.

## Service-worker note

The `SaveStore` export/import lives in the main thread. The service worker remains RxDB-free per the binding contract in `.github/copilot-instructions.md`. No service-worker changes required.

## Sanctioned-write interaction

Import-time writes to `customTeams` happen **before** any `seasons` doc is restored, so no team is "in an active season" yet at write time — the storage-layer lock check naturally permits these writes without needing the sanctioned-write capability. Document the order in the implementation:

1. Verify `sig` + `version` + `rulesetVersion`.
2. Resolve `seasons` collisions (suffix or reject per policy above).
3. Import `customTeams` first.
4. Import `seasons` (now lock could activate for any imported active season).
5. Import the rest in any order — they reference IDs already present.

### Partial-write recovery

RxDB has no cross-collection transactions, so a process crash between steps 3 and 5 can leave imported `customTeams` written but no `seasons` doc referencing them. The contract:

- Each step uses `bulkUpsert` per collection so a single collection's writes are atomic.
- Before step 3, write a tombstone to a **localStorage-backed** key `ballgame:import-in-progress` (schema documented in `data-model.md` §`importInProgress`) containing `{ id, bundleSig, startedAt, completedSteps: [] }`. Update `completedSteps` after each step succeeds. Delete the tombstone after step 5. localStorage is used instead of an RxDB collection so the tombstone (a) does not consume an `OPEN_COLLECTIONS` slot — see the `data-model.md` §RxDB collection-count budget — and (b) is readable synchronously by the boot scan **before** RxDB initialization completes.
- On every app boot, scan localStorage for `ballgame:import-in-progress` older than 5 minutes. If found: surface a "previous import was interrupted" notification and offer the user **"wipe partial import"** — delete the orphaned imported `customTeams` (matched by `id` prefix or by re-derivation from the persisted bundle if available) and the localStorage tombstone. (A "resume" branch is intentionally not part of v1: import bundles arrive via a file picker and aren't persisted across reboots, so resuming would always require the user to re-pick the source file anyway. Keeping the recovery path single-branch — wipe only — avoids a half-implemented resume affordance.) Never silently leave the partially-imported state.
- This is documented as a v1 acceptance criterion (`agent-prompts/v1.md` testing surface) so the work doesn't regress as later phases extend the import path.

## Testing surface

- **Unit:** canonical-JSON helper produces stable byte output regardless of source key order **AND** regardless of source array order within `header.collections` (export the same DB twice with different RxDB query result orders → assert `sig` byte-equal).
- **Unit:** `sig` verification rejects single-byte mutation.
- **Unit:** `validateSeasonAward(entry)` helper enforces the XOR invariant (exactly one of `winnerPlayerId` / `winnerSeasonTeamId` is non-null per `awardKey`), and `validateSeasonAwardFormula(entry)` enforces the documented `formula` shape (`{ components: {…}, total: number, rank: number }`). Both are called at every `seasons` write site that touches `awards[]` — for every entry in the array — since RxDB JSON Schema cannot express XOR or arbitrary object shapes. Tests loop every `awardKey` and assert the correct field is populated.
- **Integration:** export a mid-season league → wipe DB → import → assert `seasonGames.derivedSeed[]`, `seasonTransactions[]`, and standings round-trip identically.
- **Integration:** import a v1 bundle in a v2+ build → league collections empty; existing exhibition save accessible.
- **Integration:** simulate an interrupted import (kill process between `customTeams` step 3 and `seasons` step 4) → reboot → assert the tombstone-recovery flow surfaces a notification AND no orphaned `customTeams` rows are silently left in the DB.
- **Integration:** import a v2 bundle whose `seasons` doc collides with an active in-DB season → import rejected with the documented copy.
- **E2E:** export → wipe → import flow on the saves UI works for a Mini-preset Sprint mid-season.

## Risks

- **Bundle bloat at Marathon Full preset.** ~24 teams × 120 games × pitcher state etc. Bundles for a complete Full preset season could exceed several MB. Mitigation: gzip the entire envelope before download (existing exhibition-save export already pipes through `pako` or `CompressionStream`; reuse). Document the wire size budget when v4 ships.
- **Pre-v2 user re-exports a v2 bundle by mistake.** Format-version reject prevents data corruption.
- **A user imports a save created on a different `autogen.version`.** Replay-warning UI per decision #A7 already covers this.

## Out of scope

- Networked sync / multi-device save merging — local-only per `routing.md`.
- Selective import (pick which seasons to bring in) — all-or-nothing in v1; future post-v4 stretch (see "Future scope" register in [`decisions.md`](decisions.md), FS-1).
- Cross-app migration (e.g., from a future Ballgame v2) — not a v1–v4 concern.
