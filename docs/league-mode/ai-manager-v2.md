# AI Manager v2 — Pre-Game Decision Scope

> **Status: Future phase (not part of the initial league slice)**
>
> See [stamina.md](stamina.md) for the v1 AI starting-pitcher approach (seed-hash rotation, no state required) and the within-game pitching change logic that ships in v1.
>
> This document describes what an AI v2 manager would decide **before the first pitch** of each league game: starting pitcher selection with rest awareness, batting order construction, and bench configuration.

---

## What v1 AI decides (already shipping)

| Decision point | v1 behavior |
|---|---|
| **Starting pitcher** | Deterministic seed-hash rotation — picks from the SP/SP‑RP pool, no cross-game state |
| **In-game pitching change** | `makeAiPitchingDecision` — fatigue-factor + handedness matchup |
| **In-game pinch hitter** | `makeAiTacticalDecision` — bench candidate ranked by contact mod |
| **Batting order** | Fixed roster order as stored in `PlayerRecord.orderIndex`; never re-sorted |
| **Bench composition** | Fixed — bench is whatever is in the `bench` section of the roster |
| **Tactical decisions** | `makeAiTacticalDecision` — steal, bunt, count modifiers, IBB |
| **Strategy** | `makeAiStrategyDecision` — power / aggressive / contact / balanced per game situation |

Everything in the table above is scope-complete for v1. AI v2 extends the **pre-game** rows.

---

## v2 Scope: Pre-Game Decisions

### 1. Starting Pitcher — Rest-Aware Selection

**v1 gap:** Seed-hash rotation produces natural variety but has no memory — it may inadvertently start the same SP on back-to-back days.

**v2 plan:** Replace `selectAiStartingPitcherIdx` with a rest-aware version that queries `PitcherWorkloadRecord` (introduced in the cross-game stamina phase — see [stamina.md](stamina.md#future-phase-pitcher-rotation-tracking)) and selects the most-rested eligible SP. Seed hash is retained as a deterministic tiebreaker when rest days are equal.

**Decision logic (ordered priority):**

1. Filter to pitchers with role `"SP"` or `"SP/RP"` (fall back to all pitchers for stock/legacy teams with no roles set)
2. Fetch each candidate's `PitcherWorkloadRecord.gameDay` for the current season
3. Sort candidates by days since last appearance, descending (most rested first)
4. Tiebreak by `fnv1a(gameSeed) % candidateCount` for full determinism
5. Select the first candidate

**Short-rest signal propagation:** The selected pitcher's `computeShortRestPenalty` is applied at `GameSaveSetup` time as a temporary `staminaMod` offset, not written back to `PlayerRecord`. The in-game `makeAiPitchingDecision` already reacts to the resulting fatigue factor — no changes to the in-game hook are needed.

---

### 2. Batting Order Construction

**v1 gap:** The batting order is whatever order players happen to be stored in under `PlayerRecord.orderIndex`. This is not optimized for game situation, opponent, or player attributes.

**v2 plan:** Before building `GameSaveSetup` for each league game, run `buildAiBattingOrder(players, opponentSP)` to produce a sorted lineup. The result is passed as the `lineupOrder` slot for that team, overriding the raw roster order for the duration of this game only. The `PlayerRecord` store is never mutated.

**Ordering heuristic (`buildAiBattingOrder`):**

The algorithm follows the conventional batting-order wisdom adapted to the attribute set available:

| Slot | Profile | Attribute signal |
|---|---|---|
| 1 (leadoff) | High contact, moderate power, best on-base | Highest `contactMod`; penalize very low `powerMod` |
| 2 | High contact, moderate power — sets the table | Second-highest contact score |
| 3 (best hitter) | Best overall — contact + power balanced | Highest `(contactMod + powerMod) / 2` |
| 4 (cleanup) | Highest power — drives in runs | Highest `powerMod` |
| 5–6 | Good all-round hitters | Descending combined score |
| 7–8 | Below-average hitters, more defensive value | Remaining lineup players |
| 9 | Weakest bat (or pitcher slot in NL-style rules) | Lowest combined score |

**Platoon adjustment:** If the opponent's starting pitcher handedness is known (via `handednessByTeam`), bump left-handed hitters up 1–2 slots against a right-handed SP and vice versa (using the existing `buildHandednessMatchup` / `getHandednessOutcomeModifiers` helpers).

**Determinism guarantee:** `buildAiBattingOrder` must be a pure function of `(players, opponentSPHandedness, gameSeed)`. The seed hash is used only to break exact ties in attribute scores; no random shuffling.

---

### 3. Bench Configuration

**v1 gap:** Bench is whatever is in the `bench` section of the roster. The AI never promotes a player from bench to lineup or demotes a starter to bench based on the upcoming game.

**v2 plan:** Run `buildAiBenchStrategy(players, opponentSP)` to produce an ordered bench list optimized for pinch-hitting availability late in the game. This does **not** move players between `lineup` and `bench` sections — it only changes the priority order in which `makeAiTacticalDecision` scans bench candidates.

**Bench priority ordering:**

1. Platoon-advantage hitters (handedness advantage against opponent SP) rank first — they are prime pinch-hit targets
2. Power hitters rank above contact hitters when the game is within 2 runs (run-production focus)
3. Contact hitters rank above power hitters when the game is tied or in extra innings (on-base focus)
4. Catchers and dedicated defensive subs rank last (least likely to be used as pinch hitters)

The ordered bench list is computed once at game setup and stored in `GameSaveSetup` for use by `makeAiTacticalDecision` throughout the game. No in-game re-sorting.

---

### 4. What v2 AI Does NOT Decide

The following remain out of scope even for v2, to preserve simplicity:

| Decision | Rationale for exclusion |
|---|---|
| **Positional defence** | No fielding model exists; all defence is abstracted via pitcher attributes |
| **Opener / bulk reliever strategy** | Requires bullpen depth awareness not yet tracked per-game |
| **Designated hitter slot** | DH rules are not yet implemented; lineup is 9 batters only |
| **Series-level bullpen conservation** | Would require cross-game RP workload tracking (same phase as SP rest, could be added alongside) |
| **Player injuries / fatigue-based lineup changes** | No injury model in scope |
| **Pinch runner** | No baserunning-speed stat; pinch running would have no mechanical effect |

---

## Module plan

All new v2 logic lives in `src/features/gameplay/context/`:

```
aiStarterSelection.ts        # selectAiStartingPitcherIdxWithRest (replaces seed-hash v1 fn)
aiBattingOrder.ts            # buildAiBattingOrder — pure, deterministic
aiBenchStrategy.ts           # buildAiBenchStrategy — pure, deterministic
```

The existing modules are not modified structurally:

- `aiPitchingDecision.ts` — no changes needed; reacts to fatigue naturally
- `aiManager.ts` (barrel) — re-exports the new functions alongside existing ones
- `aiTypes.ts` — no new `AiDecision` kinds needed; pre-game decisions produce data, not dispatched actions

**`GameSaveSetup` additions** (the struct passed into `headlessSim` and `GamePage`):

```ts
interface GameSaveSetup {
  // ... existing fields ...

  /** v2: pre-computed batting order for each team. [] = use roster order (v1 fallback). */
  lineupOrder?: [string[], string[]];

  /** v2: ordered bench priority list for each team. [] = use bench section order (v1 fallback). */
  benchPriority?: [string[], string[]];
}
```

Empty arrays (`[]`) signal "use v1 fallback behavior" — fully backward-compatible. Existing exhibition games and v1 league games that don't call the v2 helpers will behave identically.

---

## Testing approach

Each new module should have a unit test file alongside it (`aiBattingOrder.test.ts`, etc.) covering:

- Basic happy path: lineup sorted correctly for default attributes
- Platoon tiebreaker: LHB moved up vs RH pitcher
- Determinism: same seed + same inputs → same output on repeated calls
- Edge cases:
  - All players have identical attributes (seed hash determines order)
  - Fewer than 9 lineup players (graceful pass-through)
  - Stock team with no roles / no handedness set

---

## Phase placement

AI v2 pre-game decisions are planned for the same phase as cross-game pitcher rest tracking (see [stamina.md](stamina.md#future-phase-pitcher-rotation-tracking)), since `selectAiStartingPitcherIdxWithRest` depends on `PitcherWorkloadRecord`. The batting order and bench strategy helpers (`buildAiBattingOrder`, `buildAiBenchStrategy`) are stateless and can be implemented independently in an earlier phase if desired.

Suggested ordering:

1. `buildAiBattingOrder` + `buildAiBenchStrategy` — no new data model; can ship any time after v1 league launch
2. `PitcherWorkloadRecord` collection + `computeShortRestPenalty` — requires RxDB schema bump
3. `selectAiStartingPitcherIdxWithRest` — depends on (2)
4. `SchedulePage` Rotation Planner widget — UI surface for (2) and (3)
