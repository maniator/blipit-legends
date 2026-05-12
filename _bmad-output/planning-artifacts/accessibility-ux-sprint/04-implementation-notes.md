# 04 — Implementation Notes

Engineering-level notes for the future implementing agent (Amelia). Read alongside `03-sprint-stories.md`.

---

## Repository Conventions to Respect

These are non-negotiable per the project's `.github/copilot-instructions.md` and Winston's CR constraint:

1. **All colors via theme tokens** — `${({ theme }) => theme.colors.<key>}`. No hardcoded hex.
2. **All breakpoints via `mq` helpers** — `${mq.mobile} { ... }`, etc. No raw `@media` strings.
3. **Use `dvh` not `vh`** for any modal/dialog `max-height`.
4. **`@storage/*` aliases** — never relative paths across directories.
5. **`React.FunctionComponent` with no type param** for zero-prop components.
6. **`import * as React from "react"`** — not the default import.
7. **Styled-components transient props** — `$propName` prefix, generic-typed: `styled.div<{ $active: boolean }>`.
8. **Run `yarn lint:fix` after adding imports** — auto-sorts.
9. **Run `yarn format` before every `report_progress`** — Husky pre-commit is bypassed in agent sandbox.
10. **PR description must follow `.github/pull_request_template.md`** with `## Summary`, `## Changes`, `## Testing`, `## Risks` H2 sections.

---

## File Map by Story

### Story 1.1 + 1.2 (F1 Audit + Doc Rewrite)

**Read:**

- `src/shared/theme.ts` — token source of truth
- `src/styled.d.ts` — type extension binding theme to styled-components
- `docs/style-guide.md` — drift target
- `docs/repo-layout.md` — to identify which files consume which tokens

**Write:**

- `_bmad-output/planning-artifacts/accessibility-ux-sprint/audit-results/` (new directory) — audit output as markdown tables
- `docs/style-guide.md` — full rewrite

**Search commands:**

```bash
# All hex in src
rg -i '#[0-9a-f]{3,8}\b' src/

# All hex in docs
rg -i '#[0-9a-f]{3,8}\b' docs/

# Find theme token consumers
rg "theme\.colors\." src/

# Find hardcoded color names (suspicious)
rg -i '#(00ced1|2ecc71|0fc97f|44cc88)' src/  # known-old aquamarine/greens
```

### Story 1.3 (F1 CI Guardrail)

**Create:**

- `scripts/check-style-guide-drift.ts` (the script itself lives in `scripts/`)
- `src/__tests__/check-style-guide-drift.test.ts` (test lives under `src/` so Vitest discovers it; `root: "src"`)
- `src/__tests__/fixtures/good-styleguide.md`
- `src/__tests__/fixtures/bad-styleguide.md`

**Modify:**

- `package.json` — add `"check:style-guide": "<runner> scripts/check-style-guide-drift.ts"`, chain into `"lint"`

  > **⚠️ Dependency note:** The repo currently has **no `tsx` dependency** and `scripts/` contains only `.mjs`/`.cjs` utilities. The implementing agent must choose one of two paths:
  >
  > - **(a) Add `tsx` as a devDependency** — run `yarn add -D tsx`, then use `"check:style-guide": "tsx scripts/check-style-guide-drift.ts"`. Document the new dependency in this plan and get architect sign-off (Winston).
  > - **(b) Write the script as plain `.mjs`** — rename to `scripts/check-style-guide-drift.mjs` and use `"check:style-guide": "node scripts/check-style-guide-drift.mjs"`. No new dependency required; simpler path.
  >
  > Prefer option (b) unless TypeScript types are strictly needed in the script.

**Reference patterns from existing scripts:**

- Existing scripts in `scripts/` use `.mjs` or `.cjs` (e.g., `check-spec-sizes.mjs`, `ensure-docker-snapshot-update.cjs`) — **not** `.ts`. Use those as template if going with option (b).
- The test lives under `src/__tests__/` (not alongside the script) because Vitest `root: "src"` will not discover tests outside `src/`

### Story 2.1 (F3 Touch Targets)

**Find affected files:**

```bash
# Locate HelpButton
rg "HelpButton" src/ --files-with-matches

# Locate close buttons
rg "(close|Close|✕|×)" src/features/*/components/*/styles.ts

# Save card actions
rg "Load|Export|Delete" src/features/saves/components/
```

**Likely files:**

- `src/shared/components/HelpButton/styles.ts` (or similar)
- `src/features/help/components/InstructionsModal/styles.ts` — close button
- `src/features/saves/components/SavesPage/` and `SavesModal/` — action buttons

**Pattern to apply:**

> **⚠️ SKETCH VALUES — verify neighbor gap before using**
>
> The `inset` value below (`-10px`) is illustrative only. **Before using any inset value, check that the adjacent flex `gap` satisfies `gap ≥ 2 × |inset|`.** If it does not, either reduce the inset or increase the gap. Using an inset value larger than half the gap will create overlapping hit areas that mis-route taps to the wrong button. See `docs/style-guide.md` § "Touch-target hit-area expansion" for the full rule and pre-PR checklist item.
>
> Sprint 1 lesson (retro C1/C2): the initial `HelpButton` used `-10px` from this sketch, which caused two CI-breaking reviewer findings and required two fix rounds.

```ts
const HelpButton = styled.button`
  width: 25px;
  height: 25px;
  position: relative;
  /* expand hit area to 45×45 without altering visible layout */
  &::before {
    content: "";
    position: absolute;
    inset: -10px; /* ⚠️ SKETCH — verify gap ≥ 2 × |inset| before using; see note above */
    /* DO NOT add background/border here */
  }
`;
```

**Test the hit area:**

```ts
// E2E test snippet — two-part hit-area validation
// NOTE: boundingBox() is based on the element's layout box and will NOT include an
// absolutely-positioned ::before pseudo-element. Use computed-style + edge-probe instead.

const button = page.getByTestId("home-help-button");
// NOTE: "home-help-button" is the stable data-testid on HomeScreen.
// The instructions modal that opens is "instructions-modal" (no close-button testid yet —
// Sprint 1 must add one; see docs/e2e-testing.md for the testid registry).

// Part 1: validate ::before inset via computed styles
const inset = await button.evaluate((el) => {
  const s = window.getComputedStyle(el, "::before");
  return { top: parseFloat(s.top), left: parseFloat(s.left) };
});
// ⚠️ SKETCH value: replace -10 with the actual verified inset for the button you're testing.
// Always use the minimum (mobile) breakpoint value — see docs/e2e-testing.md § responsive CSS assertions.
expect(inset.top).toBeLessThanOrEqual(-10); // 25px base + 10px each side ≥ 44px — VERIFY vs. neighbor gap first
expect(inset.left).toBeLessThanOrEqual(-10);

// Part 2: edge-probe — click outside visual bounds, confirm handler fires
const box = await button.boundingBox();
let clicked = false;
await page.exposeFunction("onHelpClicked", () => {
  clicked = true;
});
await button.evaluate((el) =>
  el.addEventListener("click", () =>
    (window as unknown as Record<string, () => void>).onHelpClicked(),
  ),
);
// probe 8px to the RIGHT of the visual right edge (inside the ::before expanded zone)
// NOTE: avoid box.x - 8 — that can produce negative X if the button is near the viewport
// left edge, making the test flaky. The ::before expands in all directions so probing
// right is equally valid and viewport-safe.
await page.mouse.click(box!.x + box!.width + 8, box!.y + box!.height / 2);
expect(clicked).toBe(true);
```

### Story 3.1 (F6 Tier 1 Contrast)

**Modify:**

- `src/shared/theme.ts` — bump 5 token values

**Verify with:**

```bash
# Run all visual snapshots (use the safety wrapper — never call Playwright flags directly)
yarn test:e2e:update-snapshots  # enforces Docker container via scripts/ensure-docker-snapshot-update.cjs
```

**For axe-core integration**, check whether the project already has axe-core wired into Playwright. If not, the simplest add is:

```ts
import AxeBuilder from "@axe-core/playwright";

test("home page has no contrast violations", async ({ page }) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page }).withTags(["wcag2aa", "wcag2aaa"]).analyze();
  const contrastViolations = results.violations.filter((v) => v.id === "color-contrast");
  expect(contrastViolations).toEqual([]);
});
```

If `@axe-core/playwright` is not in dependencies, raise to John for an `axe-core` adoption decision before adding it.

### Story 4.1 (F9 League entry-state regression guard)

**Read:**

```bash
rg "league-play-teaser|home-browse-leagues-button|home-continue-season-button" src/ e2e/tests
```

**Primary files:**

- `src/features/gameplay/components/HomeScreen/index.tsx`
- `src/features/gameplay/components/HomeScreen/HomeScreen.test.tsx`
- `e2e/tests/home.spec.ts`
- `e2e/tests/league.spec.ts`

Focus on regression coverage and stale-doc cleanup; do **not** implement pre-v1 lock-icon/"coming soon" behavior.

### Story 5.1 (F10 lang regression guard)

**Read/verify:**

- `src/index.html`

`src/index.html` currently includes `<html lang="en">`; story work is guard-test coverage only.

---

## Snapshot Cascade Mitigation (Critical for Story 3.1)

### Per-spec snapshot directories (already known)

Visual snapshots live in:

- `e2e/tests/layout.spec.ts-snapshots/`
- `e2e/tests/visual/*.visual.spec.ts-snapshots/`
- Possibly per-component snapshot dirs

### Regeneration rules

1. **Never bulk-regenerate** — review each diff individually
2. **Snapshot regen MUST run inside Docker** — `mcr.microsoft.com/playwright:v1.58.2-noble`
3. **Route to `e2e-test-runner` operational specialist** for the regen run — do not do it locally outside the container
4. **Per-project regen** — if only certain projects (e.g. mobile) are affected, regen only those

### Mid-sprint guardrail

If more than **15 snapshots** break from the F6 Tier 1 token bumps:

1. STOP work on F6
2. Raise to John (PM) immediately
3. Decide whether to: (a) further slice F6 Tier 1 down to fewer tokens, (b) accept the larger snapshot churn, or (c) defer F6 entirely

The 15-snapshot ceiling is John's explicit re-triage trigger from cross-talk round 2.

---

## Test Strategy Pointers (see `05-test-strategy.md` for detail)

- **Shift-left mindset enforced** — every story includes a unit OR E2E test that prevents regression
- **Use stable `data-testid` selectors** — never CSS class or text content
- **Component-level CSS assertions** for the `::before` pseudo-element pattern (use `getComputedStyle()`)

---

## Pre-PR Checklist (run before requesting Winston CR)

```bash
yarn lint                       # includes eslint AND check:style-guide
yarn typecheck
yarn typecheck:e2e
yarn test                       # vitest unit tests
yarn check:circular-deps        # madge — no new cycles
# Visual snapshot updates done in Docker via e2e-test-runner specialist
```

PR body MUST include:

- `## Summary` — what changed and why (multi-paragraph prose)
- `## Changes` — bulleted list of file-level changes
- `## Testing` — what tests were added/updated, axe-core report attached
- `## Risks` — snapshot churn count, any deferred work, contrast outliers found

---

## Routing Reminders

- **Architectural CR** → `bmad-agent-architect` (Winston) → CR menu — REQUIRED for this sprint (touches design tokens)
- **WCAG sign-off** → `bmad-agent-ux-designer` (Sally) — Amelia provides axe-core/Lighthouse evidence
- **Snapshot regen** → `e2e-test-runner` operational specialist (Docker container)
- **F5 stadium-authenticity sign-off** (Sprint 2 only) → `bmad-agent-baseball-manager` (Buck)

---

## Useful Existing Test Patterns

From the project conventions:

- **Vitest tests** are typically co-located with source files, but CI-guardrail/script tests (like the style-guide drift test) must live under `src/__tests__/` so that Vitest discovers them via `root: "src"` and repo-wide coverage thresholds apply
- **`fake-indexeddb/auto`** is globally polyfilled via `src/test/setup.ts` (loaded by Vitest `setupFiles`) — do **not** add a per-file import in standard `yarn test` runs; it is already active
- **For RxDB tests**: use `makeSaveStore(_createTestDb(getRxStorageMemory()))` — the polyfill is already active. Only import `fake-indexeddb/auto` explicitly in standalone scripts or processes that run **outside** Vitest and therefore bypass `src/test/setup.ts`.
- **E2E tests** in `e2e/tests/` use `@playwright/test` against a `vite preview` build (production, not dev server)

---

## What NOT to do

- ❌ Don't add new linting/build/test infrastructure beyond what's specified (only `check-style-guide-drift.ts` and `axe-core` if not present)
- ❌ Don't refactor unrelated code while you're in there
- ❌ Don't change the SVG logo (F2) in this sprint — it's deferred
- ❌ Don't add light mode support (F7) — roadmap
- ❌ Don't fix font sizes (F4) — Sprint 2
- ❌ Don't bulk-regenerate visual snapshots
- ❌ Don't use `git push` — use `report_progress` and `create_pull_request` tools
- ❌ Don't merge or rebase from a shallow repo — fetch unshallow first
