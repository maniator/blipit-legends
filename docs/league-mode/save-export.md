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
| `seasonAwards`       | yes (v4+) | Empty array if exported on a pre-v4 save.                                                                                              |
| `seasonArchives`     | **no**    | Already-compressed redundant data; including it would double-pack and break checksums on re-export. Document as an explicit exclusion. |
| `gameHistory`        | yes       | Existing collection (career stats). Unchanged.                                                                                         |

## Bundle envelope

```
{
  "format": 2,                  // bumped from 1
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
    "seasonAwards":       [...],   // v4+
    "gameHistory":        [...]
  },
  "checksum": "<fnv1a hex of canonical-JSON of `collections` field>"
}
```

- **Checksum scope:** the FNV-1a checksum covers the **entire `collections` field**, not just `saves`+`events` as in v1. This is the contract — any partial coverage leaves league state unverified.
- **Canonical JSON:** keys sorted lex at every level, no whitespace, before hashing. Reuses the same canonicalization helper added in v1 `SaveStore` (extract if currently inlined).

## Import behavior

| Scenario                                  | Bundle format | Behavior                                                                                                                           |
| ----------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| v1 import path / v1 bundle                | `1`           | Existing behavior — exhibition saves only.                                                                                         |
| v1 import path / v2 bundle                | `2`           | Reject with: _"This save was created with a newer version of the app. Update first to import."_                                    |
| v2+ import path / v1 bundle               | `1`           | Accept. League collections default to empty.                                                                                       |
| v2+ import path / v2 bundle               | `2`           | Verify checksum → import every collection. Apply `id` collision policy below.                                                      |
| Checksum mismatch                         | any           | Reject with: _"This save file appears corrupted. Try re-exporting from the source."_                                               |
| `rulesetVersion` newer than current build | any           | Reject with: _"This save was created with a newer ruleset. Update the app first."_ (Prevents replaying with mismatched constants.) |

## ID collision policy (per collection)

| Collection                                                  | Collision behavior                                                                                                                                                                                |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `customTeams`                                               | If imported `customTeam` `id` exists, the imported one wins (overwrite). Standard exhibition-save behavior.                                                                                       |
| `seasons`                                                   | If imported `seasons` `id` exists with `status='active'`, **reject the import entirely** with: _"You already have an active season ('{name}'). Finish or abandon it before importing this save."_ |
| `seasons` (existing complete / abandoned)                   | Suffix imported id (`{originalId}-imported-{shortToken}`) and rewrite all FK references in the same bundle (`seasonTeams.seasonId`, etc.). Preserves history.                                     |
| `seasonTeams`/`Games`/`PlayerState`/`Transactions`/`Awards` | Always tracked by their parent `seasonId`; collision behavior follows whichever `seasons` policy applied above.                                                                                   |

The "active season blocks import" rule is the only hard reject; everything else is non-destructive.

## Schema-version compatibility

The bundle's per-collection docs include the schema version they were exported under (RxDB embeds `_meta.lwt` etc.; collection-level `version` is implicit on creation). On import:

1. If the importing build's collection version is **>=** the exported version → run normal RxDB migration on insert.
2. If the importing build is **<** the exported version → reject (the build can't run forward migrations from the future).

This pairs with the `format: 2` envelope check above; `format` blocks gross version mismatch, the per-collection schema check blocks subtle ones.

## Service-worker note

The `SaveStore` export/import lives in the main thread. The service worker remains RxDB-free per the binding contract in `.github/copilot-instructions.md`. No service-worker changes required.

## Sanctioned-write interaction

Import-time writes to `customTeams` happen **before** any `seasons` doc is restored, so no team is "in an active season" yet at write time — the storage-layer lock check naturally permits these writes without needing the sanctioned-write capability. Document the order in the implementation:

1. Verify checksum + format + ruleset.
2. Resolve `seasons` collisions (suffix or reject per policy above).
3. Import `customTeams` first.
4. Import `seasons` (now lock could activate for any imported active season).
5. Import the rest in any order — they reference IDs already present.

## Testing surface

- **Unit:** canonical-JSON helper produces stable byte output regardless of source key order.
- **Unit:** checksum verification rejects single-byte mutation.
- **Integration:** export a mid-season league → wipe DB → import → assert `seasonGames.derivedSeed[]`, `seasonTransactions[]`, and standings round-trip identically.
- **Integration:** import a v1 bundle in a v2+ build → league collections empty; existing exhibition save accessible.
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
