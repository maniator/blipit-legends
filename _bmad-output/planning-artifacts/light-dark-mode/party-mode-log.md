# BMAD Party Mode — Light / Dark Mode Decision Log

> **Date:** 2026-05-12
> **Participants:** John 📋 (PM), Sally 🎨 (UX Designer), Winston 🏗️ (Architect), Amelia 💻 (Engineer)
> **Format:** Solo party mode — all agents in one session

---

## Round 1 — Initial Positions

### 📋 John (PM)

**Architecture:** Pure styled-components ThemeProvider. Skip CSS custom properties — "avoid a second theming system." Split `theme.ts` into `darkTheme` + `lightTheme`. Use `useLocalStorage` pattern for `useColorScheme` hook.

**Toggle:** HomeScreen (top-right icon) + Help/Settings page. No persistent header.

**v1 scope:** System + Light + Dark all three. Argued defaulting to `'system'` prevents disruption for existing dark-mode users.

**Token rationalization:** Deferred to v2 — not a prerequisite.

**Key risk named:** `index.scss` hardcoded globals are the #1 blast radius risk.

---

### 🎨 Sally (UX Designer)

**Architecture:** Semantic token categories required — surface, text, border, brand (invariant orange/gold), feedback, game-specific. Flat 180-token namespace must evolve to semantic shape.

**Light theme identity:** "Day game at the park" — warm parchment base (`#F5F0E8`), navy becomes ink, orange/gold unchanged. Scoreboard may stay dark (intentional design exception).

**Toggle placement:** HomeScreen bottom + GameControls panel. Firmly against persistent header for this feature.

**v1 scope:** **Light + Dark only — System is v2.** Reason: FOWTM from `prefers-color-scheme` detection is disproportionate complexity for v1.

**Orange on light:** Requires `brand.orangeText: "#D4800A"` variant for small text in light mode.

**Token spec deliverable:** PR to `docs/style-guide.md` as markdown table.

---

### 🏗️ Winston (Architect)

**Architecture:** Hybrid — CSS custom properties as runtime layer (4–6 vars at `:root`), ThemeProvider as type layer. Not two systems — CSS handles pre-render FOWTM, ThemeProvider handles typed component access.

**Token rationalization:** **BLOCK on skipping it.** Two-tier architecture (palette + semantic) required. 180 tokens doubling to 360 without rationalization creates unmaintainable debt.

**FOWTM:** Blocking inline script in `<head>` is the only reliable solution. Must be first child of `<head>`.

**SCSS globals:** Migrate to `var(--color-bg)` / `var(--color-text)` — one-time change, decouples SCSS from hardcoded values.

**Module structure proposed:** `src/shared/theme/types.ts`, `dark.ts`, `light.ts`, `cssVars.ts`, `ThemeScript.tsx`.

**v1 scope:** Supports Light + Dark only (aligned with Sally on this).

---

### 💻 Amelia (Engineer)

**Architecture:** Agreed with Winston on CSS vars + ThemeProvider hybrid. Confirmed re-render concern for simulation game is real.

**Hook placement:** `src/shared/hooks/useThemePreference.ts` using `usehooks-ts` `useLocalStorage` + `useMediaQuery`.

**Stage A strategy:** `darkTheme` = exact copy of current theme. Zero snapshot breakage. Critical path insight.

**Migration scope:** 60+ `styles.ts` files = ~3–5 days depending on hardcoded hex density. Run audit grep before estimating.

**Tests needed:** `useThemePreference.test.ts`, extend `theme.contrast.test.ts`, add structural key parity test.

**E2E:** Dark-mode snapshots won't break if dark = current theme copy. Light theme snapshots expected to change in Stage D+.

**PRNG/RxDB:** Zero involvement. Pure UI preference layer.

---

## Round 2 — Cross-Talk and Convergence

### Key Dispute 1: CSS vars vs. pure ThemeProvider

**Winston (Round 2):** Conceded John's partial point — full parallel CSS var token system = drift risk. Revised to "CSS vars _only_ at `:root`" for FOWTM. ThemeProvider remains authoritative for components. This is not two systems.

**John (Round 2):** **Yielded to Winston on CSS vars.** Clincher: ThemeProvider doesn't solve FOWTM; the inline script does. Revised position: CSS vars + ThemeProvider hybrid.

**Outcome: Hybrid approach adopted.** 4–6 root-level CSS vars for FOWTM prevention only. ThemeProvider for all component tokens.

---

### Key Dispute 2: System preference in v1

**John (Round 1):** System + Light + Dark in v1.

**Sally (Round 1):** Light + Dark only — System adds FOWTM complexity.

**Winston (Round 2):** Supported Sally — System preference requires `prefers-color-scheme` handling that adds disproportionate complexity to v1. Recommended as one-sprint follow-on.

**John (Round 2):** **Yielded to Sally.** Dropping System from v1. Explicit v2 ticket with defined trigger: "after CSS vars layer is proven stable in production."

**Outcome: v1 = Light + Dark only.** System preference is explicit v2 with its own ticket.

---

### Key Dispute 3: Token rationalization timing

**Winston (Round 1):** **BLOCK** — full two-tier architecture required as prerequisite.

**John (Round 2):** Rejected "prerequisite" framing. Accepted "parallel track, opportunistic." Rationalize as you touch — any token modified during migration must be rationalized at that point. Structural parity test enforces completeness.

**Amelia (Round 1):** Stage A = exact dark theme copy. This creates a stable baseline for incremental rationalization without big-bang risk.

**Winston (Round 2, implied):** Accepted "rationalize as you touch" with the parity test gate. BLOCK resolved.

**Outcome: Opportunistic rationalization.** Gate = `theme.parity.test.ts` key-equality test. No big-bang prerequisite.

---

### Key Dispute 4: Visual regression snapshot scope

**Risk:** Doubling all Playwright snapshots is significant CI investment.

**Sally (Round 2):** New `theme-light` Playwright project with **~12–16 curated critical surface snapshots** only. Existing dark suite unchanged. Targeted, not duplicated.

**Critical surfaces for `theme-light` project:**

1. HomeScreen
2. GamePage mid-inning (scoreboard, bases, count)
3. GameControls panel
4. NewGameDialog / ExhibitionSetupPage
5. SavesModal
6. InstructionsModal / HelpPage
7. One career stats page
8. CustomTeamEditor (at least one view)

**Outcome: New `theme-light` Playwright project.** ~12 snapshots. Dark suite untouched.

---

### Toggle Placement — Convergence

All agents aligned on:

- **HomeScreen (bottom)** — primary entry point
- **GameControls panel** — secondary entry point for in-game access
- **No persistent header** for this feature

No dispute required resolution.

---

## Final Aligned Recommendations

| Question               | Final Answer                                      | Notes                                                       |
| ---------------------- | ------------------------------------------------- | ----------------------------------------------------------- |
| Architecture           | Hybrid: CSS vars at `:root` (4–6) + ThemeProvider | FOWTM via inline script; component tokens via ThemeProvider |
| v1 modes               | Light + Dark only                                 | System = explicit v2 ticket                                 |
| Default                | Dark                                              | No disruption to current users                              |
| Toggle placement       | HomeScreen bottom + GameControls                  | No new persistent header                                    |
| Token migration        | Opportunistic (rationalize as touched)            | Parity test as gate                                         |
| Token spec deliverable | PR to `docs/style-guide.md`                       | Sally owns; markdown table                                  |
| FOWTM prevention       | Blocking inline script in `<head>`                | Must run before any stylesheet                              |
| Snapshot strategy      | New `theme-light` project, ~12 surfaces           | Dark suite untouched                                        |
| PRNG/RxDB              | No involvement                                    | Pure UI layer                                               |
| Sprint estimate        | 3 sprints                                         | Stage A–B / Stage C / Stage D–E                             |
| Winston CR             | Required for Stage A                              | High-value architectural change                             |

---

## Unresolved / Watch Items

1. **`usehooks-ts` JSON encoding** — inline script must correctly compare stored value. `useLocalStorage` stores as `'"dark"'` (JSON-encoded). Inline script should use `JSON.parse()` or compare against `'"dark"'` not `"dark"`. Verify before Stage A ships.

2. **Orange contrast on parchment** — exact contrast ratio for `#FF9A1F` on `#F5F0E8` needs tool verification (estimated ~2.8:1, below 4.5:1). `brand.orangeText: "#D4800A"` is the mitigation — verify it achieves 4.5:1 in Stage B token spec.

3. **Scoreboard stays dark** — implementation approach needed. Options: (a) game-specific tokens always map to dark values regardless of theme, (b) component-level override. Decide in Stage D.

4. **`outline: none` audit** — before Stage A, grep for `outline: none` in styled files. Any occurrence without a custom replacement is an accessibility bug to fix (independent of theme).
