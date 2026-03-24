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

### Batter fatigue (within-game) *(future — not yet implemented)*

> **Status:** Batter within-game fatigue is planned but not yet implemented. The fields and function described below do not exist in the current codebase and are documented here as the design target for a future phase.

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

## AI Starting Pitcher Selection

### The current gap

Today `activePitcherIdx` is always initialized to `[0, 0]` — the first pitcher in `rosterPitchers`. This means every game, for every AI-managed team, starts pitcher slot 0 regardless of who that is or how recently they pitched. There is no pre-game selection logic.

The existing `isPitcherEligibleForChange` function intentionally blocks SP-only pitchers from **in-game** changes — the SP must be designated before the game begins. This means the AI starting pitcher choice matters: it determines which pitcher takes the mound for the entire game (until fatigued out), and picking the wrong player would misuse a reliever as a starter or waste a rested SP.

### v1 League solution: deterministic rotation via game seed

For the initial league slice, AI starter selection uses a **stateless deterministic rotation** based on the game's seed, requiring no cross-game workload tracking:

```ts
/**
 * Select the starting pitcher index for an AI-managed team.
 *
 * Uses the game seed to pick deterministically from the eligible SP pool
 * (pitchers with role "SP" or "SP/RP"), falling back to index 0 if none.
 * The same game always produces the same starter — headless re-simulation
 * is fully deterministic.
 */
function selectAiStartingPitcherIdx(
  rosterPitchers: string[],
  pitcherRoles: Record<string, string>,
  gameSeed: string,
): number {
  const eligibleSPs = rosterPitchers
    .map((id, idx) => ({ id, idx }))
    .filter(({ id }) => {
      const role = pitcherRoles[id];
      return !role || role === "SP" || role === "SP/RP";
    });

  if (eligibleSPs.length === 0) return 0; // fallback: no roles set (stock/legacy teams)

  // Hash the seed to a stable index within the SP pool.
  const hashVal = fnv1a(gameSeed);
  return eligibleSPs[hashVal % eligibleSPs.length].idx;
}
```

**Why this works for v1:**
- Deterministic: the same `scheduledGameId` seed always picks the same starter, so headless re-sims produce identical results
- Varied: different games produce different starters, distributing appearances across the SP pool naturally
- No state required: no `PitcherWorkloadRecord` or cross-game tracking needed in the initial slice
- Graceful fallback: teams with no roles set (stock teams) always start pitcher 0, preserving existing behavior

**Where it runs:** `selectAiStartingPitcherIdx` is called when building `GameSaveSetup` for a headless sim or when preparing an AI-managed side of a Watch/Manage game. The result sets `activePitcherIdx` for that team before `createFreshGameState` is called.

### What the AI does NOT decide in v1

- Pre-game lineup ordering (batting order is taken from the saved roster as-is)
- Which relievers to warm up (no bullpen state)
- Whether to use an "opener" strategy

These remain constant per team across all league games in the initial slice.

### Manager Mode (human player)

When the human is managing a game via Watch/Manage, the `SchedulePage` will eventually show a **"Set Starter"** control before the game begins (future UX — not required for v1). In v1, the human's team also uses the deterministic seed selection, with the option to override via the existing pitcher substitution UI once the game starts.

---

## Future Phase: Pitcher Rotation Tracking

> *(Phase 11 or later — not part of the initial league slice.)*

Once league play is stable, cross-game pitcher workload tracking adds real rotation management incentives. This section describes the planned design in enough detail to implement it as a discrete future phase.

### Goal

Make pitcher overuse mechanically costly without hard-blocking it. An AI or human manager who starts the same SP on back-to-back days should see noticeably degraded performance. A manager who rotates a 4- or 5-pitcher staff properly should see consistently better results over a long season.

### Data: `PitcherWorkloadRecord`

A new per-season, per-pitcher record written whenever a pitcher appears in a completed game:

```ts
/**
 * Written to the `pitcherWorkload` RxDB collection at the end of every game
 * in which a pitcher appears. One record per pitcher per game.
 */
export interface PitcherWorkloadRecord {
  /** Primary key — e.g. "pw_<fnv1a>" */
  id: string;
  leagueSeasonId: string;
  leagueId: string;
  teamId: string;
  playerId: string;
  /** Game day this appearance occurred on. */
  gameDay: number;
  /** FK → CompletedGameRecord.id */
  completedGameId: string;
  /** Role in this appearance. */
  role: "SP" | "RP" | "SP/RP";
  /** Pitches thrown in this appearance. */
  pitchesThrown: number;
  /** Batters faced in this appearance. */
  battersFaced: number;
  /** Whether this was a starting appearance (first pitcher of the game). */
  wasStarter: boolean;
}
```

This collection is new (added in the future phase that implements rotation tracking) and requires a schema version bump + migration strategy per the RxDB discipline in `docs/rxdb-persistence.md`.

### Rest penalty applied at game setup

When building `GameSaveSetup` for a league game (headless or Watch/Manage), look up the pitcher's most recent `PitcherWorkloadRecord` for the season and derive a short-rest `staminaMod` offset:

```ts
/**
 * Compute the short-rest penalty to apply to a pitcher's staminaMod.
 * Applied additively at game-setup time — does NOT modify the stored PlayerRecord.
 *
 * The penalty degrades the pitcher's effective staminaMod, lowering their
 * fatigue onset threshold so they reach fatigue earlier than a rested arm.
 */
function computeShortRestPenalty(
  daysSinceLastAppearance: number,
  pitchesInLastAppearance: number,
): number {
  // No penalty if rested 4+ days (or no prior appearance this season).
  if (daysSinceLastAppearance >= 4) return 0;

  // Base penalty by days rest.
  const daysPenalty =
    daysSinceLastAppearance <= 0 ? -20  // same day (doubleheader or error): extreme
    : daysSinceLastAppearance === 1 ? -15  // back-to-back starts: heavy
    : daysSinceLastAppearance === 2 ? -8   // one day rest: moderate
    : -3;                                  // two days rest: minor

  // Additional penalty for high-workload previous outings (>100 pitches).
  const workloadPenalty = pitchesInLastAppearance > 100 ? -5
    : pitchesInLastAppearance > 80 ? -2
    : 0;

  return daysPenalty + workloadPenalty;
}
```

The penalty is applied **only for the duration of the game setup** — it is not written back to `PlayerRecord.staminaMod`. This keeps the roster data clean and makes the penalty easily auditable.

### AI starter selection with rest awareness

Once `PitcherWorkloadRecord` exists, `selectAiStartingPitcherIdx` is replaced with a rest-aware version:

```ts
/**
 * Future (cross-game tracking phase): Select AI starting pitcher using rest data.
 * Prefers the most-rested SP. Falls back to deterministic seed selection if all
 * SPs have equal rest (e.g. first game of the season).
 */
async function selectAiStartingPitcherIdxWithRest(
  rosterPitchers: string[],
  pitcherRoles: Record<string, string>,
  teamId: string,
  leagueSeasonId: string,
  currentGameDay: number,
  gameSeed: string,
): Promise<number> {
  const eligibleSPs = rosterPitchers
    .map((id, idx) => ({ id, idx }))
    .filter(({ id }) => {
      const role = pitcherRoles[id];
      return !role || role === "SP" || role === "SP/RP";
    });

  if (eligibleSPs.length === 0) return 0;

  // Fetch most recent workload record per SP.
  const workloads = await fetchRecentWorkloads(
    eligibleSPs.map((sp) => sp.id), teamId, leagueSeasonId,
  );

  // Sort by days since last appearance descending (most rested first).
  // Tie-break by seed hash for determinism.
  const hashVal = fnv1a(gameSeed);
  eligibleSPs.sort((a, b) => {
    const aRest = workloads[a.id]
      ? currentGameDay - workloads[a.id].gameDay
      : 999; // never appeared = most rested
    const bRest = workloads[b.id]
      ? currentGameDay - workloads[b.id].gameDay
      : 999;
    if (bRest !== aRest) return bRest - aRest; // most rested first
    return (hashVal % 2 === 0 ? 1 : -1); // deterministic tiebreak
  });

  return eligibleSPs[0].idx;
}
```

### `SchedulePage` Rotation Planner widget

In Watch/Manage mode, a **Rotation Planner** section on `SchedulePage` (added in this future phase) shows each pitcher's current rest status ahead of upcoming games. See [ai-manager-v2.md](ai-manager-v2.md) for the broader v2 AI scope (batting order construction, bench strategy) that ships alongside this widget:

```
┌─────────────────────────────────────────────────────────┐
│  Hawks — Rotation Planner                               │
├──────────────────┬──────────┬───────────┬───────────────┤
│  Pitcher         │ Last     │ Rest Days │ Status        │
├──────────────────┼──────────┼───────────┼───────────────┤
│  Rivera (SP)     │ Day 4    │ 3 days    │ 🟡 Short rest │
│  Wu (SP)         │ Day 2    │ 5 days    │ 🟢 Rested     │
│  Jones (SP/RP)   │ Day 3    │ 4 days    │ 🟢 Rested     │
│  Patel (RP)      │ Day 5    │ 2 days    │ 🟠 Bullpen    │
│  Smith (RP)      │ Day 4    │ 3 days    │ 🟠 Bullpen    │
├──────────────────┴──────────┴───────────┴───────────────┤
│  Next game: Day 7 vs Wolves                             │
│  Suggested starter: Wu (5 days rest)     [Override ▾]  │
└─────────────────────────────────────────────────────────┘
```

Color coding:
- 🟢 **Rested** — 4+ days since last appearance
- 🟡 **Short rest** — 2–3 days (penalty applied)
- 🔴 **Back-to-back** — 0–1 days (heavy penalty applied)
- 🟠 **Bullpen** — RP/SP-RP roles shown separately; rest status still visible

The **[Override]** button opens a picker so the human manager can designate any eligible pitcher as the day's starter, overriding the AI suggestion.

### `db.ts` changes for this phase

Add to `DbCollections`:
```ts
pitcherWorkload: RxCollection<PitcherWorkloadRecord>;
```

This is a schema version bump on the `leagueSeasons` or a new net-new collection (preferred) — requires its own `migrationStrategies` entry. The epoch-bump mechanism must NOT be used for this post-launch change.

---

## Cross-Game Stamina: Full Plan Summary

| Phase | Feature | Mechanism |
|---|---|---|
| **v1 (initial slice)** | Within-game pitcher fatigue | `pitcherPitchCount` + `battersFaced` → `computeFatigueFactor` → degrades pitcher effectiveness |
| **v1 (initial slice)** | Within-game batter fatigue | `batterPlateAppearances` → `computeBatterFatigueFactor` → contact/power penalties |
| **v1 (initial slice)** | AI starter selection | Deterministic rotation via game seed hash — no cross-game state |
| **Future** | Pitcher rest tracking | `PitcherWorkloadRecord` written per game; short-rest penalty injected at game setup |
| **Future** | Rest-aware AI rotation | AI selects most-rested SP; fallback to seed-hash tiebreaker |
| **Future** | Rotation Planner UI | `SchedulePage` widget showing rest days and color-coded freshness |
| **Not planned** | Cross-game batter fatigue | Batter workload resets each game; no PA carry-over across games |

---
