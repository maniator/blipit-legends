> This section covers Trades (v3), playoffs/bracket (v3), awards/archive (v4), multi-team manager mode (v4), and save-export bundle format. Part 4 of 6.

## Trades (v3)

- Module: `src/features/league/trades/`
- Two sources: Manual (user→AI partner, multi-asset, salary-free) and AI↔AI (background, no user veto, decision #16)
- API shape: `proposeTrade({ seasonId, fromSeasonTeamId, toSeasonTeamId, sendingPlayerIds, receivingPlayerIds }) → TradeOutcome`; `evaluateTradeForAI({ seasonId, seasonTeamId, partnerSeasonTeamId, candidate }) → AcceptedTrade | null`
- Evaluation heuristic deterministic from season seed: (1) compute need+surplus vectors from `seasonTeams` standings + `seasonPlayerState` averages; (2) score = need-fill minus surplus-loss for both sides; (3) AI accepts if both scores positive AND aggressiveness threshold met
- Aggressiveness settings: Passive ~0–1 trades/team/season (high threshold); Moderate ~2–3 (medium, default); Active ~4–6 (low)
- Trade execution atomic multi-doc write: update `seasonPlayerState.seasonTeamId`; update `seasonTeams.rosterSnapshot` both sides; append `seasonTransactions` row kind=`'trade'`; rollback via RxDB doc version checks on any write failure
- Trade deadline (decision #14): default 70% of season game days; configurable 50%–100% slider or "No deadline" checkbox; stored as `seasons.tradeDeadlineGameDay`; past deadline → UI read-only, AI skips, API throws `TradeDeadlinePassedError`
- Roster-edit lock interaction: trades write to `seasonTeams.rosterSnapshot` + `seasonPlayerState` ONLY; `customTeams` doc NOT modified; trades are season-scoped; v4 may optionally apply trade results back to `customTeams` at season-completion
- AI↔AI trades complete silently, appear in transactions feed, no user veto (intentional — realism + low friction)
- Tests: unit (evaluation determinism across aggressiveness, deadline enforcement, rollback on partial failure); integration (Standard-preset season ~2–3 trades/team average across 100 simulated runs)

## Playoffs (v3)

- Decision #17: 4 teams per league qualify (top 4 by record, head-to-head tiebreaker per #18); WC bo3 / LCS bo5 / BCS bo7 default; presets "Short" (1/3/5) and "Long" (5/7/7)
- Single-league bracket: WC #1v#4 + #2v#3 → LCS (WC winners) → BCS (LCS winners); multi-league: each league runs through LCS independently → LCS winners meet in World Series (uses BCS series length)
- Reseeding after each round: highest seed plays lowest remaining by regular-season record
- Tiebreaker chain (decision #18): (1) head-to-head record; (2) intra-division record (v2+ only); (3) run diff vs tied group; (4) full-season run diff; (5) coin flip via `mulberry32(parseInt(fnv1a(\`${masterSeed}:tiebreak:${sortedTiedIds}\`), 16) >>> 0)`; three-way+ resolves highest-seed-first then recurses; v1 only needs steps 1, 4, 5
- Playoff injury rules (decision #19): pitcher fatigue full strength (same recovery curve); injury rate ×0.5 vs regular season (0.0075 vs 0.015 per active-lineup player-game); position-player wear unchanged; `playoffMode: boolean` on `seasons` doc flips multiplier (additive optional field, identity migration, `false` default)
- Bracket UI (decision #25): two separate components under shared `<PlayoffBracket>` container — rejected single-component CSS-only switching (different DOM, a11y, test surface); `<PlayoffBracketAccordion>` (mobile: vertical native `<details>` accordion, selected via `${mq.mobile}`); `<PlayoffBracketTree>` (tablet+desktop: horizontal tree 3-wide single-league / 4-wide two-league+WS, selected via `${mq.notMobile}`); never raw `@media` strings; never non-existent `mq.notDesktop`
- Inside series-game expansion: reuses `LineScore` and `HitLog` from gameplay package — only net-new visual is bracket structure
- Routes: `/leagues/:seasonId/playoffs`; `/leagues/:seasonId/playoffs/:seriesId`
- Determinism: all playoff randomness via per-game `deriveScheduledGameSeed`; bracket regenerated from standings + season master seed
- Tests: unit (tiebreaker correctness, reseeding pairings); integration (deterministic 16-team Standard → identical bracket across runs at same seed); E2E (mobile accordion + desktop tree, series advancement); visual snapshot (bracket at all-rounds-complete on both viewports)

## Awards (v4)

- Decisions #20–22; computed once per league at season completion
- Award catalog (per league): MVP, Cy Young, Reliever of the Year, Rookie of the Year, Manager of the Year
- MVP eligibility: position players ≥60% team games or ≥3.1 PA×team games; pitchers: Cy-Young-track eligibility; unified composite — position track: `0.40×OPS-proxy + 0.20×runs-created + 0.15×defensive + 0.15×games-played + 0.10×team-W-L`; pitcher track: `0.40×ERA-proxy⁻¹ + 0.20×K-proxy + 0.20×IP-proxy + 0.20×team-W-L`; both scored against same league population (dominant pitcher can outrank position player); pinned to `rulesetVersion`
- Cy Young: `0.40×ERA-proxy⁻¹ + 0.25×WHIP-proxy⁻¹ + 0.15×innings + 0.10×K + 0.10×team-W-L`
- Reliever of Year: ≥25 appearances AND <2.0 IP/appearance AND <5 starts; `0.45×ERA-proxy⁻¹ + 0.25×appearances + 0.20×strand-rate + 0.10×team-W-L`; fallback if strand-rate not tracked: `0.55×ERA-proxy⁻¹ + 0.30×appearances + 0.15×team-W-L`
- Rookie: no prior season >130 AB (position) or >50 IP (pitcher); current-season floor same; v4-minors path: promoted players also eligible
- Manager of Year: `overperformance = actualWins − expectedWins`; `expectedWins = (0.500 + (sigmoid(teamTalentZ − leagueMeanTalent) − 0.5) × k) × seasonGames`; k=0.50 (tunable in constants module); snapshotted per-team to `seasonTeams.expectedWins` at season creation (NOT on `seasons`); tie-broken by lex `seasonTeamId` ascending
- Formula transparency (decision #21): stored as `seasons.awards[i].formula = { components: [{ label, value, weight }], total, rank }`; render winner stat line (via `CareerStatsSummaryPanel`) first, then expandable "Show formula" breakdown; proxy stats footnoted
- Awards screen route `/leagues/:seasonId/awards`: cards with winner + top-3; reuses `CareerStatsSummaryPanel`, `CareerStatsBattingTable`, `CareerStatsPitchingTable`; zero net-new table components
- Leaders screen route `/leagues/:seasonId/leaders`: pure reuse — `CareerStatsBattingTable` + `CareerStatsPitchingTable` with season-scoped data; zero net-new components
- Determinism: pure functions of `seasonPlayerState.seasonStats` + `seasonTeams` totals
- Tests: unit (edge cases zero IP/PA, tie-breaking determinism by `playerId`/`seasonTeamId` ascending); integration (complete Standard season → non-empty award doc for every catalog entry)

## Optional Minor Leagues (v4)

- Decision #20; off by default; toggleable in setup wizard Advanced panel
- Each `customTeams` doc gains `minorLeaguePlayerIds: string[]` of ~10 generated players
- Auto-promotion on injury only when bench depleted; manual promote/demote on team page
- Doc count: ~160 docs per Standard season, ~240 for Full preset — acceptable when enabled; off by default to keep v4 baseline lean
- Minors call-ups bypass bench-fill step in v2 injury flow; no new schema beyond `customTeams.minorLeaguePlayerIds`

## Offseason Carryover (v4)

- Decision #3; off by default; toggleable on "Start New Season" wizard
- When enabled: `seasonTeams.rosterSnapshot[]` written back to `customTeams` docs (only if team unlocked / not in active league); pitcher fatigue + wear reset to 0; all IL entries cleared; league membership preserved
- When disabled: `customTeams` docs unaffected; league membership cleared
- ONLY path propagating in-season trade/IL changes back to persistent `customTeams`; trades during season write to `seasonTeams.rosterSnapshot` only
- Lock interaction: carryover writes after season transitions to `complete` (lock released); no window where carryover writes to locked doc; order: (1) mark season `complete`, (2) apply carryover writeback, (3) begin new season wizard

## Season Archival (v4, gated)

- Decision #22; do NOT pre-build — only if measured doc count exceeds budget (instrument at v4 ship; threshold ~50k docs for 5+ Full-preset seasons)
- On "Start New Season": collect previous `seasonGames` + `seasonTransactions` + `seasonPlayerState`; `canonicalJSON(archivedData)` → gzip → base64 for `compressed`; `checksum = fnv1a(canonicalJSON(archivedData))`; write `seasonArchives` doc `{ compressed, checksum, archivedAt }`; delete source docs
- `seasons` doc NOT archived (awards queryable at all times via `seasons.awards[]`)
- Integrity on read: decompress → recompute `fnv1a(canonicalJSON(parsed))` → compare checksum; mismatch → non-fatal inline error panel "Season history appears corrupted — historical detail unavailable"; corrupted doc NEVER auto-deleted; "Export raw archive" affordance preserved
- Lazy-open contract: `seasonArchives` NOT in steady-state `OPEN_COLLECTIONS`; refcounted handle via `acquireSeasonArchives()` / `releaseSeasonArchives()` at `src/features/league/storage/seasonArchivesStore.ts`; schema config in `schemaV1.ts`; always uses `getDb()` singleton — never a separate `RxDatabase` (process-global `OPEN_COLLECTIONS` Set); idempotent at refcount-zero
- StrictMode safety: refcount survives dev-mode double-mount; wipe-and-recreate (DB6/DM4) must reset refcount/handle without calling `close()` on dead collection
- Loading state while `acquireSeasonArchives()` cold-start in flight: render `LoadingState` "Loading season history…"; MUST NOT render partial/empty list before acquisition resolves
- IA entry: "View Season History" on seasons-list row for `status === 'complete'`; empty state §12.2 EmptyState "No archived seasons yet. Complete a season to see its history here."
- `releaseSeasonArchives()` idempotent at refcount-zero (handles concurrent "user exits" + "last game finishes" double-release)
- Replay bootstrap (v4, behind `featureFlags.allowReplay`): open via shared lazy handle; `derivedSeed[]` from decompressed archive authoritative — NEVER recomputed (algorithm change would silently break replay); also pins `rulesetVersion` from live `seasons` doc; verify checksum before any read; replay does NOT re-write to live collections; release on replay end
- Tests: unit (round-trip preserves all fields, write-error abort, single-byte mutation mismatch non-deletion); integration (archive+recovery identical output, `OPEN_COLLECTIONS.size` returns to steady-state count — exact integer equality, refcount discipline with StrictMode double-mount)

## Multi-Team Manager Mode (v4)

- Resolves UX P1-8 round-2 review; stub — detailed mockups land via Sally before v4 implementation PR opens; Winston CR gate #2
- Setup wizard Step 5: checkbox "Manage every team in this league (advanced)"; off by default (decision #4)
- Stored as `seasons.featureFlags.multiTeamManager: boolean`; snapshotted at season start per decision #26; mid-season toggles are no-ops
- v1–v3: `teamIds: string[]` length 1; v4 lifts to length N without rewriting v1 manager-mode prompt surface (per risks.md #25 mitigation)
- Prompt routing binding contract: (1) within a game → prompts in batting-event order, sim pauses on active prompt only; (2) two user-managed teams on same `gameDay` in different games → simulated sequentially, resolve game 1 before game 2; (3) opposing-managers (user manages both teams in same game) allowed, UI labels which team's decision; (4) no primary-team priority knob in v4 (v4-stretch in agent-prompts/v4.md); (5) Quick Sim → all teams auto-resolve to AI policy, no prompt flood
- UI: prompt panel header gains `<TeamPill>` (reuses `StatusPill` variant `team` — to be added to `style-guide-additions.md`); prompt history shows team name per entry
- Persistence: all-or-nothing (no per-team opt-in in v4); derived list = every `seasonTeamId` in the season's leagues when multi-team enabled
- Determinism: PRNG sequence identical whether single-team or multi-team; mode only controls which decisions surface to UI vs auto-resolve; byte-identical replay guaranteed
- Accessibility: `role="status"` live-region on new team prompt "Now managing: {teamName}."; active team color borders prompt panel (existing team-color tokens, no net-new colors)
- Risk: prompt fatigue at Standard/Full (16–24 teams); mitigation deferred to v4-stretch primary-team toggle
- Out of scope v4: per-team opt-in/out; "auto-resolve all but one" knob; networked multi-user (out of all v1–v4)
- Tests: unit (same gameDay two games → completion-order prompts); integration (Quick Sim byte-identical at same seed); E2E (opposing-managers visual snapshot of team-pill swap)

## Save Export / Import (v1+)

- Locked decision: league state included in SaveStore export bundle from v1; bundle format version bumps 1→2; v2 importers handle both; v1 importers reject v2 with friendly error
- Rationale: silent data loss on import violates repo invariant (save correctness + replay determinism critical)
- v2 collection set: `saves`, `events`, `customTeams`, `seasons`, `seasonTeams`, `seasonGames`, `seasonPlayerState` (all v1); `seasonTransactions` (v2+); `gameHistory` (existing); `seasonArchives` explicitly EXCLUDED (already-compressed, re-inclusion double-packs and breaks checksums)
- v2 envelope shape: `{ version: 2, header: { exportedAt, appVersion, rulesetVersion, collections: { … } }, sig }`; v1's top-level `events` array moves to `header.collections.events`; field names `version` and `sig` preserved for v1 sniff compatibility
- Signature: `fnv1a(RXDB_EXPORT_KEY + canonicalJSON(header))`; v2 uses new `canonicalJSON()` utility (NOT `JSON.stringify` — no key-order guarantee); per-collection arrays sorted by `id` ascending before signing (RxDB query order not stable across exports); utility path: `src/features/saves/storage/canonicalJSON.ts`; v1 verification path UNCHANGED (applying key-sorting to v1 sig would invalidate all existing exported saves)
- Type: discriminated union `type RxdbExportedSave = { version: 1; header: SaveRecord; events: EventRecord[]; sig: string } | { version: 2; header: V2BundleHeader; sig: string }`
- Import scenarios: v1 path + v1 bundle → existing behavior; v1 path + v2 bundle → reject "Update first to import"; v2 path + v1 bundle → accept, league collections empty; v2 path + v2 bundle → verify sig → import; sig mismatch → reject "corrupted"; `rulesetVersion` newer than build → reject "Update the app first"
- ID collision policy: `customTeams` → imported wins (overwrite); `seasons` active collision → reject entire import; `seasons` complete/abandoned collision → suffix id (`{originalId}-imported-{shortToken}`), rewrite ALL references including composite PKs (`seasonPlayerState.id = ${seasonId}:${playerId}`, `seasonTeams.seasonId`, `seasonGames.seasonId`, `seasonTransactions.seasonId`, `seasonArchives.seasonId`); awards in `seasons.awards[]` travel with parent doc, no separate PK rewrite; child collections follow parent seasons policy
- Schema-version compat: importing build ≥ exported version → normal RxDB migration on insert; importing build < exported version → reject
- Service worker: SaveStore lives in main thread; SW remains RxDB-free (no changes required)
- Import order: (1) verify sig+version+rulesetVersion; (2) resolve seasons collisions; (3) import `customTeams` first (not yet in active season, lock permits); (4) import `seasons`; (5) rest in any order
- Partial-write recovery: each step uses `bulkUpsert` (single collection atomic); localStorage tombstone `ballgame:import-in-progress:v1` = `{ id, bundleSig, startedAt, completedSteps: [] }`; written before step 3, deleted after step 5; localStorage chosen over RxDB collection — (a) does not consume `OPEN_COLLECTIONS` slot, (b) readable synchronously before RxDB init; cross-tab: 5-min staleness threshold only guard in v1; no `BroadcastChannel` required; threshold must be re-evaluated if v4 introduces longer imports
- Boot scan: tombstone older than 5 min → persistent banner on Saves page; NOT toast (must not auto-dismiss) or modal (recoverable/deferrable); amber-brown `#7a3200` §12.4 DB-reset pattern; lower z-index than DB-reset banner
- Banner affordances: "Discard partial import" (primary, destructive) → confirm dialog "Discard {N} imported teams?" → deletes exactly `tombstone.importedCustomTeamIds[]` rows + removes tombstone; "Not now" (secondary) → dismisses for session, tombstone persists; NO "keep partial" branch (orphaned customTeams with no parent seasons has no coherent meaning; re-run import is idempotent)
- Accessibility: banner `role="status"`; destructive-confirm verb on button not "OK"/"Yes"; no icon-only states (WCAG 2.2 AA 1.1.1/1.4.1)
- Risks: bundle bloat at Marathon Full preset (mitigate via gzip, reuse `pako`/`CompressionStream`); pre-v2 user re-exports v2 bundle (format-version reject prevents corruption); different `autogen.version` import (decision #A7 replay-warning)
- Out of scope: networked sync; selective import (all-or-nothing v1; FS-1 post-v4); cross-app migration
- Tests: unit (canonical-JSON stable regardless of key+array order, sig rejects single-byte mutation, award validators XOR invariant + formula shape, `seasons.awards[]` byte-stability across insertion orders); integration (mid-season round-trip — `derivedSeed[]`, transactions, standings; v1 bundle in v2 build; interrupted import recovery + tombstone banner + no silent orphans; active-season collision rejection); E2E (export→wipe→import Mini-preset Sprint mid-season on saves UI)
