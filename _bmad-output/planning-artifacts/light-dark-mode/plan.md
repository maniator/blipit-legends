# BlipIt Legends — Light / Dark Mode Support Plan

> **Status:** Planning — BMAD Party Mode output
> **Date:** 2026-05-12
> **Authors:** BMAD Party (John 📋, Sally 🎨, Winston 🏗️, Amelia 💻)
> **Scope:** v1 planning only — no implementation in this PR

---

## Executive Summary

BlipIt Legends currently supports dark mode only. This plan covers adding full light/dark mode support with a theme toggle, without breaking the current look or introducing a sprawling color override system.

The BMAD party reached consensus on a **hybrid architecture** (CSS custom properties for flash prevention + styled-components ThemeProvider for typed component theming), a **two-entry-point toggle** (HomeScreen + GameControls), and a **three-sprint delivery** across five named stages (A–E).

**v1 scope is explicit:** Light and Dark only. System preference (following OS setting) is a defined v2 ticket.

---

## 1. Styling System Audit

### Current State

| Item                            | Current                                                                            |
| ------------------------------- | ---------------------------------------------------------------------------------- |
| Theme file                      | `src/shared/theme.ts` — single static object, ~180 color tokens                    |
| ThemeProvider                   | ✅ Already wired in `src/index.tsx` via styled-components                          |
| DefaultTheme                    | ✅ `src/styled.d.ts` extends `DefaultTheme extends AppTheme`                       |
| Global SCSS                     | `src/index.scss` — hardcoded `color: #FFF` on `*`, `background: #07111e` on `body` |
| Preferences pattern             | `usehooks-ts` `useLocalStorage` (volume, speed, managerMode, strategy)             |
| CSS custom properties           | ❌ None — all tokens live in the JS object only                                    |
| Flash-of-wrong-theme protection | ❌ None                                                                            |
| Persistent header / nav bar     | ❌ None — AppShell is a minimal layout shell                                       |
| Dynamic theme switching         | ❌ None — theme object is static                                                   |

### Token Inventory

The `src/shared/theme.ts` exports approximately 180 color tokens in a flat namespace — organized by loose semantic groups (backgrounds, borders, text, accent, status, game, overlays) but not by a strict two-tier primitive/semantic hierarchy. Many tokens are implementation-specific (e.g., `bgPlayerSelected`, `bgPaginationHover`) rather than truly semantic.

The flat namespace will double to 360 values if both themes are created without rationalization. The agreed approach is **opportunistic rationalization** — migrate tokens to a semantic shape as they are touched during implementation, not as a big-bang prerequisite.

### SCSS Globals (High Risk)

```scss
/* src/index.scss */
* {
  color: #fff;
} /* ← hardcoded; fights any JS theme */
body {
  background: #07111e;
} /* ← hardcoded; will cause white-on-white in light mode */
```

These two lines bypass the ThemeProvider entirely. Any component that relies on them instead of explicit theme tokens will render incorrectly in light mode. They must be migrated to CSS custom properties as part of Stage A.

---

## 2. Theme Architecture

### Recommended: Hybrid (CSS vars at `:root` + ThemeProvider for components)

**Why hybrid:** styled-components ThemeProvider alone does not solve flash-of-wrong-theme (FOWTM). The browser paints before React hydrates, so any preference stored in `localStorage` cannot be read in time — the user sees a flash. CSS custom properties on `:root` can be set by a synchronous inline script in `<head>` before any paint occurs.

**The scope of CSS vars is intentionally narrow:** only 4–6 root-level vars for body background, base text color, and surface color. All component-level token access remains in the styled-components ThemeProvider.

This is not two theming systems — it is CSS doing what CSS uniquely does (pre-render attribute switching) and TypeScript doing what it does (typed component theming). No drift risk because the CSS vars are a subset of, not parallel to, the ThemeProvider tokens.

### Architecture Diagram

```
index.html
└─ <head> inline script (synchronous, ~5 lines)
     Reads localStorage("themeMode") or "dark"
     Sets document.documentElement.data-theme="dark|light"

src/index.scss
└─ :root[data-theme="dark"] { --color-bg: #07111e; --color-text: #fff; ... }
└─ :root[data-theme="light"] { --color-bg: #f5f0e8; --color-text: #1a2340; ... }
└─ body { background: var(--color-bg); color: var(--color-text); }

src/shared/hooks/useThemePreference.ts    (new)
└─ useLocalStorage("themeMode", "dark")
└─ useEffect → sets data-theme + writes resolved theme to ThemeProvider

src/index.tsx  (modified)
└─ <ThemeProvider theme={resolvedTheme}>   ← theme object switches on toggle

src/shared/theme/
├─ types.ts    AppTheme interface (semantic shape)
├─ dark.ts     darkTheme object (current values, exact copy initially)
├─ light.ts    lightTheme object (new — Sally's token spec)
└─ cssVars.ts  generateCssVars(theme) → CSSProperties for :root (4–6 vars only)
```

### Token Structure

Tokens migrate from the current flat namespace to a semantic structure over time (opportunistically):

```ts
// src/shared/theme/types.ts (new interface shape)
export interface AppTheme {
  surface: {
    base: string; // page background
    raised: string; // cards, panels
    overlay: string; // modals, dialogs
    sunken: string; // input wells
    interactive: string; // hover/active on surfaces
  };
  text: {
    primary: string;
    secondary: string;
    muted: string;
    inverse: string; // text on filled buttons
    onDark: string; // always-white (e.g., on orange CTAs)
  };
  border: {
    subtle: string;
    strong: string;
    accent: string;
  };
  brand: {
    orange: string; // #FF9A1F — brand accent, same in both themes
    gold: string; // #F2C14E — secondary accent, same in both themes
    navy: string; // #07111e — always-deep
    orangeText: string; // darker orange for small text in light mode
  };
  feedback: {
    success: string;
    warning: string;
    error: string;
    info: string;
  };
  game: {
    countboardBg: string;
    countboardText: string;
    baseEmpty: string;
    baseOccupied: string;
    baseBorder: string;
    logBg: string;
    logTextEvent: string;
    logTextPitch: string;
  };
  // Legacy flat tokens preserved during migration
  colors: Record<string, string>;
  // Non-color tokens (unchanged between themes)
  fontSizes: typeof import("./dark").darkTheme.fontSizes;
  radii: typeof import("./dark").darkTheme.radii;
  spacing: typeof import("./dark").darkTheme.spacing;
  letterSpacing: typeof import("./dark").darkTheme.letterSpacing;
  sizes: typeof import("./dark").darkTheme.sizes;
  fonts: typeof import("./dark").darkTheme.fonts;
}
```

Note: the `colors` flat map is preserved during migration. Components migrate off `theme.colors.xxx` to `theme.surface.xxx` / `theme.text.xxx` incrementally. The interface enforces completeness — both theme objects must satisfy it.

---

## 3. Light Theme Personality

**Design principle: "Day game at the park."** The same stadium, different lighting conditions.

| Element                            | Dark mode                 | Light mode                                           |
| ---------------------------------- | ------------------------- | ---------------------------------------------------- |
| Page background                    | Deep navy `#07111e`       | Warm off-white `#F5F0E8` (parchment)                 |
| Card / panel surface               | Dark blue `#0F1E34`       | Warm white `#FFFFFF` with subtle drop shadow         |
| Input wells                        | Dark navy `#1C2E4A`       | Warm cool grey `#EAE6DE`                             |
| Primary text                       | White `#FFFFFF`           | Deep navy `#1A2340` (navy becomes "ink")             |
| Secondary / body text              | Blue-white `#CCE0FF`      | Muted navy `#3A4F6A`                                 |
| Muted / dimmer text                | `#8a9aaa`                 | `#5A6E82`                                            |
| Brand orange (large text, buttons) | `#FF9A1F`                 | `#FF9A1F` (unchanged)                                |
| Brand orange (small text)          | `#FF9A1F`                 | `#D4800A` (darkened for 4.5:1 contrast on parchment) |
| Brand gold (accents)               | `#F2C14E`                 | `#B8860B` (darkened for contrast)                    |
| Brand navy                         | `#07111e` (as background) | `#07111e` (as ink/headings)                          |
| Success green                      | `#4ade80`                 | `#059669`                                            |
| Error red                          | `#ff7070`                 | `#DC2626`                                            |
| Scoreboard background              | `#0a1628`                 | `#1A2340` (stays dark — "stadium board")             |
| Base diamond occupied              | `#3f4f7e`                 | Consider `#4A6FA5` or field-adjacent color           |

**Key identity retention rule:** The scoreboard, count display, and bases may stay dark-themed even in light mode — like a real stadium scoreboard against a daytime sky. This is an intentional design exception and should be documented as such in the token spec.

---

## 4. Toggle Placement

### Recommendation: Two-Entry-Point Toggle (No Persistent Header)

Adding a persistent app header/nav bar solely to house a theme toggle is out of proportion. The toggle does not need a nav redesign.

**Entry point 1: HomeScreen (primary)**

- Location: bottom of the HomeScreen button list, before any footer attribution copy
- Control: compact pill toggle — `☀ Light / ☾ Dark` or icon-only with a text label nearby
- Rationale: HomeScreen is the user's "base camp." Most users set the theme once here and never change it again.

**Entry point 2: GameControls panel (secondary)**

- Location: within the existing settings/preferences cluster in `GameControls`
- Control: same pill toggle, matching the HomeScreen design
- Rationale: Users in a long game shouldn't navigate away to flip the theme. GameControls already groups speed, volume, and manager mode.

**Explicitly rejected for v1:**

- Persistent floating action button (FAB) overlaid on game state
- Persistent app header or nav bar added for this feature alone
- Toggle on every screen independently

### Toggle Control Design

| Concern         | Requirement                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| v1 control type | Two-state: Light / Dark                                                                                 |
| v2 upgrade      | Add System as third state                                                                               |
| Accessible name | `aria-label="Switch to light mode"` or `"Switch to dark mode"` (reflects the _result_ of the click)     |
| Keyboard        | Toggle on Space/Enter; tab-focusable                                                                    |
| Focus ring      | Visible in both themes — 2px solid, 2px offset minimum (WCAG 2.2 Focus Appearance)                      |
| Touch target    | Minimum 44×44px (WCAG 2.5.5 Target Size)                                                                |
| Motion          | Theme transition animation (if any) must be wrapped in `@media (prefers-reduced-motion: no-preference)` |
| Icon            | Sun (`☀` / `🌞`) for Light, Moon (`🌙`) for Dark — icon-only button must have accessible label          |

---

## 5. Preference Persistence

### Decision: localStorage, key `"themeMode"`, default `"dark"`

| Concern                      | Decision                                                                                             |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| Storage mechanism            | `localStorage` via `usehooks-ts` `useLocalStorage` (consistent with volume, speed, managerMode)      |
| v1 values                    | `"dark"` \| `"light"`                                                                                |
| v2 values                    | Add `"system"` — deferred to v2                                                                      |
| Default for first-time users | `"dark"` — preserves current experience, no disruption                                               |
| FOWTM prevention             | Blocking inline script in `<head>` reads `localStorage("themeMode")`, sets `data-theme` before paint |
| RxDB involvement             | None — this is a UI preference, same tier as volume                                                  |
| sessionStorage               | Not used — preference should persist across sessions                                                 |

### Flash-of-Wrong-Theme (FOWTM) Prevention

The inline script in `src/index.html` is the canonical solution. It is synchronous, tiny, and architecturally justified:

```html
<head>
  <script>
    (function () {
      try {
        var mode = JSON.parse(localStorage.getItem("themeMode"));
        document.documentElement.setAttribute("data-theme", mode === "light" ? "light" : "dark");
      } catch (e) {}
    })();
  </script>
  <!-- rest of head -->
</head>
```

The try/catch handles both blocked `localStorage` environments (private browsing, strict settings) and any `JSON.parse` failure on corrupt data. The fallback is dark mode (the current experience).

The localStorage key must exactly match what `useLocalStorage("themeMode", "dark")` writes. The `usehooks-ts` library stores values as **JSON-encoded strings** — the raw stored value is `'"light"'` or `'"dark"'` (a JSON string with inner quotes). The `JSON.parse` call unwraps this so the comparison `=== "light"` works correctly. **Do not** compare `localStorage.getItem(...)` directly to `"light"` — it will always evaluate as falsy and fall back to dark mode.

---

## 6. Accessibility Requirements

### WCAG 2.2 AA Compliance

| Criterion                          | Requirement                                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------ |
| Normal text (< 18pt)               | 4.5:1 minimum contrast ratio in both themes                                                      |
| Large text (≥ 18pt or ≥ 14pt bold) | 3:1 minimum                                                                                      |
| UI components and graphics         | 3:1 minimum                                                                                      |
| Focus Appearance (2.4.11 AA)       | Focus ring ≥ 2px solid, offset ≥ 2px                                                             |
| Target Size (2.5.5 Target Size)    | 44×44px minimum touch target                                                                     |
| Color not as sole indicator        | Game state (bases, BSO dots) must use shape + color — already true in dark mode, verify in light |

### Known Risk: Orange on Light Background

`#FF9A1F` on `#F5F0E8` (warm parchment) achieves approximately 2.8:1 — failing 4.5:1 for small text. Mitigations:

1. Use `#FF9A1F` only for large/bold text and button fills in light mode.
2. For small text accents in light mode, use `brand.orangeText: "#D4800A"` — a darker orange that passes 4.5:1 on parchment.
3. The button fill case (`btnPrimary`) uses orange fill with navy text (`#0b1a38`) — verify this combination passes 3:1 for large text on the button.

### Focus States

Both themes must have visible focus rings. Current dark-mode focus should be audited — if any component uses `outline: none` without a custom replacement, that must be fixed in Stage A (accessibility debt, not theme debt).

### Motion

Any theme-transition animation must be gated on `prefers-reduced-motion: no-preference`. Suggested transition when motion is allowed:

```css
body,
body * {
  transition:
    background-color 200ms ease,
    color 200ms ease,
    border-color 200ms ease;
}

@media (prefers-reduced-motion: reduce) {
  body,
  body * {
    transition: none;
  }
}
```

---

## 7. Critical Surfaces (Both Themes — Visual Regression Coverage)

| Surface                                          | Risk Level     | Why                                                                    |
| ------------------------------------------------ | -------------- | ---------------------------------------------------------------------- |
| Active Game Page                                 | 🔴 Highest     | Countboard, base diamond, pitch log, manager panel — dense game tokens |
| NewGameDialog / ExhibitionSetupPage              | 🔴 High        | Form controls (selects, inputs, radio groups) complex in light mode    |
| CustomTeamEditor                                 | 🟡 Medium-High | Drag-and-drop rows, hover states, sortable lists                       |
| SavesPage                                        | 🟡 Medium      | Data-dense layout, timestamps in secondary text                        |
| HomeScreen                                       | 🟡 Medium      | Brand impression + toggle placement                                    |
| Modals / Dialogs (InstructionsModal, SavesModal) | 🟡 Medium      | Overlay surfaces — scrim behavior in light mode                        |
| CareerStats pages                                | 🟢 Lower       | Table-heavy but less interactive                                       |

### Visual Regression Strategy

Rather than doubling the full snapshot suite, create a **new curated Playwright project `theme-light`** covering ~12–16 critical surface snapshots. The existing dark-mode snapshot suite remains unchanged (dark is still the default, zero breakage).

Baseline generation for `theme-light` must be run inside the `mcr.microsoft.com/playwright:v1.58.2-noble` Docker container via the `e2e-test-runner` agent — never locally.

---

## 8. Testing Plan

### Unit / Component Tests

| Test                         | Location            | What                                                                                                                  |
| ---------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `useThemePreference.test.ts` | `src/shared/hooks/` | Default to dark; persists to localStorage; returns correct theme object per mode; handles localStorage unavailability |
| `theme.contrast.test.ts`     | `src/shared/`       | Extend to run WCAG contrast checks against **both** `lightTheme` and `darkTheme`                                      |
| `theme.parity.test.ts`       | `src/shared/`       | Both theme objects have identical key structure (`Object.keys(light.colors)` equals `Object.keys(dark.colors)`)       |
| Toggle component tests       | Feature level       | Toggle accessible name; keyboard operability; state reflects stored preference                                        |

### E2E / Visual Regression Tests

| Test                                 | What                                                  |
| ------------------------------------ | ----------------------------------------------------- |
| New `theme-light` Playwright project | ~12 critical surface snapshots in light theme         |
| `responsive-smoke.spec.ts`           | Verify no layout breakage after SCSS global migration |
| Existing dark-mode snapshots         | Must remain green through Stage A–C                   |

### Existing Tests Likely to Need Updates

- `src/shared/theme.contrast.test.ts` — extend to include light theme
- Any component test that snapshots styled output will need review if token values change
- `e2e/` visual snapshots — dark mode snapshots should not change if dark theme = exact copy of current theme

---

## 9. Implementation Staging

### Stage A — Theme Foundation (Sprint 1, Week 1–2)

**Scope:**

- Define `AppTheme` interface in `src/shared/theme/types.ts`
- Create `src/shared/theme/dark.ts` as exact copy of current `theme` — zero value changes
- Create `src/shared/theme/light.ts` as stub (placeholder values) — enough to satisfy the interface
- Update `src/index.tsx` to use `useThemePreference` hook, pass `resolvedTheme` to ThemeProvider
- Create `src/shared/hooks/useThemePreference.ts` with `useLocalStorage("themeMode", "dark")`
- Migrate `src/index.scss` globals to CSS custom properties (body background, base text color)
- Add blocking inline script to `src/index.html` for FOWTM prevention
- Write `useThemePreference.test.ts`, extend `theme.contrast.test.ts`, add `theme.parity.test.ts`

**Acceptance Criteria:**

- All existing E2E visual snapshots pass (dark theme renders identically to today)
- `yarn build` and `yarn test` pass with no regressions
- No flash of wrong theme on cold load in dark mode
- TypeScript enforces completeness — light/dark objects must implement `AppTheme`

**Explicitly Not In Stage A:**

- Light theme token values (stubs only)
- Toggle UI
- Any component migration
- System preference support

**Files Likely Touched:**

```
src/index.html                        (+ inline script)
src/index.scss                        (globals → CSS vars)
src/index.tsx                         (ThemeProvider wiring)
src/shared/theme.ts                   (refactor/split)
src/shared/theme/types.ts             (new)
src/shared/theme/dark.ts              (new)
src/shared/theme/light.ts             (new — stubs)
src/shared/hooks/useThemePreference.ts (new)
src/styled.d.ts                       (update if AppTheme shape changes)
src/shared/theme.contrast.test.ts     (extend)
src/shared/theme.parity.test.ts       (new)
```

**Risks:**

- `dark.ts` value copy must be exact — any accidental token rename breaks styled-components access
- TypeScript compile-time errors if `AppTheme` shape doesn't match `styled.d.ts`
- SCSS global migration could affect snapshot layout

---

### Stage B — Light Theme Token Spec (Sprint 1, Week 2–3)

**Scope:**

- Sally produces PR to `docs/style-guide.md` adding "Light Theme Tokens" section
- Table format: Token name | Dark value | Light value
- Covers all semantic categories: surface, text, border, brand, feedback, game-specific
- Winston reviews for architectural consistency; Amelia reviews for implementation feasibility
- No code changes — design artifact only

**Acceptance Criteria:**

- All ~40–50 semantic tokens have light values specified
- Orange-on-light contrast alternatives documented (`brand.orangeText` for small text)
- Scoreboard exception documented ("scoreboard stays dark in light mode" intentional design)
- PR merged to `docs/style-guide.md` before Stage C begins

**Explicitly Not In Stage B:**

- Any code changes
- Figma or other design tool output (markdown table is the deliverable)

**This stage is the critical path for Stage C and beyond.**

---

### Stage C — Toggle UI (Sprint 2, Week 1–2)

**Prerequisite:** Stage B merged.

**Scope:**

- Implement theme toggle in HomeScreen (bottom of button list)
- Implement theme toggle in GameControls settings cluster
- Wire to `useThemePreference` hook
- Both toggles sync to the same localStorage key
- Verify FOWTM prevention works in both E2E environments
- Write integration test: toggle in HomeScreen, reload, verify theme persists

**Acceptance Criteria (UX/QA):**

- Toggle visible and reachable in ≤ 2 taps/clicks from HomeScreen and GamePage
- Preference persists across page reload and browser/app relaunch (cross-reinstall persistence is out of scope — PWA uninstall typically clears `localStorage`)
- WCAG 2.2 AA accessible label (`aria-label` reflects result of click)
- No FOWTM on load — verified in CI
- All existing dark-mode snapshots still pass
- `yarn lint`, `yarn typecheck` pass

**Files Likely Touched:**

```
src/features/gameplay/components/HomeScreen/index.tsx
src/features/gameplay/components/HomeScreen/styles.ts
src/features/gameplay/components/GameControls/index.tsx
src/features/gameplay/components/GameControls/styles.ts
src/shared/components/ThemeToggle/           (new component)
```

**Risks:**

- GameControls is already dense — space for toggle without visual clutter
- HomeScreen bottom placement must not push content below fold on small mobile viewports
- Two toggles using the same localStorage key must not conflict (they should not; both call the same hook)

---

### Stage D — Core Surface Migration (Sprint 2–3)

**Prerequisite:** Stage C merged; light theme stubs replaced with real values from Stage B.

**Scope:**

- Replace stub values in `light.ts` with the token spec from Stage B
- Migrate `src/shared/components/` styled files to use only theme tokens (remove any hardcoded hex)
- Migrate layout, nav, modals, forms, buttons, cards, and status banners to semantic tokens
- Run hardcoded hex audit: `grep -r '#[0-9a-fA-F]\{3,6\}' src --include='*.ts' --include='*.tsx'`
- Begin `theme-light` Playwright project with critical surface baseline snapshots
- Snapshot baseline generation via `e2e-test-runner` agent inside Docker container

**Acceptance Criteria:**

- No hardcoded hex colors in `src/shared/` styled files
- Light theme renders correctly on all 7 critical surfaces
- `theme-light` Playwright project passes on CI with generated baselines
- WCAG AA contrast verified on HomeScreen, Modals, Forms in both themes

**Files Likely Touched:**

```
src/shared/theme/light.ts             (full values from Stage B spec)
src/shared/components/**/*.ts         (~10–15 files)
src/features/gameplay/components/HomeScreen/styles.ts
src/features/saves/pages/SavesPage/styles.ts
src/features/saves/components/SavesModal/styles.ts
src/features/help/components/**
e2e/tests/visual/theme-light.spec.ts  (new)
e2e/playwright.config.ts              (add theme-light project)
```

**Risks:**

- Snapshot regeneration — route to `e2e-test-runner` agent; never locally
- Orange-on-light failures will surface here; fix via `brand.orangeText` token

---

### Stage E — Gameplay, Leagues, and Cleanup (Sprint 3+)

**Scope:**

- Migrate gameplay, scoreboard, field/game visuals, league wizard, season pages, schedule/standings, active game pages to semantic tokens
- Run final hardcoded hex sweep across all ~60 `styles.ts` files
- Add lint rule or documentation guidance to prevent new hardcoded colors
- Update `README.md` / developer docs if theme token conventions need documenting
- Final `theme-light` snapshot update after all surfaces migrated

**Acceptance Criteria:**

- No hardcoded non-token colors in any `styles.ts` file
- All 12 `theme-light` surface snapshots pass on CI
- Both themes pass WCAG AA — automated contrast check covers key token pairs
- Developer docs updated with "always use `theme.surface.xxx` not hex" rule

**Files Likely Touched:**

```
src/features/gameplay/components/**   (~20 styles.ts files)
src/features/leagues/**               (~10 styles.ts files)
src/features/careerStats/**
docs/style-guide.md                   (add theme token enforcement note)
```

**Explicitly Not In Stage E:**

- System preference support (v2 ticket)
- Animated theme transition (v2, based on user demand)
- Per-screen theme overrides
- Theme-aware PWA manifest icons

---

## 10. Open Questions and Risks

| Item                                                                              | Status                                                                                                                 |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `usehooks-ts` `useLocalStorage` JSON encoding vs. inline script string comparison | Verify: stored as `'"dark"'` (JSON string with quotes) — inline script must use `JSON.parse` or compare `=== '"dark"'` |
| Orange `#FF9A1F` on parchment background — exact contrast value                   | Needs tool verification; estimated ~2.8:1. Mitigate with `brand.orangeText`                                            |
| Scoreboard "stays dark in light mode" — implementation complexity                 | Requires component-level theme override or dedicated game token section — low risk if tokens are semantic              |
| Service worker cache — `index.html` change will invalidate precache               | Expected behavior; one-time FOWTM for existing users on first update; acceptable                                       |
| Token rationalization scope — "rationalize as you touch" could leave gaps         | Mitigate with `theme.parity.test.ts` structural test; enforces key parity between light and dark                       |

---

## 11. v2 Backlog Items

These items are explicitly deferred, not forgotten:

- **System preference** (`"system"` as third preference value following OS setting)
- **Animated theme transition** (smooth crossfade, respecting `prefers-reduced-motion`)
- **Theme-aware PWA manifest and OG images**
- **Full CSS custom property extraction** (current plan uses CSS vars only at `:root` for FOWTM; full extraction is a future enhancement)
- **Per-screen theme overrides** (e.g., always-dark scoreboard becomes a design system feature, not an exception)
- **Custom / branded themes** beyond light and dark

---

## 12. Final Architecture Decision Record

| Decision                | Choice                                                 | Rationale                                                                  |
| ----------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------- |
| Runtime theme mechanism | **Hybrid: CSS vars at `:root` + ThemeProvider**        | CSS vars for FOWTM prevention; ThemeProvider for typed component access    |
| CSS vars scope          | **4–6 vars at `:root` only** (body bg, text, surface)  | Avoids parallel token drift; ThemeProvider is authoritative for components |
| v1 preference options   | **Light + Dark only**                                  | System preference adds FOWTM complexity disproportionate to v1 value       |
| Default preference      | **Dark**                                               | Preserves current user experience; no disruption for existing users        |
| Toggle placement        | **HomeScreen (bottom) + GameControls panel**           | No persistent header needed; matches existing preference control patterns  |
| Token migration style   | **Opportunistic** — rationalize as touched             | Avoids blocking big-bang prerequisite; parity test ensures no gaps         |
| Token spec deliverable  | **PR to `docs/style-guide.md`**                        | Same source of truth; directly usable by engineers                         |
| Flash prevention        | **Blocking inline script in `<head>`**                 | Only reliable pre-render solution for localStorage-based preference        |
| PRNG / RxDB involvement | **None**                                               | Theme preference is pure UI state; no schema changes needed                |
| Snapshot strategy       | **New `theme-light` Playwright project, ~12 surfaces** | Avoids doubling full suite; targeted coverage of highest-risk surfaces     |
| Sprint estimate         | **3 sprints to shippable v1**                          | Stage A–B in Sprint 1, Stage C in Sprint 2, Stage D–E in Sprint 3+         |
