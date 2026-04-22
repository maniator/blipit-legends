# League Mode — Awards & Archive

> Companion to [`README.md`](README.md). Awards & archive are **v4 scope**. See [`decisions.md`](decisions.md) #20–#22.

## Awards (v4)

### Award catalog

Per league:

| Award                    | Eligibility                                                                                                                                                                                                                                                          | Composite formula (planning shape — exact weights tunable in a constants module)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MVP**                  | Position players: ≥ 60% of team games OR ≥ 3.1 PA × team games. Pitchers: Cy-Young-track eligibility (≥ 1.0 IP × team games for SP, ≥ 25 appearances for RP).                                                                                                        | **Unified value composite** with two tracks summed onto the same 0–1 scale: position-player track = `0.40 × OPS-proxy + 0.20 × runs-created-proxy + 0.15 × defensive value + 0.15 × games played + 0.10 × team W-L bonus`; pitcher track = `0.40 × ERA-proxy⁻¹ + 0.20 × K-proxy + 0.20 × IP-proxy + 0.20 × team W-L bonus`. Both tracks scored against the same league population so a dominant pitcher can outrank a position player. Pinned to `rulesetVersion`.                                                                                                                             |
| **Cy Young**             | Pitchers                                                                                                                                                                                                                                                             | `0.40 × ERA-proxy (inverted) + 0.25 × WHIP-proxy (inverted) + 0.15 × innings + 0.10 × strikeouts + 0.10 × team W-L bonus`                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Reliever of the Year** | Relief pitchers: ≥ 25 appearances **and** < 2.0 IP per appearance (to exclude spot-starters). Pitchers who started ≥ 5 games are starter-track and ineligible.                                                                                                       | `0.45 × ERA-proxy⁻¹ + 0.25 × appearances + 0.20 × inherited-runners strand-rate + 0.10 × team W-L bonus`. **If strand-rate is not tracked**, drop the strand-rate term and re-weight to `0.55 × ERA-proxy⁻¹ + 0.30 × appearances + 0.15 × team W-L bonus` (sums to 1.00).                                                                                                                                                                                                                                                                                                                      |
| **Rookie of the Year**   | "Rookie" = no prior completed season in which the player exceeded **130 AB** (position players) or **50 IP** (pitchers); current-season floor 130 AB / 50 IP also applies. v4-minors path: a player promoted from minors during this season is also rookie-eligible. | Same composite as MVP/CY scaled to the rookie pool.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Manager of the Year**  | All teams                                                                                                                                                                                                                                                            | `team-overperformance vs preseason expected wins` — full formula: `overperformance = actualWins − expectedWins`, where `expectedWins = (0.500 + (sigmoid(teamTalentZ − leagueMeanTalent) − 0.5) × k) × seasonGames` with `k = 0.50` (tunable in the awards constants module — a neutral team yields exactly `0.500 × seasonGames`; a maximally-talented team yields up to `0.75 × seasonGames`). Snapshotted per-team to `seasonTeams.expectedWins` at season creation (NOT to `seasons` — the value is per-team). Highest `overperformance` wins; tie-broken by lex `seasonTeamId` ascending. |

Awards are computed once per league at season completion.

### Composite formula transparency (decision #21)

Each award doc stores its full formula breakdown:

```
seasons.awards[i].formula = {
  components: [
    { label: 'OPS-proxy', value: 0.823, weight: 0.40 },
    { label: 'Runs created', value: 81, weight: 0.20 },
    ...
  ],
  total: 0.711,
  rank: 1
}
```

The awards screen renders this breakdown next to each winner's name so users can see why they won. ("OPS-proxy: .823 · Team W-L bonus: +12 → composite 0.711, rank 1 of 156")

**Render order (per `@user-stats-fan` proxy interview):** the winner card surfaces the player's full Baseball-Reference-style stat line **first** (via `CareerStatsSummaryPanel`), then the composite formula breakdown as an expandable "Show formula" disclosure beneath. Composite math is the "show your work," not the headline. The proxy stats (`OPS-proxy`, `ERA-proxy`, etc.) are footnoted with a one-line explanation of what makes them proxies versus the canonical MLB definitions.

### Awards screen

Route: `/leagues/:seasonId/awards`.

Layout:

- Each award rendered as a card.
- Winner photo / name / team / final composite score.
- Expandable "Show formula" section displaying the breakdown table.
- Top-3 finishers shown below the winner.

**UI reuse:** the winner card composes `CareerStatsSummaryPanel`; the top-3 list reuses `CareerStatsBattingTable` / `CareerStatsPitchingTable` filtered to the eligible candidate pool. No bespoke awards table — see [`ui-reuse.md`](ui-reuse.md).

### Leaders screen

Separate route: `/leagues/:seasonId/leaders`.

Standard stat-leader tables: AVG-proxy, HR-proxy, RBI-proxy, ERA-proxy, K-proxy, etc. Sortable, filterable by league.

**UI reuse:** pure reuse — `CareerStatsBattingTable` and `CareerStatsPitchingTable` with season-scoped data. Zero net-new components.

### Determinism

All formulas are pure functions of `seasonPlayerState.seasonStats` and `seasonTeams` totals. Same season state → same awards.

### Testing surface

- **Unit**: each composite formula handles edge cases (zero innings, zero PA, ties).
- **Unit**: tie-breaking in leader tables is deterministic (player awards by `playerId` ascending; MoY by `seasonTeamId` ascending).
- **Integration**: a complete Standard season produces a non-empty award doc for every catalog entry.

---

## Optional minor leagues (v4)

Per decision #20:

- **Off by default.** Toggleable in the setup wizard's Advanced panel ("Enable minor leagues").
- When enabled, each `customTeams` doc gains a `minorLeaguePlayerIds: string[]` of ~10 generated players.
- Call-up / demotion happens via:
  - **Auto on injury**: when a starter is IL'd, the bench fills first; if bench is depleted, an auto-promotion from minors triggers.
  - **Manual**: user can promote / demote on team page.

Doc-count impact: ~10 generated players × 16 teams = 160 docs per Standard season. ~240 for Full preset. Acceptable when enabled but not free — explicitly off by default to keep the v4 baseline lean.

---

## Optional offseason carryover (v4)

Per decision #3:

- **Off by default.** Toggleable on "Start New Season" wizard ("Carry over from previous season").
- When enabled at "Start New Season":
  - All current `seasonTeams.rosterSnapshot[]` are written back to their underlying `customTeams` docs (only if the team was unlocked / no longer in active league at that moment — see lock contract below).
  - Pitcher fatigue and wear reset to 0.
  - All IL entries are cleared (`injuryStatus = null`).
  - League membership is preserved (`activeLeagueIds` stays).
- When disabled: previous season ends, customTeams docs are unaffected, league membership cleared.

Carryover is the ONLY path that propagates in-season trade/IL changes back to the persistent `customTeams` doc. Trades during a season do not write to `customTeams` (they write to `seasonTeams.rosterSnapshot`).

---

## Season archival (v4, gated)

Per decision #22:

- **Only if measured doc count exceeds budget.** Don't pre-build until we have measurements from real users running multiple seasons.
- When triggered, on "Start New Season":
  - Collect the previous season's `seasonGames` + `seasonTransactions` + `seasonPlayerState`.
  - Serialize to JSON, gzip, base64-encode.
  - Compute `checksum = fnv1a(canonicalJSON(archivedData))` (hex string, same `fnv1a` helper from `@storage/hash`; reuse the v2 export `canonicalJSON()` utility from `src/features/saves/storage/canonicalJSON.ts` — plain `JSON.stringify` has no guaranteed key-order stability across runtimes, which would manifest as spurious checksum mismatches indistinguishable from corruption). Then gzip + base64-encode `canonicalJSON(archivedData)` for the `compressed` field.
  - Write a single `seasonArchives` doc keyed by `seasonId` with `{ compressed, checksum, archivedAt }`.
  - Delete the source docs.
  - `seasons` is **NOT** archived (which keeps awards queryable since they live on `seasons.awards[]`).

### Integrity / corruption handling

On every read of a `seasonArchives` doc:

1. Decompress `compressed` (base64 → gzip → raw JSON).
2. Recompute `fnv1a(canonicalJSON(parsed))` over the parsed result.
3. Compare to stored `checksum`.
4. **If mismatch:** surface a non-fatal error _"Season history appears corrupted — historical detail unavailable"_. **Do not delete the doc.** The corrupted archive doc must survive intact so the user can export it for diagnostics.
5. **If match:** parse JSON and return the reconstructed in-memory season data (not re-written to RxDB).

### Lazy-open operational contract (RxDB collection-cap mitigation)

`seasonArchives` is the only league-mode collection that is **not** part of the steady-state `OPEN_COLLECTIONS` set. The contract (mirrored in `data-model.md` §`seasonArchives`) is:

- **Refcounted single-owner handle.** Both archive-UI mount and the "Start New Season" archive-write path acquire `seasonArchives` via a shared helper:
  - `acquireSeasonArchives(): Promise<RxCollection>` — if no in-process handle exists, calls `db.addCollections({ seasonArchives })` (using the existing `getDb()` singleton, never a new `RxDatabase`) and stores the handle. If a handle already exists, increments a refcount and returns the same handle. Idempotent: safe under React StrictMode dev-mode double-mount and against concurrent acquisitions racing.
  - `releaseSeasonArchives(): Promise<void>` — decrements the refcount. When it drops to zero, calls `collection.close()` (which decrements `OPEN_COLLECTIONS` per `rxdb@17.0.0-beta.7` `rx-collection.js:615`) and clears the handle.
  - **Loading state.** While the first `acquireSeasonArchives()` call is in flight (cold-start `addCollections` against IndexedDB), the archive route renders the standard `LoadingState` from `docs/style-guide.md` §12.5 with copy **"Loading season history…"**. The route MUST NOT render a partial or empty list before the acquisition resolves — a false-empty would be misread as "no history exists."

- **StrictMode + overlap safety.** With the refcount in place, archive-UI mount/unmount cycles and a concurrent "Start New Season" archive write share the same open collection — neither path can `close()` it out from under the other. Closing only fires after the last release.
- **Wipe-and-recreate reset.** If `getDb()` triggers the `DB6`/`DM4` wipe-and-recreate path (`src/storage/db.ts:152-155`), the refcount and handle MUST be reset to zero/null without calling `close()` on the now-dead collection. The next `acquireSeasonArchives()` call will re-`addCollections` against the fresh DB.
- **Never use a separate `RxDatabase`.** Lazy-opening into a second `RxDatabase` instance does NOT bypass the cap (the `OPEN_COLLECTIONS` Set in `rx-collection.js:21` is process-global). The lazy path always uses the existing `getDb()` singleton.
- **Module location.** The helper lives at `src/features/league/storage/seasonArchivesStore.ts` and is the **single source of truth** for the refcount and the archive collection handle. Both the archive-UI route and the replay-bootstrap path import `acquireSeasonArchives` / `releaseSeasonArchives` from this module — they must NOT inline-`addCollections` or maintain their own refcounts. The collection's schema config (`seasonArchivesV1CollectionConfig`) lives next to the other league collection configs in `src/features/league/storage/schemaV1.ts` and is imported by the store. The store's exported handle is typed as `RxCollection<SeasonArchiveRecord>` and is intentionally not a member of `db.ts`'s static `DbCollections` type.

### Corruption handling — UX surface

Mismatch logs a `data-integrity` error and surfaces an **inline non-fatal error panel** (not a toast — the corrupted state is persistent until manual recovery) on the season's history card with the canonical copy **"Season history appears corrupted — historical detail unavailable."** The panel includes a secondary affordance **"Export raw archive"** that downloads the still-preserved (un-deleted) `seasonArchives` doc as JSON for diagnostics — this surfaces the existing "manual recovery path preserved" promise to the user. The corrupted archive doc is NEVER auto-deleted. (Pattern note: the inline non-fatal error panel reuses §12.1 form-error colors at panel scale; the ux-design-lead is adding this as a documented `docs/style-guide.md` pattern in a follow-up.)

**Accessibility:** the inline corruption panel pairs the textual message with any warning glyph (no icon-only states); the "Export raw archive" affordance has an accessible name that includes the action target ("Export raw archive JSON for this season").

### Archived-season replay-bootstrap (v4, behind `featureFlags.allowReplay`)

When the user replays an archived season (decision #23), the source `seasonGames` / `seasonPlayerState` / `seasonTransactions` rows have already been deleted (decision #22 + this doc's archive policy). Replay must bootstrap from `seasonArchives` instead.

The contract:

1. **Open via the shared lazy handle.** Replay-bootstrap calls `acquireSeasonArchives()` (the same refcounted helper the archive UI uses — see §Lazy-open operational contract above). It does NOT call `db.addCollections({ seasonArchives })` directly. If the archive UI is concurrently mounted, both paths share the single open handle; neither can `close()` it while the other is still holding a reference.

2. **`derivedSeed[]` from the decompressed archive is authoritative — never recomputed.** `seasonArchives` stores the season's compressed `seasonGames[]` (per `data-model.md` §`seasonArchives`), which includes each game's pre-computed `derivedSeed`. Replay bootstrap MUST read `derivedSeed` directly from the decompressed payload and pass it to `reinitSeed()` per game. Recomputing via `deriveScheduledGameSeed(seasonId, seasonGameId)` would in theory yield identical seeds today — but if `deriveScheduledGameSeed` ever changes (algorithm tweak, salting, hash family swap) the archive ↔ live derivation would silently diverge and replay would no longer reproduce the original season pitch-for-pitch. This is the same invariant as risk #3 (seeded-determinism) carried into the archived-season case. Replay also reads `rulesetVersion` from the still-live `seasons` doc (which is never archived per decision #22 / risk #17) and pins simulator constants accordingly. Seed determinism + ruleset pin together guarantee pitch-for-pitch reproduction; archived `derivedSeed` alone is necessary but not sufficient.

3. **Decompress + checksum-verify before any read.** The archive's `checksum` field (FNV-1a of `canonicalJSON(archivedData)` pre-gzip) is verified BEFORE replay reads any field. Mismatch surfaces "Season history appears corrupted — replay unavailable." without deleting the archive (manual recovery preserved per decision #22's existing contract).

4. **Release on replay end.** The replay session calls `releaseSeasonArchives()` when the user exits replay or the season's last game finishes. If the archive UI was mounted throughout, the refcount stays >0 and the collection remains open — that's the desired behavior.

5. **Replay does NOT re-write to live collections.** Decision #22's archive contract already specifies the archive is for display/replay only, never re-hydrated into `seasons` / `seasonGames` / etc. Replay reconstructs in-memory game state from the decompressed events and runs the simulator as if live — but every result is discarded. The original archived season's `awards[]`, standings, and stats are immutable history.

### Recovery / read path

A "View Season History" feature on a completed season checks for the source docs first; if missing, decompresses from `seasonArchives` and reconstructs in-memory for display only (not re-written to RxDB).

### Trigger criteria

When v4 ships, instrument doc counts in dev tools. If a typical user with 5+ completed Full-preset seasons exceeds, say, 50,000 docs, archive automatically. Otherwise, leave it disabled.

### IA + empty state + idempotency notes

- **IA entry point.** "View Season History" lives on the seasons-list row for any season with `status === 'complete'`. Tapping it routes to the archive UI for that `seasonId` and triggers `acquireSeasonArchives()` (per §Lazy-open operational contract).
- **First-time empty state.** When the user has no completed seasons yet, the archive route renders the §12.2 `EmptyState` from `docs/style-guide.md` with copy **"No archived seasons yet. Complete a season to see its history here."**
- **Release idempotency.** `releaseSeasonArchives()` MUST be idempotent at refcount-zero: a release call when the refcount is already 0 is a no-op, never a throw. This handles the race where the user navigates away during the last pitch of a replay and both the "user exits" and "last game finishes" paths fire `release` (per §Archived-season replay-bootstrap step 4).

### Testing surface

- **Unit**: archive round-trip preserves all fields.
- **Unit**: archive failure (write error) aborts cleanly (no partial deletion).
- **Unit**: single-byte mutation in `compressed` produces `fnv1a` mismatch → surfaces named error string, doc is NOT deleted.
- **Integration**: archive + recovery produces identical history-screen output.
- **Integration**: after closing the archive UI route, `OPEN_COLLECTIONS.size` returns to the steady-state count (assert exact integer equality — not "less than 16" — so the lazy-open contract regression-tests itself if v4 quietly adds another always-open collection).
- **Integration:** refcount discipline — mount the archive UI route, then trigger a "Start New Season" archive write while the route is still mounted, then unmount the route, then complete the archive write → assert `OPEN_COLLECTIONS.size` returns to the steady-state count exactly once (after the last release), and that no `addCollections` re-throw occurred mid-overlap. Cover React StrictMode dev-mode double-mount in a separate case.

---

## Cross-feature interactions

### Roster-edit lock + carryover

The roster-edit lock (see [`README.md`](README.md) and [`setup-wizard.md`](setup-wizard.md)) keeps `customTeams` docs read-only while a season is `active`. Carryover writes back at the moment the previous season transitions to `complete` (or earlier, on explicit "End Season" action), which by definition releases the lock. Order of operations on "Start New Season" with carryover enabled:

1. Mark previous season `status = 'complete'` (or `'abandoned'`).
2. Apply carryover write-back to `customTeams` docs (lock now released).
3. Begin new season setup wizard with the updated customTeams library.

There is no window where carryover writes to a locked `customTeams` doc.

### Awards + archive

Awards docs survive archival. The awards screen always works regardless of whether the season has been archived.

### Minors + injury system

Minor-league call-ups bypass the bench-fill step in the v2 injury system: only when bench is depleted does the system promote from minors. This is a v4 extension to the v2 injury flow and adds no new schema beyond `customTeams.minorLeaguePlayerIds`.
