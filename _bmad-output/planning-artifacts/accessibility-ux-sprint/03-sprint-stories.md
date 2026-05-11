# 03 — Sprint Stories (Ready for Amelia)

Per-story acceptance criteria, suitable for `bmad-create-story` or direct implementation by Amelia. Stories are sequenced in the recommended implementation order — F1 audit must complete first because the CI guardrail it produces protects all subsequent token work.

---

## Story 1.1 — F1: Theme Audit (Paige-led prerequisite)

**As** a developer consulting `docs/style-guide.md`,
**I want** the documented colors to match the actual theme tokens,
**so that** I stop shipping wrong colors by default.

### Tasks

1. Run `rg -i '#[0-9a-f]{3,8}\b' src/` — produce inventory of every hex literal in source
2. Run same regex against `docs/` — produce inventory of every hex in documentation
3. Cross-reference inventories against `src/shared/theme.ts` exports
4. Flag orphaned tokens (zero consumers in src) — propose for removal
5. Flag drift hexes in docs (not present in theme) — slate for replacement
6. Commit audit artifacts as `_bmad-output/planning-artifacts/accessibility-ux-sprint/audit-results/` (markdown table)

### Acceptance Criteria

- [ ] Audit results committed to `_bmad-output/`
- [ ] Sally + Winston review and sign off on which orphaned tokens are deleted vs preserved
- [ ] Output feeds Story 1.2 (doc rewrite) and Story 1.3 (CI guardrail tests)

### Owner

Paige (lead) → Amelia (executes grep/script work)

### Effort

S (~2-3 hours)

---

## Story 1.2 — F1: Style Guide Doc Rewrite

**As** a developer consulting `docs/style-guide.md`,
**I want** the document to reflect the current orange/amber theme exactly,
**so that** new components inherit correct colors.

### Tasks

1. Replace all aquamarine/green hex literals with current theme values from `src/shared/theme.ts`
2. Update color swatch examples (and any embedded screenshots) to match
3. Verify button variants, form elements, status patterns, modal/card sections all reference current tokens
4. Add a "Last audited" timestamp + reference to the F6 Tier-1 audited tokens

### Acceptance Criteria

- [ ] Every hex/token in `docs/style-guide.md` exists in `src/shared/theme.ts`
- [ ] Sally signs off that visual examples match shipped UI
- [ ] No orphaned tokens documented

### Owner

Paige

### Effort

S

---

## Story 1.3 — F1: CI Guardrail (`check-style-guide-drift.ts`)

**As** the project,
**I want** CI to fail when `docs/style-guide.md` drifts from `src/shared/theme.ts`,
**so that** this audit never has to be done manually again.

### Tasks

1. Create `scripts/check-style-guide-drift.ts`
2. **Approach:** runtime tsx import of `src/shared/theme.ts`, walk nested object recursively
3. Extract hex/rgba from `docs/style-guide.md` via regex: `/#[0-9a-fA-F]{3,8}\b/g` and `/\brgba?\([^)]+\)/g`
4. Normalize hex (lowercase, expand 3-digit, strip alpha=ff)
5. Validate dotted-path token references (`theme.colors.primary.main`)
6. Skip fenced code blocks tagged `bad`/`diff`/`old`
7. Support `<!-- style-guide-ignore -->` inline marker
8. Add `yarn check:style-guide` script to `package.json`
9. Chain into existing `lint` script (e.g. `"lint": "eslint . && yarn check:style-guide"`)
10. Add unit test in `src/__tests__/check-style-guide-drift.test.ts` with two fixtures: known-good (passes), known-bad (fails) — must live under `src/` so Vitest (`root: "src"`) discovers it

### Acceptance Criteria

- [ ] Script exits 0 on current matched state
- [ ] Script exits non-zero when synthetic drift is introduced (verified via fixture test)
- [ ] CI lint job invokes it (no new workflow file needed)
- [ ] Self-test fixture passes on `yarn test`

### Owner

Amelia

### Effort

S (~2-3 hours)

### Notes

- DO NOT add to husky pre-commit — lint-staged only sees staged files; cross-file drift won't trigger
- DO NOT use ts-morph (overkill, ~15MB dep) or naive regex on theme.ts (nested shape breaks it)

---

## Story 2.1 — F3: Touch Target Hit Expansion

**As** a mobile/tablet user,
**I want** small UI buttons to be easy to tap accurately,
**so that** I don't mis-tap and trigger the wrong action.

### Tasks

1. Identify all interactive elements with effective tap area < 44×44 CSS px:
   - `HelpButton` (currently 25×25)
   - All modal/dialog close buttons (currently 28×28)
   - Save card Load/Export/Delete buttons (currently 32 px height)
   - Any other interactive control < 44px in either dimension
2. Apply transparent hit-area expansion via `::before` pseudo-element:
   ```ts
   const Button = styled.button`
     position: relative;
     /* visible footprint unchanged */
     &::before {
       content: "";
       position: absolute;
       inset: -<delta>px; /* compute so total ≥ 44×44 */
     }
   `;
   ```
3. **MUST NOT use real padding** — would shift neighboring layout
4. Verify no visual regression on `e2e/tests/responsive-smoke.spec.ts` and any component snapshots

### Acceptance Criteria

- [ ] All flagged buttons have ≥ 44×44 effective tap area; validated via two-part E2E check: (a) computed-style assertion that `::before` `top`/`left` insets are sufficiently negative (i.e., total span ≥ 44 px), and (b) `page.mouse.click()` edge-probe at coordinates 1–2 px outside the visual button confirming the click handler fires — `boundingBox()` alone is NOT used because it reflects only the element's layout box, not the overflowing `::before`
- [ ] Visual snapshots unchanged (visible footprint identical)
- [ ] New unit test asserts `::before` pseudo-element inset via `getComputedStyle(el, "::before")` (use `data-testid` on parent)
- [ ] New E2E test in `e2e/tests/touch-targets.spec.ts` (or extension to existing accessibility spec) asserts hit area on each fixed button via edge-probe clicks

### Owner

Amelia

### Effort

S

---

## Story 3.1 — F6 Tier 1: High-Impact Contrast Token Bumps

**As** a user reading the scoreboard, save list, or any body copy,
**I want** text to be comfortably readable against the dark background,
**so that** I don't squint, misread, or give up.

### Tasks

1. Update `src/shared/theme.ts` tokens to meet WCAG thresholds:
   - `textHint`: bump to ≥ 4.5:1 against `#0d1b2e` (suggested: `#a8b8d0` — verify with axe-core/contrast checker)
   - `textNavFaint`: bump to ≥ 4.5:1 against `#000000` (currently 2.0:1 — needs significant lightening)
   - `textScoreDim`: bump to ≥ **7:1** (AAA) against `#0a1628` (game-critical scoreboard)
   - Table `Th` color: bump to ≥ 4.5:1 (suggested: `#b0b8c4` or higher)
   - Scoreboard primary numerics: ensure ≥ **7:1** (AAA)
2. Run axe-core (or Lighthouse a11y audit) on the following surfaces and attach reports to PR:
   - Home screen
   - Game page (in-progress game)
   - Saves list
   - Modal (any modal)
   - Custom team editor
3. Update the rewritten `docs/style-guide.md` to mark these tokens as "audited — Sprint 1"
4. Review each affected visual snapshot diff individually (NOT bulk regenerate)
5. **Mid-sprint check:** if more than 15 snapshots break, raise alarm to John for re-triage

### Acceptance Criteria

- [ ] All 5 listed tokens measure ≥ stated WCAG threshold
- [ ] axe-core report shows 0 contrast violations on body, scoreboard, save list, modal surfaces
- [ ] Snapshot diffs individually reviewed and approved by Sally
- [ ] Style guide marks tokens as audited, F6-remainder tokens explicitly identified
- [ ] No previously-passing surface introduces new failures

### Owner

Amelia (impl) → Sally (WCAG sign-off)

### Effort

M (depends on snapshot count)

### Hidden Risks

- **Snapshot cascade.** Estimated 8-12 snapshots; ceiling 15 before re-triage
- **Visual harmony:** bumping `textHint` while leaving `textDimmer` (Tier 2) untouched may look inconsistent — mitigate with explicit "audited vs pending" note in style guide

---

## Story 4.1 — F9: League Entry-State Regression Guard (v1)

**As** a user on the home screen,
**I want** league entry UI states (idle vs active season) to remain accurate,
**so that** I always get the correct action ("Start a Season" vs "Continue Season") and trust the navigation.

### Tasks

1. Verify HomeScreen idle state includes `data-testid="home-browse-leagues-button"` and label "Start a Season"
2. Verify active-season state includes `data-testid="home-continue-season-button"` and uses `activeSeasonLabel`
3. Extend unit/E2E coverage where needed to lock both states:
   - `src/features/gameplay/components/HomeScreen/HomeScreen.test.tsx`
   - `e2e/tests/home.spec.ts` and/or `e2e/tests/league.spec.ts`
4. Remove stale sprint instructions that still mention lock icon / pointer-events / "coming soon"

### Acceptance Criteria

- [ ] Idle state path to `/leagues` covered by automated tests
- [ ] Active season "Continue Season" state covered by automated tests
- [ ] Sprint artifacts no longer instruct pre-v1 "coming soon" teaser behavior

### Owner

Amelia

### Effort

XS

---

## Story 5.1 — F10: `lang` Attribute Regression Guard

**As** a screen-reader user,
**I want** the page to declare its language,
**so that** TTS pronunciation, spell-check, hyphenation, and quote styling all work correctly.

### Tasks

1. Verify `src/index.html` root element remains `<html lang="en">`
2. Add/retain a unit guard test that reads `src/index.html` directly (path-safe under Vitest root rules)
3. Optionally mirror with a lightweight E2E assertion on `<html lang>`
4. Document the guard in `_bmad-output/planning-artifacts/accessibility-ux-sprint/05-test-strategy.md`

### Acceptance Criteria

- [ ] `<html lang="en">` present in `src/index.html`
- [ ] Automated test guards the attribute
- [ ] Test failure surfaces in CI

### Owner

Amelia

### Effort

XS

---

## Sequencing & Dependencies

```
Story 1.1 (F1 Audit, Paige)
    ↓
    ├──→ Story 1.2 (F1 Doc Rewrite, Paige)
    │       ↓
    │       └──→ Story 1.3 (F1 CI Guardrail, Amelia)
    │
    └──→ Story 3.1 (F6 Tier 1 Contrast, Amelia)  ← depends on audit identifying token surface
                ↓
                └──→ axe-core verification (Sally signs off)

PARALLEL (no F1 dependency):
    Story 2.1 (F3 Touch Targets, Amelia)
    Story 4.1 (F9 league state regression guard, Amelia)
    Story 5.1 (F10 lang regression guard, Amelia)
```

**Recommended execution order for the future implementing agent:**

1. Story 1.1 (audit) — gates everything else
2. Story 5.1, 4.1, 2.1 — quick wins, no F1 dependency, build sprint momentum
3. Story 1.2 + 1.3 — doc rewrite + CI script
4. Story 3.1 — F6 Tier 1 contrast bumps (highest snapshot risk, do near end with full attention)
5. Final consolidated PR → Winston CR sign-off → merge

---

## Sprint 2 Story Shells (placeholders, NOT to build in Sprint 1)

These are listed only so the future agent knows what's coming and can avoid making Sprint 1 decisions that compromise Sprint 2.

- **Story 6.1** — F5: BSO accessibility (spec is locked in `01-findings-detail.md`, ready to build)
- **Story 7.1** — F2: Logo PNG with srcset + manifest audit
- **Story 8.1** — F4: Font size minimum bump (xs → 12px), token migration
- **Story 9.1** — F6 Tier 2: secondary metadata, timestamps, footer contrast bumps
- **Story 10.1** — F8: Focus indicator audit (candidate)
