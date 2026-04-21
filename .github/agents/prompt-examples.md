# Copilot Agent Prompt Examples

Copy-paste prompts for common tasks in `maniator/blipit-legends`. Prepend `@safe-refactor`, `@ui-visual-snapshot`, etc. to route to the correct agent.

---

## PM Agent

### Feature planning — new gameplay mechanic

```
@pm-agent

We want to add a "stolen base of home" mechanic. The runner on 3rd can attempt to steal home.

Produce a full implementation plan:
- Which files change and in what order (respect the module cycle order).
- PRNG call-order impact — does this add a random() call inside detectDecision?
- Save/replay compatibility risk.
- Official MLB rule vs current Ballgame behavior delta.
- Validation checklist.
- Which execution agent should carry out the implementation.
```

### Baseball rule adjudication

```
@pm-agent

Official baseball rule question: in the bottom of the 9th, bases loaded, 1 out, batter hits a
sacrifice fly. The runner on 3rd scores to put the home team ahead. Does the game end immediately
(walk-off), or do the remaining outs still need to be recorded?

Answer for both official MLB and Ballgame's implementation, with file citations.
```

### Risk review before opening a PR

```
@pm-agent

I'm about to open a PR that changes the IBB pitch-count model from 1 pitch event to 4 pitch
events (matching MLB rule 5.05(b)(2)). Give me a complete risk review:
- PRNG replay impact
- Fatigue model impact
- Save compatibility
- Files that change
- Tests required
- Which eval questions from the pm-agent-eval-suite.md would be affected
```

### Migration checklist — RxDB schema change

```
@pm-agent

We want to add a `notes: string` optional field to `SaveDoc`. Produce the complete
migration checklist before I hand off to @rxdb-save-integrity.
```

### PR description draft

```
@pm-agent

Draft a PR description for a change that: (1) adds a `stolenBasesAttempted` counter to
State in gameStateTypes.ts, (2) increments it in stealAttempt.ts on both success and
caught-stealing paths, and (3) bumps the saves schema version with a migration that
defaults the counter to 0.

Follow the repo PR description format and include a risk summary.
```

---

## Baseball manager (realism tuning)

### Review simulation logs and propose realism tuning

```
@baseball-manager

Review this completed game log and identify what should change to make outcomes feel
more like real baseball.

Requirements:
- Prioritize findings into must-fix vs nice-to-have.
- Cite concrete evidence from the log for each finding.
- For each recommendation, include likely cause, targeted change, expected effect,
  risk/tradeoff, and a validation plan.
- Flag any impossible baseball sequence first.
```

### Validate realism after a gameplay change

```
@baseball-manager

A gameplay change was just merged: [describe change, e.g., "IBB now counts as 4 pitch
events instead of 1"].

Here are before/after game logs: [paste logs]

Review whether the change improved realism, identify any new unrealistic patterns
introduced, and flag anything that needs a follow-up `@pm-agent` plan.
```

---

## PM Agent + Baseball Manager (combined planning ↔ validation)

### Full gameplay tuning cycle

```
Step 1 — plan with @pm-agent:

@pm-agent

[Describe the issue, e.g., "walk rate is 3× MLB average in logs."]

Produce a full implementation plan:
- Which file(s) and parameter(s) to adjust (cite file + line range).
- PRNG replay impact of the change.
- Save compatibility.
- Validation checklist.

Step 2 — validate with @baseball-manager after the fix is applied:

@baseball-manager

After fixing [change description], here are the new game logs: [paste logs]

Confirm walk rate improved toward realistic MLB range (~8–9% of PAs), check that
strikeout rate hasn't regressed, and flag any new impossible sequences.
```

---

## Senior Lead

### Request a technical review for a high-value change

```
@senior-lead

SENIOR LEAD REVIEW REQUEST
Change objective: Add a `pitcherEra` field to SaveDoc so career stats can display ERA per saved game.
Business priority: P2
Acceptance criteria: ERA is persisted with each save; existing saves load without error; export/import unchanged.
Rollout window: Next sprint
Risk flags already identified:
- RxDB schema change required (SaveDoc.pitcherEra: number)
- Migration needed (default 0 for existing docs)
- FNV-1a export signature changes for newly exported bundles when the header shape changes, even though older exports should still verify/import
Execution agent(s): @rxdb-save-integrity
```

### Domain agent escalation to Senior Lead

```
@senior-lead

I am @rxdb-save-integrity. I have completed the following work and need your sign-off before merge:

Change: Bumped savesSchema.version from 3 → 4, added pitcherEra: number field, added
migrationStrategies v4 entry (oldDoc.pitcherEra ?? 0).

Evidence:
- Schema diff: src/storage/db.ts lines 88–102 (version bump + field addition)
- Migration: src/storage/db.ts lines 140–148 (never throws, defaults 0)
- Upgrade-path test: src/storage/db.test.ts "schema migration: v3 → v4" (passes)
- save-load.spec.ts: all 12 assertions pass
- import.spec.ts: all 8 assertions pass, FNV-1a signature verifies correctly

Please issue your technical verdict.
```

### PM ↔ Senior Lead confirmation flow — full example

```
Step 1: @pm-agent sends review request

@senior-lead

SENIOR LEAD REVIEW REQUEST
Change objective: Rewrite advanceRunners.ts to support extra-base hit runner advancement.
Business priority: P1
Acceptance criteria: Runners advance correctly on doubles and triples; existing seed replays unchanged; all E2E pass.
Rollout window: This release
Risk flags already identified:
- PRNG call order may change if new random() calls are added
- advanceRunners is a high-risk area (historical impossible-state bugs)
- Regression tests needed for doubles/triples runner advancement
Execution agent(s): @simulation-correctness

---

Step 2: @senior-lead responds

SENIOR LEAD VERDICT
Verdict: REQUEST_CHANGES
Risk class: High
Go/no-go recommendation: Go with conditions

Technical summary:
advanceRunners.ts is a pure function called on every scoring event; any new random() call here
will shift the PRNG sequence for every existing seed. The change is feasible but requires a seed
replay audit before and after. The module cycle order is safe (advanceRunners imports from nothing
later in the chain).

Blocking issues:
- Must provide before/after seed replay trace showing identical call counts for non-affected paths.
- Must add seed-anchored regression tests for at least 3 double/triple scenarios.

Required follow-ups:
- Update docs/agent/baseball-rules-delta.md with the new advancement model.

Recommended execution agent: @simulation-correctness

---

Step 3: @pm-agent confirms

PM DISPOSITION
Disposition: SHIP — conditions met; @simulation-correctness to proceed with seed audit requirement.
```

### Direct review — security-impacting CI change

```
@senior-lead

SENIOR LEAD REVIEW REQUEST
Change objective: Bump the Playwright container image in playwright-e2e.yml from v1.58.2-noble to v1.60.0-noble.
Business priority: P2
Acceptance criteria: All E2E tests pass on the new image; visual snapshot baselines regenerated.
Rollout window: Before next release
Risk flags already identified:
- Container image change affects all snapshot baselines
- Must regenerate all visual snapshots after bump
Execution agent(s): @ci-workflow + @e2e-test-runner

Please provide a security and supply-chain sign-off for this image bump.
```

---

## Safe refactor

### Behavior-preserving reducer refactor

```
@safe-refactor

Stage: extract sim-action handlers from reducer.ts into separate domain handler files
(e.g., src/context/sim.ts, src/context/lifecycle.ts).

Requirements:
- Action dispatch order and post-processing must be identical before and after.
- Preserve walkoff check, decision log, and strikeout log ordering.
- Add handler-level unit tests + root orchestration smoke test.
- Do not fix any bugs or change any UI in this stage.
```

### Extract a helper without behavior change

```
@safe-refactor

Extract the run-scoring loop from hitBall.ts into a pure helper scoreRunners(baseLayout, runsNeeded).
Behavior must be identical. Add a focused unit test for scoreRunners with multiple base configurations.
```

---

## UI / Visual snapshots

### Font or global style change + snapshot regen

```
@ui-visual-snapshot

Change the app font from system-ui to "Inter" (loaded via Google Fonts).
Ensure button/input/select/textarea inherit the font.
After layout validation across all viewport projects, trigger the update-visual-snapshots
workflow on this branch to regenerate baselines inside the CI Playwright container.
Do NOT run yarn test:e2e:update-snapshots locally — local rendering differs from the container.
```

### New Game dialog mobile layout fix

```
@ui-visual-snapshot

The Play Ball button is clipped on iphone-15 (393×659). Fix the NewGameDialog layout so the
CTA is fully visible without scrolling on all mobile viewports. Use dvh for max-height.
Validate responsive-smoke.spec.ts passes on all 7 projects.
```

---

## Simulation correctness

### Impossible batting stats bug audit

```
@simulation-correctness

Seed: abc123 — after inning 4, the away team's batter shows 3 hits in 1 AB.

1. Reproduce with seed abc123 and capture the full state at the point of inconsistency.
2. Identify the root cause (lineup indexing? home/away mapping? stat accumulation?).
3. Fix with a minimal, targeted change.
4. Add a seed-anchored regression test that pins this seed and asserts the batting line is valid.
```

### Walkoff fires at wrong time

```
@simulation-correctness

Seed: xyz789 — walkoff triggers at the end of the top of the 9th, not the bottom.

Reproduce, identify the inning/half check in checkWalkoff (context/gameOver.ts), fix minimally,
and add a regression test that asserts walkoff can only fire in the bottom half when home team leads.
```

---

## CI / Workflow

### Add Playwright test sharding

```
@ci-workflow

Add matrix sharding to playwright-e2e.yml to split Chromium tests across 2 shards.
Requirements:
- Do NOT shard the determinism project.
- Make artifact names shard-aware: playwright-artifacts-{browser}-{shardIndex}.
- Keep fail-fast: false.
- Add a YAML comment explaining why determinism is excluded from sharding.
```

### Update Playwright container image version

```
@ci-workflow

Bump the Playwright container image in playwright-e2e.yml from v1.58.2-noble to v1.60.0-noble.
After the bump, regenerate all visual snapshot baselines using the new image.
Add a comment in the workflow YAML noting the image version and the snapshot-regen requirement.
```

---

## RxDB save integrity

### Export/import audit after event schema change

```
@rxdb-save-integrity

A new field (decisionType) was added to EventDoc. Audit the export/import flow:
1. Verify exportRxdbSave includes the new field.
2. Verify importRxdbSave handles bundles without the field (backward compat).
3. Test malformed JSON and corrupted FNV-1a signature payloads.
4. Update sample-save.json fixture if the format changed.
```

### Add a new field to the saves schema

```
@rxdb-save-integrity

Add a `tags: string[]` field to SaveDoc (src/storage/types.ts) and savesSchema (src/storage/db.ts).

Requirements:
- Bump savesSchema.version by 1 (e.g. 1 → 2).
- Add migrationStrategies entry for the new version: pure function, never throws,
  sets tags to [] for all existing docs (oldDoc.tags ?? []).
- Add an upgrade-path unit test: create a v(N-1) DB, insert a legacy save,
  close, reopen with new code, assert tags is [] and all other fields are intact.
- Export/import FNV-1a signature must still verify correctly after the change.
- save-load.spec.ts and import.spec.ts must still pass.
```

### Batch appendEvents performance improvement

```
@rxdb-save-integrity

The appendEvents call fires too frequently during autoplay. Batch events into groups of 10
before writing to RxDB. Verify:
- No events are lost under rapid autoplay (1000+ pitches).
- idx values remain monotonically increasing.
- progressIdx in the saves doc stays accurate.
- save-load.spec.ts and import.spec.ts still pass.
```

---

## E2E test runner

### Run a single failing spec inside the container

```
@e2e-test-runner

Run e2e/tests/smoke.spec.ts against the desktop project inside the Playwright
Docker container and report which assertions fail. Do not modify any app code.
```

### Run all E2E tests (full suite)

```
@e2e-test-runner

Run the full Playwright E2E suite inside mcr.microsoft.com/playwright:v1.58.2-noble.
Report any failures with the test name, project, and assertion message.
```

### Regenerate visual snapshot baselines after a UI change

```
@e2e-test-runner

The NewGameDialog layout was updated. Regenerate the visual snapshot baselines for
all affected projects inside the Playwright Docker container and commit the updated
PNGs directly to this branch.

Requirements:
- Run --update-snapshots for Chromium projects (desktop, pixel-7, pixel-5).
- Run --update-snapshots for WebKit projects (tablet, iphone-15-pro-max, iphone-15).
- Verify all visual tests pass after regeneration.
- Commit only the PNGs that changed; do not commit unrelated snapshot diffs.
```

### Add a new E2E test using a fixture

```
@e2e-test-runner

Add an E2E test for the manager decision panel that uses the existing
pending-decision.json fixture instead of waiting for autoplay.

Requirements:
- Use loadFixture(page, "pending-decision.json") to enter the game state instantly.
- Assert the decision panel is visible and the countdown bar renders.
- Run the new test inside the Docker container to confirm it passes on desktop.
- No test.setTimeout() — the fixture makes setup instant.
```

### Debug a flaky test

```
@e2e-test-runner

The test "saves modal opens" in modals.spec.ts is flaking on WebKit.
Run it inside the Playwright Docker container with --trace=on and --repeat-each=5
on the tablet project, then inspect the trace artifacts to identify the root cause.
```

### Add a fixture for a specific game state

```
@e2e-test-runner

Add an E2E save fixture for testing the [X] UI element.

Requirements:
- The fixture must put the game in state [describe state: inning N, pendingDecision=Y, RBI on board, etc.].
- Use the Node.js FNV-1a signing approach defined in the "Authoring a new fixture" section of
  `../docs/e2e-testing.md` (use Node, not Python —
  Python json.dumps escapes non-ASCII differently from JS JSON.stringify, causing sig mismatches).
- The `sig` field must be computed as fnv1a("ballgame:rxdb:v1" + JSON.stringify({header, events})).
- Add a test that calls loadFixture(page, "new-fixture.json") and asserts [expected UI element] is visible.
- Remove any test.setTimeout() that was previously needed for the long autoplay wait.
- Document the fixture in the fixtures table in `../docs/e2e-testing.md`.
```

### Convert a slow E2E test to use a fixture

```
@e2e-test-runner

The test "[test name]" in [spec file] has a [N]s timeout waiting for autoplay to reach [state].
Convert it to use a pre-crafted save fixture instead.

Requirements:
1. Identify the minimum game state needed (inning, pendingDecision, playLog entries, etc.).
2. Generate a fixture JSON using the Node.js FNV-1a pattern (use Node, not Python —
   Python json.dumps escapes non-ASCII differently from JS JSON.stringify, causing sig mismatches).
3. Replace startGameViaPlayBall + long waitForLogLines / toBeVisible timeout with loadFixture(page, "fixture.json").
4. Remove test.setTimeout() — the fixture makes the test instant.
5. Update the fixtures table in `../docs/e2e-testing.md`.
6. Confirm the test still asserts the same behavior it did before.
```

---

## UX Design Lead

### UX heuristic review of a screen

```
@ux-design-lead

Perform a heuristic review of the <screen name> screen (route: <route>).

Apply Nielsen's 10 usability heuristics and WCAG 2.2 AA checklist.

Output:
- A prioritized issue list (P0 / P1 / P2) with: heuristic/criterion, problem description,
  component file path, and proposed fix.
- Flag any contrast failures with the specific theme.colors.* token and computed ratio.
- Note any missing ARIA roles or keyboard navigation gaps.
- Include which user persona(s) are most affected by each P0/P1 issue.
```

### Design spec for a new feature

```
@ux-design-lead

Produce a full design spec for: <feature description>.

Requirements:
- State the user goal and non-goals.
- Name the relevant persona(s) and conduct proxy-user interviews as needed.
- Document the primary flow and all edge-case flows.
- Include a rudimentary mockup (ASCII wireframe for layout, Mermaid diagram for flow/state).
- Cover all states: default, loading, empty, error, success.
- Finalize all copy (American English, sentence case buttons, standard baseball terminology).
- Document accessibility: keyboard path, focus order, ARIA roles, contrast vs theme.colors.* keys.
- Describe responsive behavior at each of the 6 Playwright viewports.
- Cite all design tokens by theme key — no raw hex values.
- Predict which visual snapshot PNGs will change.
- End with the pre-handoff checklist.
```

### Add a design token to the style guide

```
@ux-design-lead

We need a new design token for: <role description, e.g., "warning state background for form fields">.

Requirements:
- First check whether any existing token in docs/style-guide.md already covers this need.
- If a new token is truly needed, propose: token name, value (using theme.colors.* as reference),
  role, usage examples, and the exact docs/style-guide.md section to update.
- Verify the proposed value meets WCAG 2.2 AA contrast requirements against any text that will
  appear on top of it.
- Commit the docs/style-guide.md update locally and return the commit SHA.
```

### Accessibility audit of a flow

```
@ux-design-lead

Perform a WCAG 2.2 AA accessibility audit of the <flow name> flow
(e.g., "new game setup → game play → game over").

Requirements:
- Walk through the complete flow step-by-step.
- For each step, check: keyboard operability (2.1.1), visible focus (2.4.7),
  focus order (2.4.3), contrast (1.4.3 / 1.4.11), name/role/value (4.1.2),
  and error identification (3.3.1).
- Output a prioritized issue list (P0 = hard WCAG AA failure, P1 = AA advisory, P2 = polish).
- For each issue: cite the WCAG criterion, describe the problem with the component file path,
  and propose the specific fix.
- Flag which persona(s) are most affected (e.g., screen reader user, keyboard-only user).
- If a proxy-user interview with a persona agent would add value, conduct it and include the digest.
```

---

## User persona interviews

### Casual watcher — friction audit

```
@user-casual-watcher

I'm designing the <screen/feature>. As a casual user who just wants to watch a game on your phone:

1. When you land on this screen for the first time, what is your first reaction?
2. How many taps does it take to get to a live game from here? Is that too many?
3. Is there anything on this screen that would confuse or frustrate you?
4. Is there anything you'd expect to see that's missing?
5. Would you feel confident closing and reopening the app and finding your game again?
```

### Manager-mode strategist — decision panel review

```
@user-manager-strategist

I'm designing the <decision panel / manager-mode feature>. As someone who actively manages
games and wants to make smart in-game decisions:

1. Does the decision panel show you the information you need to decide? What's missing?
2. Is the countdown timer long enough to think through the options?
3. Are the available options clear? Do you understand what each one does?
4. After you make a decision, can you tell what happened as a result?
5. Does this feel like a realistic manager decision for this game situation?
```

### Custom-team builder — editor ergonomics

```
@user-custom-team-builder

I'm designing the <team editor / import flow>. As a power user who builds and manages
custom rosters:

1. Is the lineup/bench/pitcher layout efficient for entering a full 25-man roster?
2. When an import fails, does the error tell you exactly what to fix and where?
3. Can you drag players between sections reliably? Any spots that feel finicky?
4. After saving, are you confident your changes were actually persisted?
5. Is the export format something you could open and understand without help?
```

### Save curator — save management review

```
@user-save-curator

I'm designing the <saves page / export-import flow>. As someone who carefully manages
their saved games and moves them between devices:

1. Looking at the saves list, can you identify each game without opening it?
2. Is it clear which saves are in progress vs. completed?
3. Before you delete a save, does the UI make you feel confident you won't lose something important?
4. When you import a save file, do you know what you're getting before you commit?
5. What information would make you feel most confident that your saves are safe?
```

### Stats fan — stats page review

```
@user-stats-fan

I'm designing the <career stats / team stats page>. As a serious baseball fan who
reads Baseball-Reference:

1. Are all the column abbreviations correct and standard? Call out any that are wrong or missing.
2. Is the table dense enough, or does it feel dumbed-down?
3. On mobile, can you read the full stat line without horizontal scrolling being painful?
4. Are there any stats you'd expect to see that aren't here?
5. Do the number ranges look realistic for a simulated baseball season?
```
