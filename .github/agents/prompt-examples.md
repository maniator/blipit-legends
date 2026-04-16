# Copilot Agent Prompt Examples

Copy-paste prompts for common tasks in `maniator/blipit-legends`. Prepend `@safe-refactor`, `@ui-visual-snapshot`, etc. to route to the correct agent.

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
- For each recommendation include likely cause, targeted change, expected effect,
  risk/tradeoff, and a validation plan.
- Flag any impossible baseball sequence first.
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
