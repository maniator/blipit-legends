# 05 — Test Strategy

Shift-left test additions for Sprint 1. Every story produces a regression guardrail. Unit tests preferred over E2E where possible (per repo testing-practices memory).

---

## Guiding Principles

1. **Shift-left** — add unit tests for edge cases rather than relying on E2E coverage
2. **Stable selectors** — use `data-testid` attributes, not CSS classes or visible text
3. **Each finding must produce at least one automated guardrail** — manual verification is not sufficient
4. **Visual snapshots are review-each, not bulk-regen** (see `04-implementation-notes.md`)

---

## Per-Story Test Additions

### Story 1.1 + 1.2 (F1 Audit + Doc Rewrite) — no automated test

The CI guardrail (Story 1.3) IS the test. Manual sign-off from Sally.

### Story 1.3 (F1 CI Guardrail) — fixture-based unit test

**File:** `src/__tests__/check-style-guide-drift.test.ts` (must live under `src/` — Vitest `root: "src"` does not discover tests outside this directory)

````ts
import { describe, it, expect } from "vitest";
import { checkDrift } from "../../scripts/check-style-guide-drift";

describe("check-style-guide-drift", () => {
  it("passes when doc matches theme", async () => {
    const result = await checkDrift({
      themePath: "src/__tests__/fixtures/theme.fixture.ts",
      docPath: "src/__tests__/fixtures/good-styleguide.md",
    });
    expect(result.driftCount).toBe(0);
  });

  it("fails when doc references hex absent from theme", async () => {
    const result = await checkDrift({
      themePath: "src/__tests__/fixtures/theme.fixture.ts",
      docPath: "src/__tests__/fixtures/bad-styleguide.md",
    });
    expect(result.driftCount).toBeGreaterThan(0);
    expect(result.violations).toContainEqual(expect.objectContaining({ kind: "hex-not-in-theme" }));
  });

  it("ignores hexes inside style-guide-ignore blocks", async () => {
    /* fixture with <!-- style-guide-ignore --> markup */
  });

  it("ignores hexes inside fenced 'bad' code blocks", async () => {
    /* fixture with ```bad ... ``` */
  });

  it("normalizes 3-digit hexes to 6-digit before comparison", async () => {
    /* fixture: theme has #ffffff, doc has #fff — should pass */
  });

  it("validates dotted-path token references", async () => {
    /* fixture: doc references theme.colors.nonexistent.foo — should fail */
  });
});
````

**Acceptance:** All 6 tests pass; coverage ≥ 90% lines on the `checkDrift` function. Test lives under `src/__tests__/` so Vitest discovers it automatically via `root: "src"` and the repo-wide coverage thresholds apply. The script itself (`scripts/check-style-guide-drift.ts`) imports from `src/shared/theme.ts` — only the exported `checkDrift` function needs unit coverage.

### Story 2.1 (F3 Touch Targets)

**E2E test:** `e2e/tests/touch-targets.spec.ts` (new)

```ts
import { test, expect } from "@playwright/test";

const MIN_TARGET = 44;

const BUTTONS_TO_VERIFY = [
  // Existing stable testids (docs/e2e-testing.md):
  { route: "/", testid: "home-help-button" }, // HomeScreen help icon
  { route: "/saves", testid: "load-save-button" }, // first save card
  { route: "/saves", testid: "export-save-button" },
  { route: "/saves", testid: "delete-save-button" },
  // close buttons require opening a modal first (see separate test below)
];

for (const { route, testid } of BUTTONS_TO_VERIFY) {
  test(`${testid} has ≥ ${MIN_TARGET}×${MIN_TARGET} tap area`, async ({ page }) => {
    await page.goto(route);
    const el = page.getByTestId(testid);

    // Part 1: verify ::before inset via computed styles
    // (boundingBox() only reflects the element's layout box — it does NOT include an
    // absolutely-positioned ::before pseudo-element, so it cannot validate expanded hit area)
    const inset = await el.evaluate((node) => {
      const s = window.getComputedStyle(node, "::before");
      return { top: parseFloat(s.top), left: parseFloat(s.left) };
    });
    // Inset must be ≤ -10px to guarantee ≥ 44px effective target on a ~24–32px visual element
    // (a value of -1 would be technically negative but nowhere near sufficient)
    expect(inset.top).toBeLessThanOrEqual(-10); // expanding upward by at least 10px
    expect(inset.left).toBeLessThanOrEqual(-10); // expanding left by at least 10px

    // Part 2: edge-probe — click outside visual bounds, confirm handler fires
    const box = await el.boundingBox();
    expect(box).not.toBeNull();
    let clicked = false;
    await page.exposeFunction(`onClicked_${testid}`, () => {
      clicked = true;
    });
    await el.evaluate(
      (node, fn) =>
        node.addEventListener("click", () =>
          (window as unknown as Record<string, () => void>)[fn](),
        ),
      `onClicked_${testid}`,
    );
    // probe 8px to the RIGHT of the visual right edge (inside the ::before expanded zone)
    // NOTE: avoid probing left (box.x - 8) — that can produce a negative X if the element
    // is near the viewport left edge, making the test flaky. The ::before expands in all
    // directions so probing right is equally valid and viewport-safe.
    await page.mouse.click(box!.x + box!.width + 8, box!.y + box!.height / 2);
    expect(clicked).toBe(true);
  });
}

test("modal close button has ≥ 44×44 effective tap area", async ({ page }) => {
  await page.goto("/");
  // "home-help-button" opens the instructions dialog (data-testid="instructions-modal").
  // The close button inside the modal currently has NO stable testid — Sprint 1 must add
  // data-testid="instructions-modal-close-button" and register it in docs/e2e-testing.md.
  await page.getByTestId("home-help-button").click();
  const close = page.getByTestId("instructions-modal-close-button");

  // Validate ::before inset (see comment above re boundingBox limitation)
  const inset = await close.evaluate((node) => {
    const s = window.getComputedStyle(node, "::before");
    return { top: parseFloat(s.top), left: parseFloat(s.left) };
  });
  expect(inset.top).toBeLessThanOrEqual(-10);
  expect(inset.left).toBeLessThanOrEqual(-10);
});
```

**Unit test (component-level):** assert the `::before` pseudo-element exists and has correct inset

```ts
// In HelpButton.test.tsx
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { theme } from "@shared/theme";
import { HelpButton } from "./index";

test("HelpButton has hit-area expansion via ::before", () => {
  render(
    <ThemeProvider theme={theme}>
      <HelpButton data-testid="help-button" />
    </ThemeProvider>,
  );
  const button = screen.getByTestId("help-button");
  const beforeStyles = window.getComputedStyle(button, "::before");
  expect(beforeStyles.position).toBe("absolute");
  // jsdom may not return inset reliably — check top/right/bottom/left individually
  const inset = parseInt(beforeStyles.top, 10);
  expect(inset).toBeLessThanOrEqual(-10);
});
```

**Note:** jsdom has limited pseudo-element support. If the unit-level `getComputedStyle(el, "::before")` assertion proves unreliable, rely on the E2E edge-probe (`page.mouse.click()` at coordinates outside the visual element bounds) as the primary validation. Do NOT fall back to `boundingBox()` assertions — `boundingBox()` reflects only the element's layout box and will not include the overflowing `::before` hit-area expansion.

### Story 3.1 (F6 Tier 1 Contrast)

> **Dependency note:** `@axe-core/playwright` is **not** currently in `package.json`. Before implementing this test, add it as a dev dependency (`yarn add -D @axe-core/playwright`) and route that decision through Amelia → Winston CR (since it is a new E2E dependency). Alternatively, use Lighthouse CLI (already available in the Playwright Docker container) for contrast auditing without adding a new package.

**E2E test (axe-core):** `e2e/tests/accessibility-contrast.spec.ts` (new)

```ts
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const SURFACES = [
  { name: "home", route: "/" },
  { name: "exhibition setup", route: "/exhibition/new" },
  { name: "saves list", route: "/saves" },
];

for (const { name, route } of SURFACES) {
  test(`${name} has zero color-contrast violations`, async ({ page }) => {
    await page.goto(route);
    const results = await new AxeBuilder({ page }).withTags(["wcag2aa"]).include("body").analyze();
    const contrastViolations = results.violations.filter((v) => v.id === "color-contrast");
    expect(
      contrastViolations,
      `Contrast violations on ${name}: ${JSON.stringify(contrastViolations, null, 2)}`,
    ).toEqual([]);
  });
}
```

**Unit test (token-level):** add to `src/shared/theme.test.ts` (if it exists, else create)

```ts
import { describe, it, expect } from "vitest";
import { theme } from "./theme";

// Tiny inline contrast calculator to avoid adding a runtime dep
function contrastRatio(fg: string, bg: string): number {
  /* ... */
}

describe("theme — Sprint 1 audited contrast tokens", () => {
  it("textHint meets WCAG AA against #0d1b2e", () => {
    expect(contrastRatio(theme.colors.textHint, "#0d1b2e")).toBeGreaterThanOrEqual(4.5);
  });
  it("textNavFaint meets WCAG AA against #000", () => {
    expect(contrastRatio(theme.colors.textNavFaint, "#000000")).toBeGreaterThanOrEqual(4.5);
  });
  it("textScoreDim meets WCAG AAA against #0a1628", () => {
    expect(contrastRatio(theme.colors.textScoreDim, "#0a1628")).toBeGreaterThanOrEqual(7);
  });
  // ...
});
```

This unit test gives instant feedback on token regressions — no full E2E run needed.

### Story 4.1 (F9 League entry-state regression guard)

**E2E tests (existing files):** `e2e/tests/home.spec.ts` + `e2e/tests/league.spec.ts`

```ts
test("home idle league panel exposes Start a Season CTA", async ({ page }) => {
  await page.goto("/");
  const teaser = page.getByTestId("league-play-teaser");
  await expect(teaser).toContainText(/league mode/i);
  await expect(page.getByTestId("home-browse-leagues-button")).toBeVisible();
});

test("home idle Start a Season button navigates to /leagues", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("home-browse-leagues-button").click();
  await expect(page).toHaveURL(/\/leagues$/);
});
```

**Unit test:** in `HomeScreen.test.tsx`, add explicit coverage for both states:

- idle state: `home-browse-leagues-button` exists, `home-continue-season-button` absent
- active state: `home-continue-season-button` exists, browse button absent

### Story 5.1 (F10 lang regression guard)

**E2E test:** add to existing accessibility/home spec only if no equivalent assertion exists

```ts
test("html element declares lang", async ({ page }) => {
  await page.goto("/");
  const lang = await page.locator("html").getAttribute("lang");
  expect(lang).toBe("en");
});
```

**Preferred unit guard (shift-left):**

```ts
import { readFileSync } from "fs";
import { join } from "path";

test("index.html declares lang='en' on html element", () => {
  // Use process.cwd() to anchor the path — Vitest root is "src" so relative paths
  // resolve to src/, not the repo root. process.cwd() is always the repo root.
  const html = readFileSync(join(process.cwd(), "src/index.html"), "utf8");
  expect(html).toMatch(/<html\s[^>]*\blang=["']en["']/);
});
```

---

## CI Integration

The existing CI workflow already runs:

- `yarn lint` (which after Story 1.3 will include `check:style-guide`)
- `yarn typecheck`
- `yarn test` (Vitest)
- `yarn test:e2e` (Playwright across 7 device projects)

**No new CI workflow files needed.** All new tests slot into the existing pipeline.

---

## Determinism / Regression Coverage

Sprint 1 changes are limited to:

- Documentation (F1)
- New script (F1 CI)
- CSS-only changes via theme tokens (F3, F6 Tier 1)
- Static HTML guard check (F10)
- Home/league CTA regression coverage updates (F9)

**None of these touch the simulation engine, PRNG, RxDB schema, or game state.** Therefore the existing determinism regression suite (`yarn playwright test --project=determinism e2e/tests/determinism.spec.ts`) is sufficient — no new determinism tests required.

If determinism tests start failing after this sprint, that indicates an unintended side effect — investigate immediately, do not bypass.

---

## Test Coverage Targets

The repository's coverage thresholds (per `vite.config.ts`):

- Lines / Functions / Statements: ≥ 90%
- Branches: ≥ 80%

The new `check-style-guide-drift.ts` script must meet these thresholds. The `theme.test.ts` additions don't change overall coverage materially.

---

## Pre-Merge Manual Verification

Beyond automated tests, before requesting Winston CR sign-off:

1. **axe-core report** generated and attached to PR (Story 3.1)
2. **Sally manual sign-off** on:
   - Style guide visual examples (Story 1.2)
   - Visual snapshot diffs from F6 Tier 1 (Story 3.1)
   - WCAG verification per finding (Stories 2.1, 3.1, 5.1)
3. **PR description** follows template with all 4 H2 sections
4. **No new circular dependencies** — `yarn check:circular-deps` clean
