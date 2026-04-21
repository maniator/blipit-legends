# League Mode — Playoffs & Trades

> Companion to [`README.md`](README.md). Both systems ship in **v3**. See [`decisions.md`](decisions.md) #14–#19 and #25.

## Trades

### Sources

| Source      | Trigger                                                    | Notes                                                               |
| ----------- | ---------------------------------------------------------- | ------------------------------------------------------------------- |
| **Manual**  | User opens "Trade Center" from team page, proposes a trade | User → AI partner. Multi-asset. Salary-free.                        |
| **AI ↔ AI** | AI scheduler                                               | Default ~2–3 trades per team per season ("moderate"). No user veto. |

### Trade engine

Pure module: `src/features/league/trades/`.

API (planning shape):

```
proposeTrade({ seasonId, fromSeasonTeamId, toSeasonTeamId, sendingPlayerIds, receivingPlayerIds }) → TradeOutcome
evaluateTradeForAI({ seasonId, seasonTeamId, partnerSeasonTeamId, candidate }) → AcceptedTrade | null
```

Evaluation heuristic (deterministic from season seed):

1. Compute team need vector per position (uses current `seasonTeams` standings + `seasonPlayerState` averages).
2. Compute team surplus vector.
3. Score each candidate trade by need-fill minus surplus-loss for both sides.
4. AI accepts if both sides' scores are positive AND aggressiveness threshold is met.

Aggressiveness setting modulates the acceptance threshold:

| Setting      | Threshold | Approx. trades / team / season |
| ------------ | --------- | ------------------------------ |
| Passive      | High      | ~0–1                           |
| **Moderate** | Medium    | ~2–3                           |
| Active       | Low       | ~4–6                           |

### Trade execution

Atomic write across multiple docs:

1. For each player moved: update `seasonPlayerState.seasonTeamId` to the new team.
2. Update `seasonTeams.rosterSnapshot` on both sides (move players in roster lists).
3. Append a `seasonTransactions` row of kind `'trade'` with full payload.

If any write fails, abort and roll back via RxDB document version checks.

### Trade deadline (decision #14)

- Default = 70% of season's total game days.
- Configurable at setup: slider 50% – 100%, or "No deadline" checkbox.
- Stored as `seasons.tradeDeadlineGameDay`.
- **Contract:** trades are blocked iff `seasons.currentGameDay >= tradeDeadlineGameDay`.
- Past the deadline:
  - Trade Center UI is read-only ("Trade deadline has passed").
  - AI scheduler skips trade generation.
  - Manual trade API throws `TradeDeadlinePassedError`.

### No user veto on AI ↔ AI trades (decision #16)

- AI ↔ AI trades complete silently in the background.
- They appear in the transactions feed.
- The user has **no veto**. This is intentional — realism + low friction.

### Roster-edit lock interaction

Trades are one of the sanctioned **season-controlled mutation paths** for teams in an active league. They write through to `seasonTeams.rosterSnapshot` and `seasonPlayerState` directly. The underlying `customTeams` doc is **not** modified by trades — the customTeams library remains the team's "permanent self" while season state captures in-flight changes.

This means: if the user dissolves the league or completes the season, the team's underlying `customTeams` doc is unchanged from how it looked at season start. (v4 carryover may optionally apply trade results back to `customTeams` at season-completion time; until then, trades are season-scoped only.)

### Testing surface

- **Unit**: trade evaluation deterministic across aggressiveness settings.
- **Unit**: deadline enforcement.
- **Unit**: rollback on partial-write failure.
- **Integration**: a Standard-preset season with "moderate" AI runs ~2–3 trades per team on average across 100 simulated runs.

---

## Playoffs

### Format (decision #17)

- **4 teams per league** qualify (top 4 by record, head-to-head tiebreaker per decision #18).
- Default series lengths: WC bo3 / LCS bo5 / BCS bo7.
- Presets: "Short" (1/3/5), "Long" (5/7/7).

### Bracket structure

For each league:

- WC: #1 vs #4, #2 vs #3.
- LCS: WC winners face off.
- BCS: LCS winners face off.

For multi-league seasons:

- Each league runs its own bracket through LCS.
- LCS winners meet in the **World Series** (uses BCS series length).

### Reseeding

After each round, remaining teams are re-paired by regular-season record (highest seed plays lowest remaining seed). Tiebreakers per decision #18.

### Tiebreakers (decision #18)

In order:

1. Head-to-head record.
2. Run differential.
3. Coin flip via seeded PRNG (deterministic).

### Playoff fatigue & injury rules (decision #19)

- **Pitcher fatigue: full strength.** Same recovery curve, same eligibility-to-start enforcement.
- **Injury rate: ×0.5 of regular season** (0.0075 per active-lineup player-game vs 0.015 in the regular season).
- **Position-player wear: unchanged.**

Implementation: a single `playoffMode: boolean` flag on the `seasons` doc flips the injury multiplier in the roll function. No schema changes for v3 beyond what's already in v2.

### Bracket UI (decision #25)

Two separate components composed by an outer switcher (single-component CSS-only switching is rejected — different DOM structure, different a11y, different test surface):

```
<PlayoffBracket bracket={…}>           // shared container
  <PlayoffBracketAccordion />          // mobile (vertical accordion, native <details>)
  <PlayoffBracketTree />                // tablet+desktop (horizontal tree)
</PlayoffBracket>
```

- **Mobile (vertical accordion)**: each round renders as a collapsible `<details>` row. Tap a round → expand to show series. Tap a series → expand to show games + result. Selected via `${mq.mobile}` (rendered) / `${mq.notMobile}` (hidden).
- **Tablet + Desktop (horizontal tree)**: classic bracket layout, three columns wide for a single league, four for two-league + World Series. Selected via `${mq.notMobile}` (rendered) / `${mq.mobile}` (hidden).

Layout switching uses `mq.mobile` and `mq.notMobile` from `@shared/utils/mediaQueries` — never raw `@media` strings, never the non-existent `mq.notDesktop`.

**Per-game result detail inside the bracket reuses `LineScore` and `HitLog` from the gameplay package** — the bracket is the only net-new visual; everything inside a series-game expansion is existing UI per [`ui-reuse.md`](ui-reuse.md).

### Determinism

All playoff randomness — series outcomes, tiebreaker coin flips, injury rolls — feeds through the per-game derived seed (`deriveScheduledGameSeed`). The bracket is regenerated deterministically from regular-season standings + the season master seed.

### Routing

- `/leagues/:seasonId/playoffs` — bracket overview.
- `/leagues/:seasonId/playoffs/:seriesId` — series detail (per-game results + box scores).

### Testing surface

- **Unit**: tiebreaker correctness across head-to-head, run-differential, and coin-flip cases.
- **Unit**: reseeding produces correct pairings after each round.
- **Integration**: a deterministic 16-team Standard season → bracket generation produces identical results across runs with the same seed.
- **E2E**: bracket UI on mobile (accordion) and desktop (tree); assert series advancement.
- **Visual**: snapshot the bracket at "all rounds complete" state on mobile + desktop.
