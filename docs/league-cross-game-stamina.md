# League Cross-Game Stamina Tracking

**Status:** Planning  
**Dependency:** PR #233 stamina slider (merged ✓)  
**Agent routing:** See [Agent Routing](#agent-routing) section below.

---

## Problem

Players currently start every game fully fresh regardless of how much they exerted in previous
games. In real MLB baseball, fatigue affects both pitchers and hitters:

### Pitcher fatigue

- **Starting pitchers** need 4–5 days of rest after a full outing (100+ pitches / 6+ innings).
- **Relief pitchers** need 1–2 days rest after appearing, scaling with pitches thrown.
- Without cross-game fatigue, a team's bullpen never depletes and lineup decisions carry no
  long-term consequence across a season's game days.

### Batter fatigue

- **Position players** who play multiple games in a row accumulate physical wear:
  - Speed/agility degrades slightly on back-to-back-to-back game days (real-world "dead legs").
  - Batting contact and plate discipline can drop 3–8% after 4+ consecutive game days without rest
    (supported by MLB Statcast fatigue research).
- High-stamina players (Stamina ≥ 80, from PR #233 slider) should degrade more slowly.
- Low-stamina players (Stamina ≤ 40) should show steeper multi-game drop-offs.
- The simulator's per-game stamina decay (PR #233) already handles within-game fatigue; this
  feature extends that to carry residual fatigue into the next scheduled game.

This makes longer league seasons feel connected across game days and adds strategic roster-management
depth: knowing when to rest a lineup core vs. pushing through a series.

---

## Proposed Data Model

### Option A — `playerFatigue` on `LeagueSeasonRecord`

Add an optional map field directly to `LeagueSeasonRecord` covering all player types:

```ts
interface PlayerFatigueEntry {
  lastAppearanceGameDay: number;
  /** For pitchers: innings pitched in most recent outing. */
  inningsPitched?: number;
  /** For pitchers: pitch count in most recent outing. */
  pitchesThrown?: number;
  /** For batters: consecutive game days played without a rest day. */
  consecutiveGameDays?: number;
  /** Residual fatigue carry-over [0–100]: 0 = fresh, 100 = exhausted. */
  residualFatigue: number;
}

// On LeagueSeasonRecord:
playerFatigue?: Record<string /* playerId */, PlayerFatigueEntry>;
```

**Pros:** Simple, co-located with the season. Single update per reconciliation.  
**Cons:** Can grow large for big rosters; bloats the season document on every game-day update.

### Option B — Separate `playerRestRecord` RxDB collection

A new collection `playerRest` with documents keyed by `${leagueSeasonId}:${playerId}`:

```ts
interface PlayerRestRecord {
  id: string; // `${leagueSeasonId}:${playerId}`
  leagueSeasonId: string;
  playerId: string;
  lastAppearanceGameDay: number;
  inningsPitched?: number;
  pitchesThrown?: number;
  consecutiveGameDays?: number;
  residualFatigue: number;
  schemaVersion: number;
}
```

**Pros:** Clean separation; individual records update independently; easy to query per-season.  
**Cons:** Additional collection and schema migration overhead; approaches the 16-collection RxDB limit.

**Recommendation:** Start with Option A (no new collection) until rest tracking is proven useful,
then migrate to Option B if document size becomes a concern. Watch the 16-collection limit
(currently at 10/16; Option B would add 1 more).

---

## Integration Points

| File / Hook                   | Change Required                                                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `scheduledGameStore`          | Read pitcher/batter fatigue data when resolving starting lineup for a scheduled game                                           |
| `simulateGame`                | After game ends, extract per-pitcher inning/pitch counts and per-batter consecutive days from `stateSnapshot`; write to record |
| `deriveScheduledGameSeed`     | No direct change — seed derivation is deterministic and does not depend on fatigue                                             |
| `useLeagueGameReconciliation` | After recording `completedGameId`, trigger a fatigue update for all players on both teams                                      |
| `leagueSeasonStore`           | Add `updatePlayerFatigue(seasonId, fatigueMap)` helper                                                                         |
| PR #233 stamina slider        | Source of per-player `stamina` stat — higher stamina = slower `residualFatigue` accumulation                                   |

---

## Implementation Phases

- [ ] **Phase 1 — Data schema for fatigue tracking**
  - Add `playerFatigue` field to `LeagueSeasonRecord` (Option A)
  - Bump `LeagueSeason` collection schema version and add migration strategy (no-op — new
    optional field, existing rows unaffected)
  - Route: `@rxdb-save-integrity`

- [ ] **Phase 2 — Fatigue update after game (pitchers)**
  - In `useLeagueGameReconciliation`, after recording `completedGameId`, read
    `stateSnapshot.state` to extract innings pitched per pitcher per team
  - Compute `residualFatigue` from pitches thrown vs. stamina rating
  - Write fatigue data back to `LeagueSeasonRecord.playerFatigue`
  - Route: `@simulation-correctness`

- [ ] **Phase 3 — Fatigue update after game (batters)**
  - Track consecutive games played per position player (increment if they appeared in the lineup,
    reset on rest day)
  - Compute batter `residualFatigue` using consecutive-days curve modulated by stamina rating:
    `residualFatigue = clamp(consecutiveGameDays * (100 - stamina) / 10, 0, 40)`
  - Write to `playerFatigue` alongside pitcher data
  - Route: `@simulation-correctness`, `@baseball-manager` for curve validation

- [ ] **Phase 4 — Starter selection respecting pitcher rest**
  - In `simulateGameDay` / `handlePlayGame`, when building `customTeamToPitcherRoster`,
    filter out starters whose `lastAppearanceGameDay` is within the required rest window
  - Fall back to the bullpen or next-available starter
  - Route: `@simulation-correctness`

- [ ] **Phase 5 — Batter stat modifiers from fatigue**
  - When initializing the game state for a league game, apply a small negative modifier to
    contact/speed for batters with `residualFatigue > 20`
  - Modifier magnitude: `-(residualFatigue / 100) * (100 - stamina) * 0.1` (max ~4 stat points)
  - Route: `@simulation-correctness`, `@baseball-manager` for realism check

- [ ] **Phase 6 — Reliever depth tracking**
  - Track relief pitcher availability similarly: 1-day rest after ≤1 inning, 2-day rest after
    ≥2 innings
  - Integrate with `strategy.ts` bullpen usage logic
  - Route: `@simulation-correctness`, `@baseball-manager` for realistic thresholds

- [ ] **Phase 7 — UI indicators on roster / schedule**
  - In `LeagueDetailPage`, show a small fatigue icon or "Day X rest remaining" next to
    unavailable pitchers and fatigued batters in a future roster panel
  - Route: `@ui-visual-snapshot`

---

## Realistic Thresholds

Based on MLB convention (see `docs/agent/baseball-rules-delta.md` for sim deviations):

### Pitcher rest

| Pitcher Type                                | Typical Rest Required | Sim Recommendation |
| ------------------------------------------- | --------------------- | ------------------ |
| Starting pitcher (full outing ≥80 pitches)  | 4–5 days              | 4 game days        |
| Starting pitcher (short outing <80 pitches) | 3 days                | 3 game days        |
| Relief pitcher (≥2 innings)                 | 1–2 days              | 2 game days        |
| Relief pitcher (<1 inning / close)          | 1 day                 | 1 game day         |
| Relief pitcher (scoreless, <15 pitches)     | 0 days                | 0 game days        |

### Batter fatigue

| Consecutive Game Days | Residual Fatigue Impact       | Real-World Analogue                          |
| --------------------- | ----------------------------- | -------------------------------------------- |
| 1–2 days              | None (within normal schedule) | Standard 3-game series                       |
| 3–4 days              | Slight (-1 to -2 stat pts)    | End-of-road-trip fatigue                     |
| 5–6 days              | Moderate (-3 stat pts)        | Marathon road trip; coaches rest key players |
| 7+ days               | Significant (-4 stat pts)     | Rare in real baseball; season grind          |

Stamina stat (0–100 from PR #233) linearly scales fatigue resistance:

- `stamina = 100` → no batter fatigue penalty at any consecutive-game level
- `stamina = 50` → half-strength penalty
- `stamina = 0` → full penalty (extreme case)

**Validation:** After implementing, route a sample 10-game-day log to `@baseball-manager` to
confirm rotation depth, bullpen depletion, and batter degradation feel realistic.

---

## Agent Routing

| Task                                                          | Agent                     |
| ------------------------------------------------------------- | ------------------------- |
| Schema design, RxDB migration, `playerFatigue` field          | `@rxdb-save-integrity`    |
| Game loop changes: fatigue tracking, starter/batter filtering | `@simulation-correctness` |
| Realistic threshold tuning, post-change log review            | `@baseball-manager`       |
| UI fatigue indicators in LeagueDetailPage / roster panel      | `@ui-visual-snapshot`     |
| Planning, risk review, dependency mapping                     | `@pm-agent`               |

---

## Dependencies

- **PR #233 stamina slider** — merged ✓ (provides per-pitch stamina decay within a game; cross-game
  fatigue builds on top of this by propagating end-of-game stamina state to the next appearance)
- `leagueSeasonStore` bulk-update capability (may need a new helper method)
- `ScheduledGameRecord.completedGameId` populated before fatigue is readable — already guaranteed
  by `useLeagueGameReconciliation`
- 16-collection RxDB limit awareness: currently 10/16 — Option B would consume 1 more slot

**Status:** Planning  
**Dependency:** PR #233 stamina slider (merged ✓)  
**Agent routing:** See [Agent Routing](#agent-routing) section below.

---

## Problem

Pitchers currently start every game fully fresh regardless of how many innings they threw in the
previous game. In real MLB baseball:

- **Starting pitchers** need 4–5 days of rest after a full outing (100+ pitches / 6+ innings).
- **Relief pitchers** need 1–2 days rest after appearing, scaling with pitches thrown.
- Without cross-game fatigue, a team's bullpen never depletes and lineup decisions carry no
  long-term consequence across a season's game days.

This makes longer league seasons feel disconnected from real baseball and removes strategic depth
from multi-day scheduling.

---

## Proposed Data Model

### Option A — `pitcherFatigue` on `LeagueSeasonRecord`

Add an optional map field directly to `LeagueSeasonRecord`:

```ts
pitcherFatigue?: Record<
  string, // playerId
  {
    lastAppearanceGameDay: number;
    inningsPitchedLastGame: number;
    pitchesThrown: number; // from most recent outing
  }
>;
```

**Pros:** Simple, co-located with the season.  
**Cons:** Can grow large for big rosters; bloats the season document on every game-day update.

### Option B — Separate `pitcherRestRecord` RxDB collection

A new collection `pitcherRest` with documents keyed by `${leagueSeasonId}:${playerId}`:

```ts
interface PitcherRestRecord {
  id: string; // `${leagueSeasonId}:${playerId}`
  leagueSeasonId: string;
  playerId: string;
  lastAppearanceGameDay: number;
  inningsPitchedLastGame: number;
  pitchesThrown: number;
  schemaVersion: number;
}
```

**Pros:** Clean separation; individual records update independently; easy to query per-season.  
**Cons:** Additional collection and schema migration overhead.

**Recommendation:** Start with Option A (no new collection) until rest tracking is proven useful,
then migrate to Option B if document size becomes a concern.

---

## Integration Points

| File / Hook                   | Change Required                                                                                             |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `scheduledGameStore`          | Read pitcher rest data when resolving starting lineup for a scheduled game                                  |
| `simulateGame`                | After game ends, extract per-pitcher inning/pitch counts from `stateSnapshot` and write back to rest record |
| `deriveScheduledGameSeed`     | No direct change — seed derivation is deterministic and does not depend on fatigue                          |
| `useLeagueGameReconciliation` | After reconciliation writes `completedGameId`, also trigger a fatigue update for both teams' pitchers       |
| `leagueSeasonStore`           | Add `updatePitcherFatigue(seasonId, fatigueMap)` helper                                                     |

---

## Implementation Phases

- [ ] **Phase 1 — Data schema for rest tracking**
  - Add `pitcherFatigue` field to `LeagueSeasonRecord` (Option A)
  - Bump `LeagueSeason` collection schema version and add migration strategy (no-op — new
    optional field, existing rows unaffected)
  - Route: `@rxdb-save-integrity`

- [ ] **Phase 2 — Rest tracking update after game**
  - In `useLeagueGameReconciliation`, after recording `completedGameId`, read
    `stateSnapshot.state` to extract innings pitched per pitcher per team
  - Write fatigue data back to `LeagueSeasonRecord.pitcherFatigue` via
    `leagueSeasonStore.updatePitcherFatigue`
  - Route: `@simulation-correctness`

- [ ] **Phase 3 — Starter selection respecting rest**
  - In `simulateGameDay` / `handlePlayGame` (LeagueDetailPage), when building
    `customTeamToPitcherRoster`, filter out starters whose `lastAppearanceGameDay` is within
    the required rest window (4 days for starters, configurable)
  - Fall back to the bullpen or next-available starter
  - Route: `@simulation-correctness`

- [ ] **Phase 4 — Reliever depth tracking**
  - Track relief pitcher availability similarly: 1-day rest after ≤1 inning, 2-day rest after
    ≥2 innings
  - Integrate with `strategy.ts` bullpen usage logic
  - Route: `@simulation-correctness`, `@baseball-manager` for realistic thresholds

- [ ] **Phase 5 — UI indicators on roster / schedule**
  - In `LeagueDetailPage`, show a small fatigue icon or "Day X rest remaining" next to
    unavailable pitchers in a future roster panel
  - Route: `@ui-visual-snapshot`

---

## Realistic Rest Thresholds

Based on MLB convention (see `docs/agent/baseball-rules-delta.md` for sim deviations):

| Pitcher Type                                | Typical Rest Required | Sim Recommendation |
| ------------------------------------------- | --------------------- | ------------------ |
| Starting pitcher (full outing ≥80 pitches)  | 4–5 days              | 4 game days        |
| Starting pitcher (short outing <80 pitches) | 3 days                | 3 game days        |
| Relief pitcher (≥2 innings)                 | 1–2 days              | 2 game days        |
| Relief pitcher (<1 inning / close)          | 1 day                 | 1 game day         |
| Relief pitcher (scoreless, <15 pitches)     | 0 days                | 0 game days        |

**Validation:** After implementing, route a sample 10-game-day log to `@baseball-manager` to
confirm rotation depth and bullpen depletion feel realistic.

---

## Agent Routing

| Task                                                     | Agent                     |
| -------------------------------------------------------- | ------------------------- |
| Schema design, RxDB migration, `pitcherFatigue` field    | `@rxdb-save-integrity`    |
| Game loop changes: rest tracking, starter filtering      | `@simulation-correctness` |
| Realistic threshold tuning, post-change log review       | `@baseball-manager`       |
| UI fatigue indicators in LeagueDetailPage / roster panel | `@ui-visual-snapshot`     |
| Planning, risk review, dependency mapping                | `@pm-agent`               |

---

## Dependencies

- **PR #233 stamina slider** — merged ✓ (provides per-pitch stamina decay within a game; cross-game
  fatigue builds on top of this by propagating end-of-game stamina state to the next appearance)
- `leagueSeasonStore` bulk-update capability (may need a new helper method)
- `ScheduledGameRecord.completedGameId` populated before fatigue is readable — already guaranteed
  by `useLeagueGameReconciliation`
