# League Mode — Awards & Archive

> Companion to [`README.md`](README.md). Awards & archive are **v4 scope**. See [`decisions.md`](decisions.md) #20–#22.

## Awards (v4)

### Award catalog

Per league:

| Award                   | Eligibility                                                                                                                                                                                                                                                          | Composite formula (planning shape — exact weights tunable in a constants module)                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **MVP**                 | Position players: ≥ 60% of team games OR ≥ 3.1 PA × team games. Pitchers: Cy-Young-track eligibility (≥ 1.0 IP × team games for SP, ≥ 25 appearances for RP).                                                                                                        | **Unified value composite** with two tracks summed onto the same 0–1 scale: position-player track = `0.40 × OPS-proxy + 0.20 × runs-created-proxy + 0.15 × defensive value + 0.15 × games played + 0.10 × team W-L bonus`; pitcher track = `0.40 × ERA-proxy⁻¹ + 0.20 × K-proxy + 0.20 × IP-proxy + 0.20 × team W-L bonus`. Both tracks scored against the same league population so a dominant pitcher can outrank a position player. Pinned to `rulesetVersion`. |
| **Cy Young**            | Pitchers                                                                                                                                                                                                                                                             | `0.40 × ERA-proxy (inverted) + 0.25 × WHIP-proxy (inverted) + 0.15 × innings + 0.10 × strikeouts + 0.10 × team W-L bonus`                                                                                                                                                                                                                                                                                                                                          |
| **Rookie of the Year**  | "Rookie" = no prior completed season in which the player exceeded **130 AB** (position players) or **50 IP** (pitchers); current-season floor 130 AB / 50 IP also applies. v4-minors path: a player promoted from minors during this season is also rookie-eligible. | Same composite as MVP/CY scaled to the rookie pool.                                                                                                                                                                                                                                                                                                                                                                                                                |
| **Manager of the Year** | All teams                                                                                                                                                                                                                                                            | `team-overperformance vs preseason expected wins`                                                                                                                                                                                                                                                                                                                                                                                                                  |

Awards are computed once per league at season completion.

### Composite formula transparency (decision #21)

Each award doc stores its full formula breakdown:

```
seasonAwards.formula = {
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
- **Unit**: tie-breaking in leader tables is deterministic (by playerId fallback).
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
  - Write a single `seasonArchives` doc keyed by `seasonId`.
  - Delete the source docs.
  - `seasons` and `seasonAwards` are **NOT** archived — they remain queryable for the seasons-list UI and history screens.

### Recovery / read path

A "View Season History" feature on a completed season checks for the source docs first; if missing, decompresses from `seasonArchives` and reconstructs in-memory for display only (not re-written to RxDB).

### Trigger criteria

When v4 ships, instrument doc counts in dev tools. If a typical user with 5+ completed Full-preset seasons exceeds, say, 50,000 docs, archive automatically. Otherwise, leave it disabled.

### Testing surface

- **Unit**: archive round-trip preserves all fields.
- **Unit**: archive failure aborts cleanly (no partial deletion).
- **Integration**: archive + recovery produces identical history-screen output.

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
