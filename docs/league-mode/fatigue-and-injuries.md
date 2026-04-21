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

- **Starting pitcher** (winning + losing): `pitcherDaysRest = 0`, `pitcherStartsThisSeason++`, `pitcherAvailability` recalculated using a recovery curve (see below).
- **All other pitchers** on both teams: `pitcherDaysRest++`, `pitcherAvailability` ticks toward 1 along the recovery curve.

Recovery curve (defaults; tunable in a single constants module):

| Days rest | Availability after |
| --------- | ------------------ |
| 0         | 0.20               |
| 1         | 0.45               |
| 2         | 0.70               |
| 3         | 0.85               |
| 4         | 0.95               |
| 5+        | 1.00               |

These values are **trusted defaults** per decision #11. We do not route them through `@baseball-manager` for tuning before v1 ships; we revisit after v1 is in users' hands.

### UI: pill badge

States derived from `pitcherAvailability`:

| Availability | Badge    | Color  |
| ------------ | -------- | ------ |
| ≥ 0.85       | 🟢 Fresh | green  |
| 0.50 – 0.84  | 🟡 Tired | yellow |
| < 0.50       | 🔴 Spent | red    |

Implemented as a single shared `<StatusPill variant="fresh|tired|spent|il">` component extracted from existing pill styling in `ManagerModeControls/styles.ts`. Lives at `src/shared/components/StatusPill/` and is reused in v2 for the IL badge (`🚑 IL`) — see [`ui-reuse.md`](ui-reuse.md).

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

A pitcher with `pitcherAvailability < 0.30` (i.e., "Spent") cannot be selected as the next game's starter:

- AI rotation logic skips them and rolls forward to the next available SP.
- Manager-mode UI grays out the option with a tooltip "Resting today".

This is the v1 user-visible consequence of fatigue — the rotation actually rotates.

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

Per game, per player on the active lineup:

- Roll a uniform[0,1) from the seeded PRNG.
- If `< 0.004` (regular season; `< 0.001` in playoffs per decision #19), the player is injured.
- Sample injury kind + duration from a distribution table (e.g., 60% short-term 1–3 games, 30% medium 4–10 games, 10% long-term 11–30 games).
- Write `injuryStatus = { kind, ilUntilGameDay: currentGameDay + duration }` to `seasonPlayerState`.
- Write a `seasonTransactions` row of kind `'il_in'`.

Effect: `seasonModifiers.injuryFilter` excludes injured players from lineup-eligibility for the duration. AI auto-fills with bench players; manager-mode prompts the user.

### Recovery

Each game tick, any player with `injuryStatus.ilUntilGameDay <= currentGameDay` is cleared (`injuryStatus = null`) and a `seasonTransactions` row of kind `'il_out'` is written.

### UI

- **Injury report** screen (`/leagues/:seasonId/injuries`) lists all currently-IL players across the league.
- **Transactions feed** (`/leagues/:seasonId/transactions`) lists every IL move chronologically.
- Pitcher fatigue badge sits alongside an "🚑 IL (returns day N)" badge when injured.

### AI rest behavior (decision #12)

Threshold-based:

- Rest a position player when `wear ≥ 8`.
- Rest a pitcher when `pitcherAvailability < 0.85`.
- Otherwise, play the best available lineup.

This keeps lineups recognizable (the best player plays most days) while honoring fatigue (stars do get scheduled rest).

### League-play roster minimums (decision #13)

v2 raises the minimum roster requirements for league play:

- Bench ≥ 5 (was 3).
- Pitchers ≥ 6 (was 5; minimum 5 SP + 1 RP).

The setup wizard validates and offers to "auto-fill missing slots from autogen" for hand-picked teams below this minimum, **without** mutating the user's persistent `customTeams` doc — only the season snapshot is augmented.

---

## v3 — Playoff fatigue & injury rules

Per decision #19:

- **Pitcher fatigue: full strength.** Rotation management matters more in playoffs, not less.
- **Injury rate: ×0.25 of regular season** (0.001 vs 0.004). "Big games, fewer freak injuries" — protective by design.
- **Position-player wear: unchanged.** Stars play through fatigue.

Implementation: a single `playoffMode: boolean` flag on `seasons` flips the multipliers in the injury-roll function. No schema changes, no new modifier fields.

---

## Determinism notes

- All injury rolls use the per-game derived seed (`seasonGames.derivedSeed`) → same seed = same injuries.
- Recovery curves and wear formulas are pure functions of `seasonPlayerState` → fully reproducible.
- `seasonModifiers` injection is a typed structural pass-through; the gameplay context never reads from RxDB directly.

## Testing surface

- **Unit (v1)**: pitcher availability recovery curve; "Spent" pitchers blocked from starting.
- **Unit (v2)**: injury distribution sampler; IL clear-on-recovery; wear floor/ceiling.
- **Unit (v3)**: playoff multipliers applied iff `playoffMode === true`.
- **Integration**: a 30-game Mini Sprint season produces a believable distribution of starts per pitcher (no SP starts more than ⌈30 / SP_count⌉).
- **E2E**: same masterSeed produces identical injury timelines and identical pitcher-rotation choices across runs.
