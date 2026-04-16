# Baseball Rules Delta — MLB vs Ballgame Simulator

This document is the authoritative record of every place where Ballgame's simulator behavior intentionally or necessarily differs from MLB Official Baseball Rules. It also documents rules that are fully implemented for completeness.

The PM Agent must consult this document for every baseball-rule question. Responses must always present two columns: **Official MLB** and **Ballgame implementation**, citing the source file and line range.

---

## How to read this table

- **✅ Matches MLB** — the rule is implemented faithfully.
- **⚠️ Delta** — the simulator diverges from official rules; the deviation is intentional or inherent to the sim format.
- **🚫 Not implemented** — the rule has no equivalent in the simulator.

---

## Core game flow

### Innings and outs

| Rule area               | Official MLB                              | Ballgame implementation                                                                                              | Status         | Source                                                 |
| ----------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------ |
| Game length             | 9 innings standard; extras until a winner | 9 innings standard; extra innings continue via `nextHalfInning`, and no maximum inning cap is indicated in that flow | ✅ Matches MLB | `src/features/gameplay/context/gameOver.ts:5-15,53-75` |
| Outs per half-inning    | 3 outs                                    | 3 outs (`newOuts === 3` triggers half-inning transition)                                                             | ✅ Matches MLB | `src/features/gameplay/context/playerOut.ts:109`       |
| Batting order           | 9 batters, sequential, wraps              | 9-slot fixed lineup, `nextBatter` wraps at index 9                                                                   | ✅ Matches MLB | `src/features/gameplay/context/playerOut.ts:32-35`     |
| Half-inning state reset | Bases cleared, count reset                | `baseLayout`, `outs`, `strikes`, `balls`, `pendingDecision`, `hitType` all reset in `nextHalfInning`                 | ✅ Matches MLB | `src/features/gameplay/context/gameOver.ts:17-32`      |

### Ball-strike count

| Rule area                  | Official MLB                                   | Ballgame implementation                                                                                                                                                                                                        | Status                      | Source                                                |
| -------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- | ----------------------------------------------------- |
| Strike count limit         | 3 strikes = strikeout                          | `newStrikes === 3` in `playerStrike` records the K                                                                                                                                                                             | ✅ Matches MLB              | `playerActions.ts:33`                                 |
| Ball count limit           | 4 balls = walk                                 | `newBalls === 4` in `playerBall` triggers `hitBall(Hit.Walk, …)`                                                                                                                                                               | ✅ Matches MLB              | `playerActions.ts:82-84`                              |
| Foul ball with 2 strikes   | Does not advance to third strike (except bunt) | In `handleSimAction`, the `foul` branch guards the rule: when `strikes < 2` it calls `playerStrike`; at 2 strikes it increments pitch count and leaves the count unchanged. `playerStrike` itself is not the protection point. | ✅ Matches MLB              | `src/features/gameplay/context/handlers/sim.ts:46-60` |
| Count as manager-mode hint | N/A (no manager mode in real baseball)         | `count30` and `count02` are offered as `DecisionType` hints to guide the manager                                                                                                                                               | ⚠️ Delta (sim-only feature) | `decisionTypes.ts:6-7`                                |

### Walk (base on balls)

| Rule area                               | Official MLB                                                           | Ballgame implementation                                                                                                                          | Status                              | Source                                                                    |
| --------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- | ------------------------------------------------------------------------- |
| Walk advancement                        | Force advancement only — non-forced runners do not move                | Walk handled via `advanceRunners(Hit.Walk, …)`: runners advance only if forced by the batter taking 1st                                          | ✅ Matches MLB                      | `advanceRunners.ts:69-104`                                                |
| Intentional walk (IBB) — pitch sequence | 4 intentional pitches thrown; manager signals umpire (rule 5.05(b)(2)) | Single pitch event: in the `case "intentional_walk"` branch, `incrementPitchCount` fires once, then `hitBall(Hit.Walk, …)` — no 4-pitch sequence | ⚠️ Delta                            | `playerOut.ts:14`; `src/features/gameplay/context/handlers/sim.ts:94-103` |
| IBB availability                        | Manager may issue IBB at any time                                      | Only offered in Manager Mode when: inning ≥ 7, 2 outs, score diff ≤ 2, 1st base empty, runner on 2nd or 3rd                                      | ⚠️ Delta (constrained availability) | `reducer.ts:66-71`                                                        |

---

## Runner advancement

### Hit-type outcomes (deterministic base rules)

| Hit type                      | Official MLB                               | Ballgame implementation                                                                                                      | Status                           | Source                                          |
| ----------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ----------------------------------------------- |
| Home run                      | All runners score; batter scores           | `runsScored = oldBase.filter(Boolean).length + 1`; all runner IDs cleared                                                    | ✅ Matches MLB                   | `advanceRunners.ts:33-36`                       |
| Triple                        | All runners score; batter to 3rd           | All runner IDs cleared; `newBase[2] = 1`; batter placed by caller                                                            | ✅ Matches MLB                   | `advanceRunners.ts:38-42`                       |
| Double (runner on 2nd or 3rd) | Runner on 2nd and 3rd score; batter to 2nd | Both score (`runsScored++` for each); `newBase[1] = 1`                                                                       | ✅ Matches MLB                   | `advanceRunners.ts:44-53`                       |
| Double (runner on 1st)        | Runner on 1st typically advances to 3rd    | Deterministically placed on 3rd (`newBase[2] = 1`) **plus** a ~30% probabilistic scoring chance before `advanceRunners` runs | ⚠️ Delta (probabilistic scoring) | `advanceRunners.ts:47-51`; `hitBall.ts:259-274` |
| Single (runner on 3rd)        | Runner on 3rd scores                       | `runsScored++`                                                                                                               | ✅ Matches MLB                   | `advanceRunners.ts:56`                          |
| Single (runner on 2nd)        | Runner on 2nd advances to 3rd              | Placed on 3rd deterministically **plus** a ~60% probabilistic scoring chance resolved before `advanceRunners`                | ⚠️ Delta (probabilistic scoring) | `advanceRunners.ts:57-60`; `hitBall.ts:244-258` |
| Single (runner on 1st)        | Runner on 1st advances to 2nd              | Placed on 2nd; additional ~28% chance to stretch to 3rd (speed/strategy adjusted)                                            | ⚠️ Delta (probabilistic stretch) | `advanceRunners.ts:61-65`; `hitBall.ts:299-317` |

### Batted-ball type resolution

Real baseball resolves each batted ball with full fielder positioning, reaction time, and scorekeeping judgment. The simulator abstracts this into a single random roll per batted-ball type.

| Batted-ball type | Ballgame probabilities                                                                                 | Source               |
| ---------------- | ------------------------------------------------------------------------------------------------------ | -------------------- |
| `pop_up`         | 100% out; runners hold (infield fly rule applied)                                                      | `hitBall.ts:427-430` |
| `weak_grounder`  | 65% ground out (may be DP/FC if runner on 1st); 35% infield single                                     | `hitBall.ts:449-453` |
| `hard_grounder`  | 50% ground out; 50% single                                                                             | `hitBall.ts:455-459` |
| `line_drive`     | 20% liner caught (sac fly eligible); 45% single; 20% double; 8% triple; 7% HR                          | `hitBall.ts:461-480` |
| `medium_fly`     | 70% fly out (sac fly eligible); 18% single; 12% double                                                 | `hitBall.ts:482-493` |
| `deep_fly`       | 35% warning-track out (sac fly eligible); 65% hit spread (double → HR); HR threshold strategy-adjusted | `hitBall.ts:495-510` |

### Double play

| Rule area        | Official MLB                                                          | Ballgame implementation                                                                                     | Status                                      | Source              |
| ---------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------- |
| DP conditions    | Runner on 1st, <2 outs, ground ball to infield                        | Same conditions; DP not attempted with 2 outs                                                               | ✅ Matches MLB                              | `hitBall.ts:58`     |
| DP probability   | Depends on fielder positioning, runner/batter speed, batted-ball type | Context-aware: 55% base, ±adjusted by batter speed mod and runner speed mod; clamped 20%–80%                | ⚠️ Delta (probabilistic, not deterministic) | `hitBall.ts:59-85`  |
| DP execution     | Runner from 1st out at 2nd, batter out at 1st                         | Two sequential `playerOut` calls: first for runner (no batter rotation), second for batter (advance lineup) | ✅ Matches MLB                              | `hitBall.ts:79-85`  |
| Fielder's choice | Lead runner thrown out; batter safe at 1st                            | FC fires when grounder roll does not hit DP threshold; batter ID placed on 1st                              | ✅ Matches MLB                              | `hitBall.ts:86-101` |

### Sacrifice fly

| Rule area             | Official MLB                                     | Ballgame implementation                                                                                                                            | Status                                         | Source                         |
| --------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------ |
| Sac fly conditions    | Fly ball, <2 outs, runner on 3rd tags and scores | Same conditions; probabilistic per ball type and runner speed                                                                                      | ✅ Matches MLB                                 | `hitBall.ts:146-180`           |
| Sac fly probabilities | Varies by hit location / distance                | `line_drive`: 40%; `medium_fly`: 65%; `deep_fly`: 80%; all adjusted ±by runner `speedMod`, clamped 20%–95%                                         | ⚠️ Delta (probabilistic)                       | `hitBall.ts:464`, `487`, `498` |
| Sac fly stats         | PA not AB; batter earns RBI                      | `isSacFly: true, rbi: 1` passed to `playerOut`; logged in `outLog`                                                                                 | ✅ Matches MLB                                 | `playerOut.ts:50-58`, `83`     |
| Tag-up from 2nd       | Runner on 2nd may tag up to 3rd on fly out       | Probabilistic; only fires when 3rd is empty after any sac fly: `line_drive` 10%, `medium_fly` 20%, `deep_fly` 35%; speed-adjusted, clamped 10%–70% | ⚠️ Delta (probabilistic; MLB is judgment call) | `hitBall.ts:182-201`           |

### Infield fly rule

| Rule area           | Official MLB                                            | Ballgame implementation                                           | Status         | Source               |
| ------------------- | ------------------------------------------------------- | ----------------------------------------------------------------- | -------------- | -------------------- |
| Pop-up with runners | Batter automatically out; runners not forced to advance | `pop_up` → always `playerOut`; no sac-fly or tag-up check applied | ✅ Matches MLB | `hitBall.ts:427-430` |

---

## Game-end logic

### Bottom-half skip (home team winning)

| Rule area                   | Official MLB                                                                       | Ballgame implementation                                                                              | Status         | Source              |
| --------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------- | ------------------- |
| No bottom 9th if home leads | If home team leads after top of 9th (or later), bottom half not played (rule 5.08) | `nextHalfInning`: when `newHalfInning === 1 && newInning >= 9 && home > away`, game ends immediately | ✅ Matches MLB | `gameOver.ts:44-51` |

### Walk-off

| Rule area                  | Official MLB                                                                      | Ballgame implementation                                                                                                                 | Status         | Source                 |
| -------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ---------------------- |
| Walk-off condition         | Home team takes the lead in the bottom of the 9th or later; game ends immediately | `checkWalkoff`: fires when `inning >= 9 && atBat === 1 && home > away`                                                                  | ✅ Matches MLB | `gameOver.ts:78-87`    |
| Post-3-out game-over check | After 3 outs in the top of the 9th+, if away leads, check again                   | `playerOut.ts:112-115` calls `checkGameOver(afterHalf, log)` after `nextHalfInning` for top-half → bottom-half transition in inning ≥ 9 | ✅ Matches MLB | `playerOut.ts:112-115` |

### Extra innings — tiebreak runner

| Rule area                    | Official MLB                                                                                     | Ballgame implementation                                                                                                   | Status         | Source              |
| ---------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | -------------- | ------------------- |
| Tiebreak runner placement    | Runner placed on 2nd at the start of each half-inning beyond the 9th (permanent rule since 2022) | Runner placed on 2nd; runner ID is the last batter from the previous half-inning's lineup                                 | ✅ Matches MLB | `gameOver.ts:58-74` |
| Runner identity              | MLB: last batter of the previous half-inning (or a sub)                                          | Ballgame: `lineupOrder[newHalfInning][(batterIndex - 1 + lineupSize) % lineupSize]`                                       | ✅ Matches MLB | `gameOver.ts:61-63` |
| Extra-inning game-over check | After 3 outs in the top of an extra inning, if away leads game ends                              | `newHalfInning === 0 && newInning > 9` check in `nextHalfInning` calls `checkGameOver` before placing the tiebreak runner | ✅ Matches MLB | `gameOver.ts:53-56` |

---

## Strategic decisions (Manager Mode)

### Steal

| Rule area                 | Official MLB                                           | Ballgame implementation                                                                           | Status                      | Source                                                                                                   |
| ------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------- |
| Steal bases available     | Any runner may attempt to steal any unoccupied base    | Only 1st→2nd (base index 0) and 2nd→3rd (base index 1) offered                                    | ⚠️ Delta (no steal of home) | `src/features/gameplay/context/decisionTypes.ts:3-4`; `src/features/gameplay/context/stealAttempt.ts:10` |
| Steal availability        | Manager's discretion                                   | Manager Mode only; offered when expected success > 72%, <2 outs, destination base empty           | ⚠️ Delta (constrained)      | `src/features/gameplay/context/reducer.ts:40-52`, `src/features/gameplay/context/reducer.ts:74-83`       |
| Steal success probability | Depends on runner speed, catcher arm, pitcher delivery | Base: 70% (1st→2nd), 60% (2nd→3rd); scaled by runner `speedMod` and `stratMod(strategy, "steal")` | ⚠️ Delta (simplified model) | `src/features/gameplay/context/reducer.ts:40-48`                                                         |
| Caught stealing           | Runner out; batter remains                             | Runner cleared from base; `playerOut(…, false)` — batter stays up, lineup does not advance        | ✅ Matches MLB              | `stealAttempt.ts:35-54`                                                                                  |

### Bunt

| Rule area                   | Official MLB                                                | Ballgame implementation                                                                                                          | Status                                 | Source                  |
| --------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ----------------------- |
| Bunt outcomes               | Sac bunt, bunt single, FC, bunt pop-up, foul-bunt strikeout | 4 mutually exclusive outcomes: single (8%), FC (12%), sac bunt (60%), pop-up (20%); contact strategy shifts single chance to 20%; foul-bunt on 2-strike count → strikeout | ✅ Matches MLB | `buntAttempt.ts:21-143` |
| Sac bunt runner advancement | All runners advance one base; batter out                    | Runner IDs shifted: `oldBase[1]→newBase[2]`, `oldBase[0]→newBase[1]`; batter out                                                 | ✅ Matches MLB                         | `buntAttempt.ts:85-128` |
| FC on bunt                  | Lead runner out; batter safe at 1st                         | Lead runner removed; batter ID placed on 1st; one `playerOut(…, true)` for the lead runner out                                   | ✅ Matches MLB                         | `buntAttempt.ts:27-82`  |

### Pinch hitter

| Rule area                 | Official MLB                                                       | Ballgame implementation                                                                                                 | Status                              | Source               |
| ------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | -------------------- |
| Pinch-hitter substitution | Manager may substitute any bench player for any batter at any time | Only offered in Manager Mode: inning ≥ 7, <2 outs, runner on 2nd or 3rd, 0-0 count; bench player not already subbed out | ⚠️ Delta (constrained availability) | `reducer.ts:91-100`  |
| Substitution permanence   | Substituted player may not re-enter                                | Subbed player tracked in `substitutedOut`; excluded from future pinch-hitter candidate lists                            | ✅ Matches MLB                      | `reducer.ts:102-103` |
| Candidate ranking         | Manager's choice                                                   | Candidates sorted by `contactMod * 0.6 + powerMod * 0.4 + matchupDeltaPct` (handedness-aware)                           | ⚠️ Delta (automated ranking)        | `reducer.ts:146-153` |

### Defensive shift

| Rule area          | Official MLB                                                                    | Ballgame implementation                                                           | Status                           | Source                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Shift rule         | Since 2023: two infielders required on each side of 2nd base; no extreme shifts | Ballgame predates the ban; shift raises ground-out probability by +10% (100/1000) | ⚠️ Delta (shift ban not modeled) | `hitBall.ts:437`                                                                                                |
| Shift availability | N/A (constrained by 2023 rule)                                                  | Manager Mode only; `defensiveShift` flag persists for the half-inning             | ⚠️ Delta                         | `gameOver.ts:17-32`; `src/features/gameplay/context/handlers/decisions.ts:49-65` (`case "set_defensive_shift"`) |

### IBB + steal combined decision

| Rule area          | Official MLB                            | Ballgame implementation                                                                        | Status                      | Source                  |
| ------------------ | --------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------- | ----------------------- |
| IBB or steal combo | Not a formal real-world decision prompt | `ibb_or_steal` decision type offered when both IBB and steal conditions are met simultaneously | ⚠️ Delta (sim-only feature) | `decisionTypes.ts:9-12` |

---

## Pitcher fatigue

| Rule area              | Official MLB                               | Ballgame implementation                                                                                                           | Status                       | Source                                                  |
| ---------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------- |
| Pitch count tracking   | Official statistic; no mandatory limit     | `pitcherPitchCount[team]` incremented every pitch event including IBB (single event), excluding steal attempts                    | ✅ Matches MLB               | `playerOut.ts:16-29`                                    |
| Batters faced tracking | Official statistic                         | `pitcherBattersFaced[team]` incremented when batter's plate appearance is complete (`batterCompleted=true`)                       | ✅ Matches MLB               | `playerOut.ts:42-47`                                    |
| Fatigue effect         | Real baseball: manager discretion for pull | Fatigue factor computed from pitch count and batters faced; reduces effective `controlMod` (more wild pitches)                    | ⚠️ Delta (no automatic pull) | `playerActions.ts:174-183`                              |
| Pitcher substitution   | Manager pulls pitcher; reliever enters     | Managed via `activePitcherIdx`; auto-switch logic and/or Manager Mode decision (not yet fully exposed as a manager decision type) | ⚠️ Delta (partial)           | `src/features/gameplay/context/gameStateTypes.ts:57-58` |

---

## Features not implemented

These MLB rules have no equivalent in Ballgame. The PM Agent must flag them as out-of-scope unless a task explicitly implements them.

| Rule / Feature              | MLB rule reference | Notes                                           |
| --------------------------- | ------------------ | ----------------------------------------------- |
| Balk                        | Rule 5.07(c)       | Not modeled                                     |
| Obstruction / interference  | Rule 6.01          | Not modeled                                     |
| Designated hitter           | Rule 5.11          | Not modeled; all players bat                    |
| Replay / challenge system   | Rule 8.02          | Not modeled                                     |
| Pitch clock                 | Rule 5.07(b)       | Not modeled                                     |
| Hit by pitch                | Rule 5.05(b)(1)    | Implemented: ~11% of ball-4 walks become HBP; force advancement identical to walk; logged as "HBP" in hit log |
| Dropped third strike        | Rule 5.05(a)(2)    | Not modeled                                     |
| Wild pitch / passed ball    | Rule 9.13 / 9.14   | Not modeled as distinct events                  |
| Pickoff                     | Rule 5.07          | Not modeled                                     |
| Steal of home               | Rule 5.05(b)       | Not offered; only 1st→2nd and 2nd→3rd steals    |
| Shift ban (2023)            | Rule 5.02(c)       | Shift still raises grounder chance in simulator |
| Extra-inning overtime limit | No MLB limit       | No limit in Ballgame either                     |
