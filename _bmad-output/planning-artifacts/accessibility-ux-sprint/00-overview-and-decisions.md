# 00 — Overview & Decisions

## Executive Summary

BlipIt Legends underwent a heuristic UX/accessibility review that surfaced **10 findings** spanning P0 (critical) to P2 (minor). A full bmad multi-agent roundtable (7 agents + 6 persona interviews + a cross-talk round) produced unanimous signal that **low-contrast text (Finding #6) is the single biggest user-impact failure** — every one of the 6 user personas, from Casual Watcher to Power User, independently flagged it as their #1 or co-#1 pain.

This sprint executes the highest-leverage subset of those findings, slices Finding #6 into tiers to manage visual-snapshot churn, and installs a CI guardrail to prevent regression of the foundational style-guide/theme drift problem.

## Sprint 1 Scope (LOCKED)

| ID              | Finding                                                                   | Tier | Owner                               | Effort | Files (primary)                                                                          |
| --------------- | ------------------------------------------------------------------------- | ---- | ----------------------------------- | ------ | ---------------------------------------------------------------------------------------- |
| **F1**          | Style Guide ↔ Theme Drift + CI guardrail                                  | P0   | Paige (audit/doc) + Amelia (script) | M      | `docs/style-guide.md`, `src/shared/theme.ts`, `scripts/check-style-guide-drift.ts` (new) |
| **F3**          | Touch targets ≥ 44×44 effective                                           | P1   | Amelia                              | S      | `HelpButton`, close buttons, save-card actions                                           |
| **F6 (Tier 1)** | Contrast: `textHint`, `textNavFaint`, `textScoreDim`, scoreboard numerics | P1   | Amelia                              | M      | `src/shared/theme.ts` + ~8-12 snapshot updates                                           |
| **F9**          | League Teaser non-affordance                                              | P2   | Amelia                              | S      | `LeagueTeaserBox`                                                                        |
| **F10**         | `html lang="en"` verification                                             | P2   | Amelia                              | XS     | `index.html`                                                                             |

**Total estimated effort:** ~1 sprint (parallel with League Mode work).

**Out of Sprint 1 (deferred to Sprint 2):**

- F2 (Logo PNG/SVG), F4 (small font sizes), F5 (BSO — spec ready, build deferred), F6 Tier 2/3 (remaining contrast tokens), F7 (light mode), F8 (focus rings)

## Key Decisions (with attribution)

### D1 — Finding #6 (Low-Contrast Text) is sliced into 3 tiers, not deferred wholesale

**Original PM position (John):** Defer #6 entirely to a dedicated accessibility sprint due to ~20-40 visual snapshot cascade risk (Amelia's estimate).

**Counter-evidence:** Mary's user-impact math: ~250-350 of 1000 users meaningfully affected (presbyopia + CVD overlap, baseball-fan demo skewing 60% male and 25%+ over 45). All 6 personas flagged #6 as #1 pain.

**Resolution:** Tier-1 slice (body text + scoreboard numerics + button labels + form inputs + modal copy) ships in Sprint 1 — captures ~80% of user impact at ~30% of snapshot churn (~8-12 snapshots vs ~40). Tier 2 (metadata, timestamps, footer) ships in Sprint 2. Tier 3 (decorative/ambient) goes to backlog.

**Mid-sprint guardrail:** If Tier 1 balloons past 15 snapshots, re-triage immediately, not at sprint end.

### D2 — Finding #5 (BSO) is specced this sprint, built next sprint

**Sally's original proposal:** Add shapes/symbols to the BSO dots for CVD users.

**Buck's counter:** Real stadium scoreboards never use shape-in-dot — they use prominent **B/S/O text labels**. Color is decorative reinforcement, not signal. Adding shapes would feel like video-game UI, not a ballpark.

**Sally conceded** and produced this final spec (now ready to build in Sprint 2):

- Visible text label `B 3  S 2  O 1` beneath dot cluster
- Mobile 20px / desktop 24px, weight 700, `font-variant-numeric: tabular-nums`
- WCAG **AAA** contrast (≥ 7:1) since this is the game's primary state readout
- Dots keep colors but get a 1px inner border for grayscale/CVD distinguishability
- Screen-reader hybrid: `<div role="status" aria-live="polite" aria-atomic="true" aria-label="Count: 3 balls, 2 strikes, 1 out">`; visible text gets `aria-hidden="true"`

This serves Buck's authenticity, Mary's CVD users (~51/1000), P6's unambiguous-count demand, and SR users in one design.

### D3 — Touch target fix uses transparent hit-area expansion, NOT real padding

**Winston's constraint:** A naïve padding bump on `HelpButton` (currently 25×25) and close buttons (currently 28×28) would shift neighboring elements and break visual layout snapshots.

**Required pattern:** Use `::before` pseudo-element with `position: absolute; inset: -<delta>px;` to expand the clickable hit area without altering visible footprint or affecting parent layout.

```ts
// Sketch — Amelia owns final implementation
const HelpButton = styled.button`
  width: 25px;
  height: 25px;
  position: relative;
  &::before {
    content: "";
    position: absolute;
    inset: -10px; /* yields 45×45 hit area */
  }
`;
```

### D4 — CI guardrail spec MUST be locked before sprint kickoff

**Winston's risk flag:** If F1's CI guardrail is designed mid-sprint, it will eat F3/F6 budget.

**Locked spec (Amelia + Paige):**

- New script: `scripts/check-style-guide-drift.ts`
- Approach: **runtime import via tsx** (not AST, not regex on theme.ts) — `import { theme } from "../src/shared/theme"` and walk the nested object
- Markdown side: regex `/#[0-9a-fA-F]{3,8}\b/g` and `/\brgba?\([^)]+\)/g`
- **Normalization required:** lowercase, expand 3-digit hex (`#fff` → `#ffffff`), strip alpha=ff
- Token name validation handles dotted paths (`theme.colors.primary.main`)
- Escape hatch: skip fenced blocks tagged `bad`/`diff`/`old`; support `<!-- style-guide-ignore -->` inline marker
- Wired as `yarn check:style-guide`, chained into existing `lint` script (NOT husky pre-commit — won't catch cross-file drift)
- **Self-test required:** fixture in `src/__tests__/` with known-bad doc that fails and known-good that passes (must live under `src/` so Vitest discovers it — `root: "src"` in vite.config.ts)

### D5 — Ownership boundaries (Winston)

| Responsibility                                                | Owner                                               |
| ------------------------------------------------------------- | --------------------------------------------------- |
| Final design specs (px / contrast / aria)                     | Sally                                               |
| Documentation rewrite + audit artifacts                       | Paige                                               |
| Implementation (code + tests)                                 | Amelia                                              |
| **WCAG compliance sign-off** (axe-core / Lighthouse evidence) | Sally (verification) — Amelia (evidence collection) |
| F5 stadium-authenticity sign-off                              | Buck                                                |
| Architectural CR sign-off (PR gate)                           | Winston                                             |
| Snapshot regen execution                                      | `e2e-test-runner` operational specialist            |

### D6 — Finding #8 (Focus Indicator) explicitly OUT of Sprint 1

**Winston's directive:** "If time allows" is how sprints slip. Either explicitly in or explicitly out — **OUT.** Revisit in Sprint 2 alongside F6 Tier 2.

## Agent Verdicts (final)

| Agent      | Position                                                                                                                                                   |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sally 🎨   | Conceded BSO shape proposal to Buck; produced final BSO spec; defends Tier-1 slice of #6 as ethically necessary                                            |
| John 📋    | Updated sequencing based on Mary's math; #6 Tier 1 in, #5 deferred-but-specced                                                                             |
| Winston 🏗️ | **APPROVE WITH CONDITIONS** on Sprint 1 scope; non-negotiable: all values flow through theme tokens                                                        |
| Amelia 💻  | Confirmed CI guardrail is feasible (effort: S, ~2-3h); flagged false-positive risk and added missing requirements (normalization, dotted paths, self-test) |
| Buck ⚾    | Approves text-label-prominent BSO approach as stadium-authentic; will sign off on F5 in Sprint 2                                                           |
| Mary 📊    | Provides citation-backed evidence justifying P0 on user impact (not legal exposure) — see `01-findings-detail.md`                                          |
| Paige 📚   | Owns style-guide rewrite scope (audit-first, not patch-over); CI guardrail design                                                                          |

## Success Criteria for Sprint 1

- [ ] F1: `docs/style-guide.md` matches `src/shared/theme.ts` exactly; CI script blocks future drift; orphaned tokens flagged or removed
- [ ] F3: All buttons currently below 44×44 (HelpButton, close buttons, save-card Load/Export/Delete) have ≥ 44×44 effective tap area; no visual layout regression on `responsive-smoke.spec.ts`
- [ ] F6 Tier 1: `textHint`, `textNavFaint`, `textScoreDim` tokens meet WCAG 1.4.3 (≥ 4.5:1 for normal text); scoreboard numerics meet WCAG 1.4.6 (≥ 7:1 AAA); axe-core audit attached to PR shows 0 contrast violations on body/scoreboard surfaces
- [ ] F9: League Teaser is non-interactive (`pointer-events: none`, `cursor: default`), shows lock icon, copy reads "Coming Soon" with target quarter; no longer dispatches click events
- [ ] F10: `<html lang="en">` verified present in `index.html`
- [ ] Winston issues APPROVE on the consolidated PR
- [ ] Sally signs off on WCAG evidence for F3 + F6 Tier 1
