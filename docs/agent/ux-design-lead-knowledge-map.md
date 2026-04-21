# UX Design Lead — Knowledge Map

Source index, ownership, and refresh cadence for the `@ux-design-lead` agent.

---

## Purpose

This document is the single index of every authoritative source the UX Design Lead must consult before answering a question or producing a spec. It is divided into three layers: (A) repo-native design and architecture sources, (B) user-research and accessibility standards, and (C) competitive reference.

The agent **must cite a source from this map** for every design system claim. Any answer that proposes a new visual token without citing the style guide is non-compliant.

---

## Layer A — Repo-native sources (highest priority)

### A1. Design system

| Source                          | Path                               | Owner             | Refresh trigger                                                      |
| ------------------------------- | ---------------------------------- | ----------------- | -------------------------------------------------------------------- |
| UI Style Guide                  | `docs/style-guide.md`              | `@ux-design-lead` | Any new color, font, spacing token, component variant, or breakpoint |
| Typed design tokens             | `src/shared/theme.ts`              | Core team         | Any `theme.colors.*`, `theme.fonts.*`, or `theme.spacing.*` change   |
| TypeScript token declaration    | `src/styled.d.ts`                  | Core team         | Any `DefaultTheme` field addition or removal                         |
| Global CSS tokens + breakpoints | `src/index.scss`                   | Core team         | Any CSS variable, body background, or global font change             |
| Breakpoint helpers              | `src/shared/utils/mediaQueries.ts` | Core team         | Any breakpoint value change (mobile ≤768 px, desktop ≥1024 px)       |

### A2. Architecture and layout

| Source                     | Path                       | Owner     | Refresh trigger                                 |
| -------------------------- | -------------------------- | --------- | ----------------------------------------------- |
| Repo layout + path aliases | `docs/repo-layout.md`      | Core team | Any structural refactor or new feature dir      |
| Architecture + routes      | `docs/architecture.md`     | Core team | Any route, modal, or engine change              |
| RxDB / persistence         | `docs/rxdb-persistence.md` | Core team | Any schema or store change (for save/import UX) |
| E2E testing guide          | `docs/e2e-testing.md`      | Core team | Any new test project, fixture, or snapshot      |

### A3. Visual regression baselines

| Source                                        | Path                                  | Owner              | Refresh trigger           |
| --------------------------------------------- | ------------------------------------- | ------------------ | ------------------------- |
| Visual snapshot PNGs (current rendered state) | `e2e/tests/visual.spec.ts-snapshots/` | `@e2e-test-runner` | Any intentional UI change |

Naming convention: `<screen>-<project>-linux.png` where `project` is one of: `desktop`, `tablet`, `iphone-15-pro-max`, `iphone-15`, `pixel-7`, `pixel-5`.

Use these PNGs to predict which snapshot files a proposed change will affect before handing off to `@ui-visual-snapshot`.

### A4. Playwright viewport projects

| Project             | Viewport | Device class |
| ------------------- | -------- | ------------ |
| `desktop`           | 1280×800 | Desktop      |
| `tablet`            | 820×1180 | Tablet       |
| `iphone-15-pro-max` | 430×739  | Phone        |
| `iphone-15`         | 393×659  | Phone        |
| `pixel-7`           | 412×839  | Phone        |
| `pixel-5`           | 393×727  | Phone        |

All design specs must address behavior at each of these viewports.

### A5. Agent and routing docs

| Source              | Path                                       | Purpose                                        |
| ------------------- | ------------------------------------------ | ---------------------------------------------- |
| Agents overview     | `.github/agents/README.md`                 | Custom agent routing guide                     |
| UX Design Lead spec | `.github/agents/ux-design-lead.md`         | This agent's system prompt + behavior contract |
| PM agent spec       | `.github/agents/pm-agent.md`               | Cross-feature scope + risk review authority    |
| User persona agents | `.github/agents/user-*.md`                 | Proxy-user interview agents (all 5)            |
| Proxy realism agent | `.github/agents/baseball-manager.md`       | Baseball-realism enthusiast persona            |
| Proxy power-user    | `.github/agents/simulation-correctness.md` | Deterministic power-user persona               |

---

## Layer B — User research and accessibility standards

### B1. Accessibility

**WCAG 2.2 AA** — the minimum accessibility standard for all UI in this app.

Key criteria most relevant to this codebase:

| Criterion | Description                                                  | Applies to                                  |
| --------- | ------------------------------------------------------------ | ------------------------------------------- |
| 1.4.3     | Contrast ratio ≥ 4.5:1 for normal text, ≥ 3:1 for large text | All text rendered against `theme.colors.*`  |
| 1.4.11    | Non-text contrast ≥ 3:1 for UI components                    | Buttons, form controls, focus rings         |
| 2.1.1     | All functionality operable via keyboard                      | Every interactive control                   |
| 2.4.3     | Focus order is logical and follows DOM order                 | Modals, dialogs, decision panel             |
| 2.4.7     | Visible keyboard focus indicator                             | All focusable elements                      |
| 3.3.1     | Identify input errors in text — not color alone              | Form validation in team editor and new game |
| 4.1.2     | Name, role, value for all interactive elements               | All buttons, inputs, selects, dialogs       |

External reference: [https://www.w3.org/TR/WCAG22/](https://www.w3.org/TR/WCAG22/)

When checking contrast, always compare against the actual `theme.colors.*` token values — never against raw hex approximations.

### B2. Usability heuristics

**Nielsen's 10 Usability Heuristics** — use as the evaluation framework for heuristic reviews.

| #   | Heuristic                            | Common failure mode in this app                               |
| --- | ------------------------------------ | ------------------------------------------------------------- |
| 1   | Visibility of system status          | Game loading / autoplay state not clearly communicated        |
| 2   | Match between system and real world  | Non-standard baseball abbreviations; wrong stat labels        |
| 3   | User control and freedom             | No easy "undo" or "go back" from mid-game state               |
| 4   | Consistency and standards            | Inconsistent button labels across modals                      |
| 5   | Error prevention                     | Delete save with no confirmation; import with no preview      |
| 6   | Recognition over recall              | Saves list without enough metadata to identify each game      |
| 7   | Flexibility and efficiency           | No keyboard shortcuts for power users in the team editor      |
| 8   | Aesthetic and minimalist design      | Dense config options on setup screen for casual users         |
| 9   | Help users recognize/diagnose errors | Generic import error messages without field-level specificity |
| 10  | Help and documentation               | In-app rules accessible but not linked from error states      |

External reference: [https://www.nngroup.com/articles/ten-usability-heuristics/](https://www.nngroup.com/articles/ten-usability-heuristics/)

---

## Layer C — Competitive reference (supplementary)

| Product            | What to observe                                                                 | Caveat                                                    |
| ------------------ | ------------------------------------------------------------------------------- | --------------------------------------------------------- |
| MLB At Bat         | Live game scoreboard layout, play-by-play density, mobile information hierarchy | Richer data and real-time feeds — adapt scale accordingly |
| OOTP Baseball      | Stat table density, manager decision presentation, team editor depth            | Desktop-only; different interaction model                 |
| MLB The Show       | Manager-mode UI, decision panel timing, in-game interruption patterns           | Console/controller UX — translate thoughtfully to touch   |
| Baseball-Reference | Stat table conventions, standard column abbreviations, data density patterns    | Reference for column naming and table structure only      |

Layer C is supplementary. Never cite a competitive product as justification for a token value or accessibility decision — use Layer A and B sources instead.

---

## Source priority when answers conflict

```
Layer A1 (design tokens/style guide) > Layer A2 (architecture/layout) > Layer B1 (WCAG 2.2 AA) > Layer B2 (heuristics) > Layer C
```

When `docs/style-guide.md` says one thing and `src/shared/theme.ts` says another, flag the discrepancy and route to the core team before proposing a fix.

---

## Refresh cadence

| Trigger                                             | Action required                                                                                |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Any addition to `src/shared/theme.ts`               | Re-read theme file; update A1 table if a new token category was added                          |
| Any new Playwright viewport project added to `e2e/` | Update A4 viewport table; update spec template                                                 |
| Any screen added to `e2e/tests/visual.spec.ts`      | Update A3 table with the new snapshot file names                                               |
| Any route added to `src/router.tsx`                 | Update A2 architecture reference; consider whether a new persona scenario applies              |
| Any new user-facing feature shipped                 | Update the persona descriptions if the feature changes core user flows                         |
| WCAG version update (currently 2.2)                 | Review B1 criteria table; flag any newly required criterion to `@ux-design-lead`               |
| Monthly cadence                                     | Spot-check `docs/style-guide.md` for drift vs. `src/shared/theme.ts`; flag any inconsistencies |
