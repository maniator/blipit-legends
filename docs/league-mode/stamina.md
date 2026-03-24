# League Mode — Stamina & Fatigue

> See [README.md](README.md) for decisions log and [implementation-plan.md](implementation-plan.md) for the phase plan.

---

## What the Fatigue System Does Today

The fatigue model (shipped in PR #206, merged to `master` before any league work begins) tracks workload **within a single game only**. There is no cross-game carry-over — every game starts fully fresh.

### Pitcher fatigue (within-game)

- **Primary signal:** pitch count (`pitcherPitchCount`) — pitches thrown since the current pitcher entered
- **Secondary signal:** batters faced (`pitcherBattersFaced`) — accumulates extra load for pitchers who walk batters or grind through long counts
- **Model:** `computeFatigueFactor(pitchCount, battersFaced, staminaMod)` → multiplier ≥ 1.0, capped at 1.6
- **`staminaMod` effect:** higher stamina raises the "fresh threshold" — a high-stamina SP stays effective deeper into a game; a low-stamina pitcher degrades earlier
  - Default fresh threshold: 75 pitches ± `staminaMod × 1.5` (e.g. +20 stamina → 105-pitch threshold; −20 → 45 pitches)
- **Resets:** to zero whenever a new pitcher enters (`pitcherPitchCount` and `pitcherBattersFaced` reset on substitution)

### Batter fatigue (within-game)

- **Signal:** completed plate appearances (`batterPlateAppearances`) — a `Record<playerId, number>` per team, incremented each time a batter completes a PA
- **Model:** `computeBatterFatigueFactor(plateAppearances, staminaMod)` → contact penalty + power penalty (v1: modest and bounded; contact max −10, power max −6)
- **`staminaMod` effect:** higher stamina delays onset — a high-stamina batter stays sharp through more PAs; a low-stamina batter degrades after fewer
  - Default fresh threshold: 3 PAs ± `staminaMod / 10` (e.g. +20 stamina → 5 PA threshold; −20 → 1 PA threshold)
- **Resets:** `batterPlateAppearances` initializes to `{}` in `createFreshGameState()` — fully resets between games

---

## v1 League Simplification: No Cross-Game Fatigue

**For the initial league implementation, all fatigue is within-game only.** Each scheduled game starts with fresh pitchers and fresh batters regardless of what happened the day before.

This means:
- A team can start the same pitcher in game 1 and game 2 of a back-to-back series with no stat penalty
- A batter who went 5-for-5 yesterday starts today's game as fresh as one who sat out
- The AI manager in headless sim has no awareness of multi-game workload when choosing pitchers

> **This is an explicit simplification.** It keeps league v1 uncoupled from any new cross-game state tracking and avoids rebalancing concerns. The tradeoff is that pitcher overuse is not discouraged mechanically — only by player choice in Watch/Manage mode.

---

## Why This Matters for League Play

Without cross-game fatigue, a few real-world dynamics are absent in v1:

| Real dynamic | v1 behavior |
|---|---|
| SP needs 4–5 days rest between starts | No penalty for pitching SP on consecutive days |
| Bullpen arms tire over a long series | Relievers reset fully before each game |
| Everyday lineup players feel grind of long series | Batters reset each game |
| Manager rotation strategy (4-man vs. 5-man) | No mechanical incentive to rotate |

In **Watch / Manage mode**, the human manager still sees within-game fatigue displayed on the `SubstitutionPanel` and pinch-hitter decision UI (PA count, contact/power penalties). Cross-game context (e.g. "this pitcher started yesterday") is absent in v1 but can be surfaced in a future phase.

In **headless simulation** (Box Score / Simulate Day), the AI manager uses within-game fatigue as a substitution signal. It has no cross-game memory.

---

## Future Phase: Pitcher Rotation Tracking

A future extension (not part of the initial slice) could add cross-game pitcher workload tracking to discourage overuse and encourage rotation management.

### Proposed design (not yet scheduled)

A `pitcherRestRecord` would be stored on the `ScheduledGameRecord` (or derived from `CompletedGameRecord`) to track each pitcher's most recent start or relief appearance:

```ts
/** Future: per-pitcher workload record written when a game completes. */
interface PitcherWorkloadRecord {
  playerId: string;
  teamId: string;
  leagueSeasonId: string;
  /** Game day of the most recent appearance. */
  lastAppearanceGameDay: number;
  /** Pitches thrown in the most recent appearance. */
  pitchesInLastAppearance: number;
  /** Role of the pitcher in the most recent appearance. */
  role: "SP" | "RP" | "SP/RP";
}
```

At `headlessSim` / `GameSaveSetup` time, this record would be used to inject a `staminaMod` penalty for pitchers who appeared recently:

```ts
/** Suggested: starting pitcher rest penalty applied at game setup time. */
const daysSinceLastStart = currentGameDay - lastAppearanceGameDay;
const shortRestPenalty = daysSinceLastStart <= 1 ? -15   // back-to-back: heavy penalty
                       : daysSinceLastStart <= 2 ? -8    // one day rest: moderate penalty
                       : daysSinceLastStart <= 3 ? -3    // two days rest: minor penalty
                       : 0;                              // 3+ days rest: fully fresh
```

This penalty would lower the pitcher's effective `staminaMod`, raising fatigue onset and degrading performance — mechanically discouraging overuse without hard-blocking it.

### Manager Mode surface

In Watch / Manage mode, a future "Rotation Planner" widget on `SchedulePage` could show:
- Each pitcher's last appearance game day and pitch count
- Days of rest before their next scheduled start
- A color-coded freshness indicator (green = 4+ days rest, yellow = 2–3, red = 0–1)

### AI awareness

The AI manager in headless sim would consult `PitcherWorkloadRecord` when selecting a starting pitcher for the day, preferring rested arms over pitchers who threw recently.

---

## Batter Cross-Game Fatigue (Future / Optional)

Tracking batter fatigue across a multi-game series is lower priority and has weaker real-world precedent as a discrete mechanical effect. The current within-game model (PA accumulation) already captures the "late-game tired hitter" scenario that matters most.

If cross-game batter fatigue is ever added, the natural signal would be:
- **Total PA in last N days** (e.g. sum of PA across a 3-game series)
- Applied as a small negative `staminaMod` offset at game setup time — same mechanism as pitcher short rest
- Only meaningful for everyday players in a packed schedule (e.g. series of 3 consecutive games with no days off)

This is explicitly **not planned** for the initial league slice.

---

## Implementation Notes for Initial Slice

No new code is needed in the initial league implementation to support the v1 (within-game only) behavior:
- `createFreshGameState()` already resets `batterPlateAppearances`, `pitcherPitchCount`, and `pitcherBattersFaced`
- Each `headlessSim` call creates a fresh game state from `GameSaveSetup` — no fatigue state is passed in from a prior game
- The league scheduler does not need to track pitcher workload for the initial slice

The only thing to document clearly in the `SchedulePage` UI is the **within-game** nature of fatigue so users who watch games understand why the stats panel shows a fresh pitcher even for a back-to-back starter.
