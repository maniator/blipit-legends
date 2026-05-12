# Light / Dark Mode — Implementation Stage Checklist

> **Status:** Planning — ready for sprint assignment
> **Reference:** `_bmad-output/planning-artifacts/light-dark-mode/plan.md`
> **Date:** 2026-05-12

---

## Stage A — Theme Foundation

> Sprint 1 | ~1–2 days dev | Zero user-visible change | Zero snapshot breakage

- [ ] Define `AppTheme` interface in `src/shared/theme/types.ts`
- [ ] Create `src/shared/theme/dark.ts` — exact copy of current `theme` (zero value changes)
- [ ] Create `src/shared/theme/light.ts` — interface-satisfying stubs (obvious placeholder values)
- [ ] Create `src/shared/hooks/useThemePreference.ts` using `useLocalStorage("themeMode", "dark")`
- [ ] Update `src/index.tsx` — pass `resolvedTheme` from hook to `ThemeProvider`
- [ ] Migrate `src/index.scss` body/`*` globals to CSS custom properties (`var(--color-bg)`, `var(--color-text)`)
- [ ] Add CSS vars to `index.scss`: bare `:root {}` block with **dark values as defaults** + `:root[data-theme="light"]` overrides (no `[data-theme="dark"]` block — dark is the baseline)
- [ ] Add FOWTM prevention to `src/index.html`: (a) `data-theme="dark"` attribute on `<html>`, (b) inline script placed **before any `<link rel="stylesheet">` / `<style>` tags** (not necessarily the very first element — `<meta charset>`, viewport, and SEO meta tags may precede it)
- [ ] Update `src/styled.d.ts` if `AppTheme` shape changes
- [ ] Write `src/shared/hooks/useThemePreference.test.ts`
- [ ] Extend `src/shared/theme.contrast.test.ts` to cover both themes
- [ ] Add `src/shared/theme.parity.test.ts` (key parity check between light/dark)
- [ ] **Gate: all existing E2E visual snapshots pass; `yarn test` and `yarn build` pass**

**Winston sign-off required before merging Stage A** (high-value architectural change per routing rules)

---

## Stage B — Light Theme Token Spec

> Sprint 1 | Design work, no code | Critical path for Stage C+

- [ ] Sally produces PR to `docs/style-guide.md` — "Light Theme Tokens" section
  - Format: markdown table — Token name | Dark value | Light value
  - Covers: surface, text, border, brand (incl. `orangeText`), feedback, game-specific
  - Documents scoreboard exception ("scoreboard stays dark in light mode")
  - Documents `brand.orangeText: "#D4800A"` for small text in light mode
- [ ] Winston reviews for architectural consistency
- [ ] Amelia reviews for implementation feasibility
- [ ] **Gate: PR merged before Stage C begins**

---

## Stage C — Toggle UI

> Sprint 2 | ~0.5–1 day coding | Depends on Stage B

- [ ] Create `src/shared/components/ThemeToggle/` component (pill toggle, sun/moon)
- [ ] Add toggle to HomeScreen (bottom of button list, `src/features/gameplay/components/HomeScreen/`)
- [ ] Add toggle to GameControls panel (`src/features/gameplay/components/GameControls/`)
- [ ] Both toggles use `useThemePreference` hook (same `localStorage` key)
- [ ] Verify `aria-label` reflects the result of the click ("Switch to light mode" / "Switch to dark mode")
- [ ] Touch target ≥ 44×44px on mobile
- [ ] Keyboard: tab-focusable, Space/Enter activates
- [ ] Focus ring visible in both themes (2px solid, 2px offset)
- [ ] Theme transition uses `data-theme-transitioning` attribute on `<html>` (scoped to toggle window only — never `body *` globally, which would also fire on in-game updates)
- [ ] `useThemePreference` updates `<meta name="theme-color">` dynamically (dark: `#0F1E34`, light: `#F5F0E8`)
- [ ] Write integration test: toggle → reload → verify persistence
- [ ] **Gate: all existing dark-mode snapshots still pass; toggle accessible; PWA `theme-color` correct; `yarn lint` and `yarn typecheck` pass**

---

## Stage D — Core Surface Migration

> Sprint 2–3 | ~2–3 days dev | Snapshot regeneration expected

- [ ] Replace light theme stubs with real values from Stage B token spec
- [ ] Run hardcoded hex audit: `grep -r '#[0-9a-fA-F]\{3,6\}' src --include='*.ts' --include='*.tsx'`
- [ ] Migrate `src/shared/components/` styled files — all theme token refs, no hardcoded hex
- [ ] Migrate HomeScreen, modals (InstructionsModal, SavesModal), forms, buttons, cards
- [ ] Migrate status banners, help content
- [ ] Create `e2e/tests/visual/theme-light.spec.ts` (12 critical surface snapshots)
- [ ] Add `theme-light` project to `e2e/playwright.config.ts`
- [ ] **Snapshot baseline generation via `e2e-test-runner` agent** (inside Docker container — never locally)
- [ ] WCAG AA contrast verified on HomeScreen, Modals, Forms in both themes
- [ ] **Gate: `theme-light` Playwright project passes on CI; no regressions in dark-mode suite**

---

## Stage E — Gameplay, Leagues, and Cleanup

> Sprint 3+ | ~4–5 days dev | Final sweep

- [ ] Migrate `src/features/gameplay/components/` styled files (~20 files)
  - [ ] Scoreboard / LineScore
  - [ ] Active game page / GameDiv
  - [ ] CountBoard, BSO indicators
  - [ ] DecisionPanel
  - [ ] HitLog, Announcements
  - [ ] GameControls (already partially touched in Stage C)
- [ ] Migrate league, season, saves, customTeams, careerStats styled files (~20 files)
- [ ] Final hardcoded hex sweep — zero non-token colors remaining
- [ ] Update `docs/style-guide.md` — add "Theme Token Enforcement" note
- [ ] Update developer README if theme token conventions need documenting
- [ ] Final `theme-light` snapshot update after all surfaces migrated
- [ ] **Gate: all 12+ `theme-light` snapshots pass; both themes WCAG AA; `yarn lint` + `yarn typecheck` pass**

---

## v2 Backlog (Explicitly Deferred)

- [ ] System preference (`"system"` third option following OS setting)
- [ ] Animated theme crossfade (respecting `prefers-reduced-motion`)
- [ ] Theme-aware PWA manifest and OG images
- [ ] Full CSS custom property extraction (beyond 4–6 root vars)
- [ ] Per-screen theme overrides as a first-class design system feature

---

## Key Coordination Points

| Coordination                   | Who                             | When                        |
| ------------------------------ | ------------------------------- | --------------------------- |
| Winston CR sign-off on Stage A | Winston + Amelia                | Before Stage A merge        |
| Light theme token spec         | Sally → Winston + Amelia review | Sprint 1 Week 2–3 (Stage B) |
| Snapshot baseline generation   | `e2e-test-runner` agent         | Stage D and E               |
| Orange contrast audit          | Sally + Amelia                  | Stage D                     |
