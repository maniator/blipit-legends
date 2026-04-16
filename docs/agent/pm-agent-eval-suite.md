# PM Agent — Evaluation Suite and Scorecard

This document defines the seeded "known-answer" question set used to evaluate and regression-test the PM Agent. Run this eval suite whenever the agent prompt, knowledge base, or gameplay engine changes.

---

## Scoring rubric

Each question is scored on three dimensions:

| Dimension                      | Pass criteria                                                                                                         | Weight |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ------ |
| **Citation accuracy**          | Every simulator claim cites a specific file + line range; every official-rule claim cites an MLB rule section         | 40%    |
| **Rule consistency**           | Answer is consistent with `docs/agent/baseball-rules-delta.md`; no uncited contradictions                             | 35%    |
| **No hallucinated sim claims** | Agent does not assert simulator behavior that differs from the source files without explicitly flagging it as a delta | 25%    |

**Pass threshold per question:** ≥ 75% weighted score.  
**Suite pass threshold:** ≥ 85% of questions pass.

---

## Category 1 — Repo PM scenarios

These test planning, dependency mapping, and migration callouts.

---

### PM-01 — Feature planning: new stat field

**Question:**  
We want to add a `stolenBasesAttempted` counter to `State`. What modules need to change, what are the migration risks, and what tests are required?

**Known-answer criteria:**

- Identifies `gameStateTypes.ts` (State shape) as the primary change.
- Identifies `stealAttempt.ts` as the increment site (both success and caught-stealing paths are handled there before `playerOut` is called).
- Does NOT require changes to `playerOut.ts` for the counter — steal-specific tracking belongs in `stealAttempt.ts`, not the generic out handler.
- Flags RxDB schema versioning requirement: bump `version`, add `migrationStrategies` entry.
- Flags `docs/rxdb-persistence.md` for the schema-change checklist.
- Lists required tests: unit test for increment in both success and caught-stealing, upgrade-path test for old saves.
- Does NOT suggest changing the save format without a migration.

---

### PM-02 — Dependency mapping: extra-inning rule change

**Question:**  
We want to make the extra-inning tiebreak runner start on 1st instead of 2nd. What files change, in what order, and what are the risks?

**Known-answer criteria:**

- Identifies `gameOver.ts:65-74` as the primary change site (`baseLayout: [0, 1, 0]` → `[1, 0, 0]`).
- Flags potential replay determinism impact (existing saved games with extra-inning state will replay differently).
- Flags `baseball-rules-delta.md` as needing an update to document the deviation from MLB OBR Appendix.
- Flags `docs/agent/baseball-rules-delta.md` Extra innings row.
- Recommends a seed-anchored regression test for extra-inning scenarios.
- Notes that `HelpContent/index.tsx` (in-app rulebook) may need copy update.

---

### PM-03 — Risk review: visual snapshot impact

**Question:**  
A change is being made to the `GameControls` component layout. What is the full validation checklist before merging?

**Known-answer criteria:**

- Cites `docs/e2e-testing.md` for visual snapshot workflow.
- Cites `docs/architecture.md` for `GameControls` as a lazy-loaded component.
- Lists all 6+ Playwright viewport projects for snapshot regeneration.
- Flags that regeneration must happen inside `mcr.microsoft.com/playwright:v1.58.2-noble`.
- Lists validation commands: `yarn lint`, `yarn format:check`, `yarn typecheck`, `yarn typecheck:e2e`, `yarn test:coverage`, `yarn build`, `yarn test:e2e`.
- Recommends `@ui-visual-snapshot` agent for execution.

---

### PM-04 — Migration callout: schema change

**Question:**  
We want to add a `gameMode: "exhibition" | "season"` field to `SaveDoc`. What is the complete checklist?

**Known-answer criteria:**

- Identifies `src/storage/types.ts` and the saves schema in `src/storage/db.ts`.
- Requires `version` bump in `savesSchema`.
- Requires `migrationStrategies` entry setting `gameMode: "exhibition"` for all existing docs.
- Cites `docs/rxdb-persistence.md` schema-versioning section.
- Requires upgrade-path unit test using `createTestDb`.
- Flags export/import FNV-1a signature must still verify.
- Flags `save-load.spec.ts` and `import.spec.ts` E2E tests must still pass.
- Recommends `@rxdb-save-integrity` agent for execution.

---

### PM-05 — Sequencing: manager mode new decision type

**Question:**  
We want to add a "pitch-out" decision type to Manager Mode. Describe the correct implementation order and what guardrails apply.

**Known-answer criteria:**

- Step 1: add `{ kind: "pitch_out" }` to `DecisionType` union in `decisionTypes.ts`.
- Step 2: add detection logic in `detectDecision` in `reducer.ts`.
- Step 3: implement the pitch-out outcome (ball + catcher throw-down) — can reference `playerBall` in `playerActions.ts`.
- Cites context module cycle-free order from `copilot-instructions.md`: `strategy → advanceRunners → gameOver → playerOut → hitBall → buntAttempt → playerActions → reducer`.
- Warns that adding a random call in `detectDecision` would break PRNG call order if the decision is not always offered.
- Recommends a unit test for the new decision branch.

---

### PM-06 — Validation checklist

**Question:**  
What is the full set of validation commands to run before opening a PR that touches gameplay engine files?

**Known-answer criteria (exact commands):**

- `yarn lint` (and `yarn lint:fix` for import order)
- `yarn format:check`
- `yarn typecheck`
- `yarn typecheck:e2e`
- `yarn test:coverage`
- `yarn build`
- `yarn test:e2e` (full Playwright suite, inside Docker for visual tests)
- Cites `package.json` scripts section.
- Notes that visual tests require the Playwright container.

---

## Category 2 — Baseball adjudication scenarios

These test rule interpretation and simulator impact.

---

### BA-01 — Walk advancement

**Question:**  
Runners on 1st and 3rd. Batter walks. What happens to each runner in official baseball? What does Ballgame do?

**Known-answer criteria:**

- **Official MLB:** Runner on 1st is forced to 2nd (1st occupied by batter). Runner on 3rd is NOT forced (no force play); stays on 3rd.
- **Ballgame:** `advanceRunners(Hit.Walk, [1,0,1])` — `oldBase[0]` is true, `oldBase[1]` is false: runner from 1st moved to 2nd; `oldBase[2]` stays via `newRunnerIds[2] = ids[2]`. Correctly matches MLB.
- Citation: `advanceRunners.ts:69-104`.

---

### BA-02 — Extra-inning tiebreak runner

**Question:**  
In the bottom of the 10th inning (tied game), which runner is placed on 2nd and why?

**Known-answer criteria:**

- **Official MLB:** The player who made the last out in the previous half-inning is placed on 2nd (OBR Appendix — automatic runner rule, permanent since 2022).
- **Ballgame:** `extraRunnerId = lineupOrder[newHalfInning][(batterIndex[newHalfInning] - 1 + lineupSize) % lineupSize]`. This is the last batter index in the lineup for the team now batting — consistent with MLB intent.
- Citation: `gameOver.ts:61-63`.

---

### BA-03 — Home team skip

**Question:**  
The away team scores 3 runs in the top of the 9th to go up 5-2. The home team already led 2-0 entering the inning. Should the bottom of the 9th be played?

**Known-answer criteria:**

- **Official MLB:** Yes, the bottom of the 9th must be played — the home team is now trailing.
- **Ballgame:** `nextHalfInning` checks `home > away` before skipping. With away leading (5 > 2), the skip does not fire. Bottom of the 9th is played. Correct.
- Citation: `gameOver.ts:44-51`.

---

### BA-04 — Double play conditions

**Question:**  
Runner on 2nd base only, 1 out. Ground ball hit. Is a double play possible?

**Known-answer criteria:**

- **Official MLB:** No standard DP because there is no force play at 2nd (runner is on 2nd, not 1st). A DP would require a tag play, which is unusual and not a standard infielder DP.
- **Ballgame:** `handleGrounder` checks `baseLayout[0] && outs < 2`. With no runner on 1st, the DP branch does not fire — simple ground out.
- Citation: `hitBall.ts:58`.

---

### BA-05 — IBB with runner on 2nd, 1 out

**Question:**  
Inning 8, 1 out, runner on 2nd, score tied. Manager wants to issue an intentional walk. Is this available in Manager Mode?

**Known-answer criteria:**

- **Official MLB:** Yes, manager may issue IBB at any time.
- **Ballgame:** `ibbAvailable` requires `outs === 2` (not 1). With 1 out, IBB is NOT offered, regardless of inning or score. The condition is intentionally conservative.
- Citation: `reducer.ts:66-71`.
- Agent must clearly label this as a **Ballgame delta** from official rules.

---

### BA-06 — Sacrifice fly scoring and stats

**Question:**  
Runner on 3rd, 1 out, deep fly ball to left field. Runner tags and scores. How is this scored? Does the batter's batting average change?

**Known-answer criteria:**

- **Official MLB:** Sacrifice fly — PA counts, AB does NOT count (Rule 9.08(d)); batter earns 1 RBI.
- **Ballgame:** `handleFlyOut` → `playerOut(…, true, { isSacFly: true, rbi: 1 })`. `isSacFly: true` is logged in `outLog`. Sac flies are **excluded from AB** when computing BA: `computeBattingStatsFromLogs` skips at-bats for entries where `isSacFly` is true, so the batter's batting average is **not affected** by a sac fly.
- Citation: `hitBall.ts:204-210`; `playerOut.ts:50-58`; `src/shared/utils/stats/computeBattingStatsFromLogs.ts:83-86` (the `entry.isSacFly` branch increments `sacFlies` instead of `atBats`).

---

### BA-07 — Bunt with 2 strikes

**Question:**  
The batter has 2 strikes and bunts foul. In real baseball, what happens? What does Ballgame do?

**Known-answer criteria:**

- **Official MLB:** A foul bunt with 2 strikes is a strikeout (Rule 5.09(a)(3)).
- **Ballgame:** `buntAttempt.ts` has no special 2-strike foul-bunt-strikeout logic. The bunt pop-up path records an out (pop-up, not a foul-bunt K), and the sac-bunt and single paths proceed normally. This is a **delta** — the 2-strike foul bunt strikeout rule is not implemented.
- Citation: `buntAttempt.ts:85-141`.

---

### BA-08 — Steal of home

**Question:**  
Can a runner steal home in Ballgame?

**Known-answer criteria:**

- **Official MLB:** Yes — any runner may attempt to steal any base including home.
- **Ballgame:** `stealAttempt` only accepts `base: 0 | 1` (0 = 1st→2nd, 1 = 2nd→3rd). Steal of home (base 2→score) is not modeled. `detectDecision` only offers steal for base 0 or base 1.
- Citation: `stealAttempt.ts:10`; `reducer.ts:74-83`; `decisionTypes.ts:3`.
- Agent must mark this as **not implemented**.

---

## Category 3 — Mixed scenarios

These test planning a rule change safely.

---

### MX-01 — Implementing stolen base of home

**Question:**  
We want to implement steal of home (3rd→score) in the simulator. What is the safe implementation plan?

**Known-answer criteria:**

- Must not extend `base` param of `stealAttempt` without first checking all callers.
- Identifies `decisionTypes.ts:3` needs new `base: 0 | 1 | 2` or a separate `steal_home` kind.
- Identifies `stealAttempt.ts` as the function to extend: `newBase[base] = 0; newBase[base + 1] = 1` fails for base 2 (no index 3) — must add a scoring path instead.
- Flags PRNG call-order impact: adding a new random call in `detectDecision` changes the sequence for all seeds.
- Flags that `baseball-rules-delta.md` "steal of home" row must be updated from "not implemented" to implemented.
- Recommends seed-anchored regression test.

---

### MX-02 — Adding 4-pitch IBB sequence

**Question:**  
We want to make IBB use a proper 4-pitch sequence (matching MLB rule 5.05(b)(2)) instead of the current single-pitch event. What changes, what breaks, and what tests are needed?

**Known-answer criteria:**

- Identifies `playerOut.ts:incrementPitchCount` comment ("intentional_walk is modeled as a single pitch event") as the delta to remove.
- Identifies `src/features/gameplay/context/handlers/sim.ts:94-103` (`case "intentional_walk"`) as the simulation handler that would need to apply four `playerBall`-equivalent pitch/count updates (or a dedicated `playerIntentionalBall` path), and cites `detectDecision` in `reducer.ts` only for the prompt/availability logic.
- Flags PRNG call-order impact: 4 pitch-count increments instead of 1 will shift the RNG sequence for any seed where IBB fires — all existing save replays with IBB will diverge.
- Flags `src/features/gameplay/context/pitchSimulation/index.ts` fatigue factor: 4 pitches now counted vs 1 — small fatigue increase.
- Requires: determinism regression test, save-replay smoke test.
- Flags `baseball-rules-delta.md` IBB row needs updating.

---

### MX-03 — Adding a new route to the app

**Question:**  
We want to add a `/stats` route for in-game player stats. What is the complete planning checklist?

**Known-answer criteria:**

- Identifies route registration in `src/router.tsx` (per `docs/architecture.md`).
- Flags that new routes may need a loader function if they fetch from RxDB.
- Flags `docs/repo-layout.md` for the feature directory convention (`src/features/`).
- Lists required validation: `yarn lint`, `yarn typecheck:e2e`, `yarn build`, `yarn test:e2e`.
- Flags that if any UI is added, `@ui-visual-snapshot` agent should handle visual snapshot regeneration.
- Flags that `docs/e2e-testing.md` `data-testid` reference may need updating.
- Does NOT suggest modifying gameplay engine files.

---

## Regression schedule

| Trigger                                | Action                                                                     |
| -------------------------------------- | -------------------------------------------------------------------------- |
| Agent prompt (`pm-agent.md`) updated   | Re-run full eval suite; score all 17 questions                             |
| Gameplay engine file changed           | Re-run Category 2 (BA-\*) and any MX questions that touch the changed file |
| `baseball-rules-delta.md` updated      | Re-run all BA and MX questions that reference the changed rows             |
| New manager-mode decision type shipped | Add a new BA question for the new decision type                            |
| Monthly cadence                        | Re-run full suite; update scorecard below                                  |

---

## Scorecard template

Copy this table and fill in during each eval run.

| Date       | Evaluator | PM-01 | PM-02 | PM-03 | PM-04 | PM-05 | PM-06 | BA-01 | BA-02 | BA-03 | BA-04 | BA-05 | BA-06 | BA-07 | BA-08 | MX-01 | MX-02 | MX-03 | Suite pass? |
| ---------- | --------- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----------- |
| YYYY-MM-DD | —         | —     | —     | —     | —     | —     | —     | —     | —     | —     | —     | —     | —     | —     | —     | —     | —     | —     | —           |

Scoring codes: `P` = pass, `F` = fail, `P*` = pass with minor citation gaps.
