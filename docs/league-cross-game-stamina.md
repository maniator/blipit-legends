# League Cross-Game Stamina Tracking

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
