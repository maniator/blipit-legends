# League Mode — Fatigue & Injuries

> Companion to [`README.md`](README.md). Pitcher fatigue ships in v1; position-player wear and the injury system ship in v2; playoff-mode rules ship in v3. See [`decisions.md`](decisions.md) #6, #9, #10, #11, #12, #19.

## v1 — Pitcher arm fatigue

### Why v1

It's the lightest possible realism slice: just rest-day tracking + one PRNG-modifier hook + a UI badge. It ships in v1 because it's the difference between "a list of games" and "a season that feels like baseball."

### Data model (v1 fields on `seasonPlayerState`)

```
pitcherDaysRest:        number   // 0 = pitched today
pitcherAvailability:    number   // 0..1; 1 = fully fresh
pitcherStartsThisSeason: number  // running counter
```

### State transitions

After every completed `seasonGames`:

- **Starting pitcher** (winning + losing): `pitcherDaysRest = 0`, `pitcherStartsThisSeason++`, `pitcherAvailability` recalculated using the **role-specific** recovery curve (see below).
- **All other pitchers** on both teams: `pitcherDaysRest++`, `pitcherAvailability` ticks toward 1 along the role-specific recovery curve.

`pitchingRole` is read from the team's `customTeams` snapshot (`'SP'` vs `'RP'`; `'SP/RP'` is bucketed as `'SP'` for recovery-curve purposes since SP outings dominate fatigue accrual).

Recovery curves (defaults; tunable in a single constants module). **Per the `@baseball-manager` realism review (v0 docs review, MUST-FIX), starters and relievers use distinct curves to match modern MLB rotation/bullpen behavior:**

**Starting pitchers (SP, ~80–110 pitches per outing):**

| Days rest | Availability after |
| --------- | ------------------ |
| 0         | 0.10               |
| 1         | 0.20               |
| 2         | 0.40               |
| 3         | 0.75               |
| 4         | 1.00               |
| 5+        | 1.00               |

Eligibility threshold: SP cannot start the next game with `pitcherAvailability < 0.70`. This forbids 1-day-rest SP starts and makes 3-day-rest borderline ("Tired" yellow).

**Relief pitchers (RP, ~10–25 pitches per appearance):**

| Days rest | Availability after |
| --------- | ------------------ |
| 0         | 0.40               |
| 1         | 0.80               |
| 2         | 0.95               |
| 3+        | 1.00               |

Eligibility threshold: RP cannot enter a game with `pitcherAvailability < 0.35`. Allows the realistic 3-of-4-days closer pattern.

**Linked v1 roster-minimum decision:** v1 RP minimum is **3** in [`decisions.md`](decisions.md) #13 (lineup 9 + bench 3 + 5 SP + 3 RP = 20 active) so the bullpen is credible alongside the SP-derived recovery curve. v2+ minimums add a 4th RP (5 SP + 4 RP = 9 pitchers, 23 active) per `@baseball-manager` sign-off — once full fatigue + injury systems are live, 8 pitchers cannot survive an extra-inning or short-start game. See decisions.md #13 for the canonical table.

These values are **trusted defaults** per decision #11 with the realism deltas above. Both curves and thresholds are stored in a single `pitcherFatigueConstants.ts` module and pinned to `seasons.rulesetVersion` (see "Ruleset versioning" below) so a post-launch tuning pass does not silently break in-flight saved seasons' replay determinism.

### UI: pill badge

States derived from `pitcherAvailability`:

| Availability | Badge    | Color  |
| ------------ | -------- | ------ |
| ≥ 0.85       | 🟢 Fresh | green  |
| 0.50 – 0.84  | 🟡 Tired | yellow |
| < 0.50       | 🔴 Spent | red    |

Implemented as a single shared `<StatusPill variant="fresh|tired|spent|il">` component extracted from the existing pill styling in `src/features/gameplay/components/GameControls/styles.ts` (`NotifBadge` + `theme.radii.pill`). Lives at `src/shared/components/StatusPill/` and is reused in v2 for the IL badge (`🚑 IL`) — see [`ui-reuse.md`](ui-reuse.md). Pill colors must map to existing semantic tokens in [`docs/style-guide.md`](../style-guide.md); raise a style-guide PR before introducing any new color.

Rendered on:

- Season team page (rotation card).
- Lineup card during a game (visible to user when their team is at bat or pitching).
- Manager-mode prompts (when offering the user a pitching change).

Hover/tap surfaces tooltip: "X days rest · availability Y%".

### Effect on simulation

A pitcher's `pitcherAvailability` becomes a multiplicative modifier on the existing pitch-quality outcome distribution. Maximum effect = ~12% per decision #11 (a "Spent" pitcher's effective stats droop by up to 12%).

The modifier is injected via the `seasonModifiers.pitcher` slot — a typed object on the gameplay-context boundary. The shape of `seasonModifiers` is **frozen in v1**; v2/v3/v4 may only add fields.

```
type SeasonModifiers = {
  pitcher?: { availability: number };           // v1
  hitter?:  { wearPenalty: number };            // v2
  injuryFilter?: (playerId: string) => boolean; // v2
  // ...future
}
```

### Eligibility-to-start enforcement

A pitcher fails the **role-specific** eligibility threshold for next-game selection: SP needs `pitcherAvailability ≥ 0.70` to start; RP needs `pitcherAvailability ≥ 0.35` to enter.

- AI rotation logic skips ineligible pitchers and rolls forward to the next available SP / RP.
- Manager-mode UI grays out the option with a tooltip "Resting today".

This is the v1 user-visible consequence of fatigue — the rotation actually rotates.

### v1 AI rotation/lineup policy (per PM-agent dev-readiness review, blocking before sim PR)

For non-user teams in v1, the AI:

- Cycles through the 5 SPs in their `customTeams.pitchers[]` order, skipping any with `pitcherAvailability < 0.70`. If all SPs are below threshold, picks the highest-availability SP.
- Brings the highest-availability RP (≥ 0.35) into late-inning manager prompts; otherwise no RP change.
- Plays the top 9 lineup as defined in `customTeams.lineup[]`. (Position-player wear-driven rest enters in v2.)

When the user runs **Quick sim** for their own team's game, manager-mode prompts auto-resolve identically to the AI policy above (same rotation/lineup rules; no PRNG calls beyond what the headless sim already makes).

### Determinism

The recovery curve is deterministic. The pitcher availability modifier feeds into existing simulation rolls via the same global PRNG. Same seed → same fatigue arc.

---

## v2 — Position-player wear & injury system

### Wear

Additive `wear: number (0..10)` field on `seasonPlayerState`.

State transitions per game:

- Each starter's `wear += 1`.
- Each bench player's `wear` ticks down by 0.5 on rest days, floored at 0.
- A "rest day" is any day a player is not in the starting lineup.

Effect on simulation: max ~5% penalty per decision #11. Applied via `seasonModifiers.hitter.wearPenalty`.

### Injury rolls

**Rate:**

- **Regular season:** 1.5% per active-lineup player-game (yields ~9 injuries / team / Standard 60-game season; only active lineup rolls — bench and IL players do not).
- **Playoffs:** 0.75% (×0.5 of regular-season rate per decision #19).

Rate constants live in `injuryConstants.ts` and are pinned to `seasons.rulesetVersion`.

**Per-game procedure (deterministic):**

1. Run **after** the box-score simulation completes (so injury rolls do not perturb at-bat outcomes — `@simulation-correctness` review requirement).
2. Iterate players in fixed order: home lineup batting positions 1–9, away lineup batting positions 1–9, home starting pitcher, away starting pitcher, then any home then away RP that appeared in the game (in entrance order). This iteration order is the binding contract for replay.
3. For each player, draw a uniform[0,1) from the seeded PRNG (per-game `derivedSeed`, same PRNG that ran the box score).
4. If `< rulesetVersion.injuryRatePctPerGame` (regular-season) or `× 0.5` (playoff), the player is injured.
5. Sample injury **kind first, then duration** (separate PRNG draws in that fixed order) from the duration distribution table:

| Bucket     | Probability | Duration (games) |
| ---------- | ----------- | ---------------- |
| Short-term | 60%         | 1–3              |
| Medium     | 30%         | 4–10             |
| Long-term  | 10%         | 11–30            |

6. Write `injuryStatus = { kind, ilUntilGameDay: currentGameDay + duration }` to `seasonPlayerState`.
7. Write a `seasonTransactions` row of kind `'il_in'` with deterministic id `il:${seasonPlayerStateId}:${gameDay}:il_in`.

Effect: `seasonModifiers.injuryFilter` excludes injured players from lineup-eligibility for the duration. AI auto-fills with bench players; manager-mode prompts the user.

### Recovery

At the **start of each game-day** (before any games of that day simulate), any player with `injuryStatus.ilUntilGameDay <= currentGameDay` is cleared (`injuryStatus = null`) and a `seasonTransactions` row of kind `'il_out'` is written with deterministic id `il:${seasonPlayerStateId}:${gameDay}:il_out`. Pinning recovery to the start of the day (not the end) is the binding contract for replay.

### UI

- **Injury report** screen (`/leagues/:seasonId/injuries`) lists all currently-IL players across the league.
- **Transactions feed** (`/leagues/:seasonId/transactions`) lists every IL move chronologically.
- Pitcher fatigue badge sits alongside an "🚑 IL (returns day N)" badge when injured.

### AI rest behavior (decision #12)

**Soft probability** (chosen so rest cadences look organic rather than mechanical):

- Position-player rest probability per game: `restProb = clamp((wear - 6) / 4, 0, 1)`. Rolled from the per-game derived seed **after** lineup construction but **before** the box-score sim, in fixed iteration order (lineup positions 1–9 home, then 1–9 away).
- Pitcher rest is the eligibility-threshold rule above (no probability — strict per-role threshold).
- Otherwise, play the best available lineup.

This keeps lineups recognizable (the best player plays most days) while honoring fatigue (stars do get scheduled rest) without creating a guessable cadence.

**Catcher wear multiplier (deferred to v2.1 follow-up):** real catchers play ~110/162 (68%) vs other positions ~140/162 (86%). When v2 ships, accept universal `wear += 1/game` as a known limitation; flag for a v2.1 retune via `@baseball-manager` after a Standard season log is captured.

### League-play roster minimums (decision #13)

**v1 minimum:** lineup 9 + bench 3 + 5 SP + **3 RP** = **20 active**. Three RPs is the floor for a credible bullpen alongside the SP-derived recovery curve — a single RP cannot cover middle relief, setup, and closer roles for a season.

**v2 minimums:**

- Bench ≥ 5.
- Pitchers ≥ 9 (5 SP + 4 RP).

Approved by `@baseball-manager`: once v2's full fatigue + injury systems are live, 8 pitchers cannot survive an extra-inning or short-start game; the 4th RP keeps the bullpen viable across the season.

The setup wizard validates and offers to "auto-fill missing slots from autogen" for hand-picked teams below this minimum, **without** mutating the user's persistent `customTeams` doc — only the season snapshot is augmented.

---

## v3 — Playoff fatigue & injury rules

Per decision #19:

- **Pitcher fatigue: full strength.** Rotation management matters more in playoffs, not less.
- **Injury rate: ×0.5 of regular season** (0.0075 per active-lineup player-game vs 0.015). "Big games, fewer freak injuries but October tempo still matters" — protective by design without making injuries vanish.
- **Position-player wear: unchanged.** Stars play through fatigue.

Implementation: a single `playoffMode: boolean` flag on `seasons` flips the multipliers in the injury-roll function. No schema changes, no new modifier fields.

---

## Determinism notes

- All injury rolls use the per-game derived seed (`seasonGames.derivedSeed`) → same seed = same injuries.
- Recovery curves and wear formulas are pure functions of `seasonPlayerState` → fully reproducible.
- `seasonModifiers` injection is a typed structural pass-through; the gameplay context never reads from RxDB directly.
- Player iteration order for injury rolls and rest rolls is fixed (see "Per-game procedure" above) — this is a binding contract for replay.
- All injury and wear rolls happen **after** the box-score sim completes (and recovery clears at the **start** of each game-day, before sims) — keeps fatigue/injury logic changes from perturbing at-bat outcomes for a given seed.

## Ruleset versioning (`seasons.rulesetVersion`)

All tuning constants for fatigue and injuries — pitcher recovery curves, eligibility thresholds, max fatigue penalty (`12%`), wear formula, wear penalty cap (`5%`), AI rest probability formula, injury rate (`1.5%` regular / `0.375%` playoff), injury duration distribution — are pinned to a single integer constant exported from `src/features/league/ruleset/index.ts`:

```
export const CURRENT_RULESET_VERSION = 1;
```

Every `seasons` doc snapshots `rulesetVersion: number` at create time. On resume:

- If `season.rulesetVersion === CURRENT_RULESET_VERSION` → resume normally.
- Else → the season is locked into the historical ruleset bundled with the version it was created under (the constants module exports a per-version map; reads dispatch on the season's rulesetVersion).

Any source-level change to a tuning constant **must bump `CURRENT_RULESET_VERSION` and add a new historical entry**. CI guard test (`tests/league/rulesetVersionEnforcement.test.ts`) snapshots the canonical constants per version; any diff to the snapshot must be paired with a version bump.

Without this, every release that tweaks a constant silently breaks all in-flight saved seasons' replay determinism.

## Testing surface

- **Unit (v1)**: pitcher availability recovery curve; "Spent" pitchers blocked from starting.
- **Unit (v2)**: injury distribution sampler; IL clear-on-recovery; wear floor/ceiling.
- **Unit (v3)**: playoff multipliers applied iff `playoffMode === true`.
- **Integration**: a 30-game Mini Sprint season produces a believable distribution of starts per pitcher (no SP starts more than ⌈30 / SP_count⌉).
- **E2E**: same masterSeed produces identical injury timelines and identical pitcher-rotation choices across runs.
