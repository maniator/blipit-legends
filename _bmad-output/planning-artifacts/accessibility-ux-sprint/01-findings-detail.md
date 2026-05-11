# 01 — Findings Detail (Evidence + Specs)

All 10 findings from Sally's heuristic review, enriched with WCAG citations (Mary), persona quotes from the interview round, and final implementation specs locked through cross-talk.

---

## F1 — Style Guide ↔ Theme Drift `[P0 — Sprint 1]`

### What's broken

`docs/style-guide.md` documents the legacy aquamarine/green accent palette, but `src/shared/theme.ts` has migrated to orange/amber (`#FF9A1F`, `#F2C14E`). Every developer consulting the style guide for new component work currently ships wrong colors by default.

### Why P0 (not just "doc cleanup")

**Sally:** "It's a multiplier bug. Every future PR consulting that doc ships wrong colors. It's not one broken pixel; it's a pipeline that manufactures inconsistency indefinitely."

**P6 (Power User):** "Inconsistent accent colors tell me the codebase has no enforced design contract. If the save button and load button look different, I'm mentally auditing whether they also behave differently under the hood. Fix your token system or I'll assume the simulation logic has the same discipline problem."

### Architectural verdict (Winston)

**REQUEST_CHANGES on naive doc-only fix.** "Audit before documenting. Doc update alone would lock in a false picture of the token surface."

### Required audit (Paige) — must complete before doc rewrite

1. Extract canonical tokens from `src/shared/theme.ts` — list every named export, hex/HSL value, consumer count
2. Inventory hex literals in `src/`: `rg -i '#[0-9a-f]{3,8}\b' src/` — triage each
3. Inventory hex literals in `docs/`: same regex against `docs/`; cross-reference (1) — anything in docs absent from theme = drift
4. Confirm with Sally/Winston which old tokens are deprecated vs renamed vs deleted
5. Flag orphaned tokens in theme.ts (zero consumers) for Winston removal review
6. Visual audit: any swatch images in style-guide may also be stale

### CI guardrail spec (locked — see D4 in 00-overview)

- `scripts/check-style-guide-drift.ts` — runtime tsx import of theme + regex extraction from doc
- Normalize hex (lowercase, 6-digit, strip alpha=ff); validate dotted paths
- Skip fenced `bad`/`diff` blocks; support `<!-- style-guide-ignore -->` inline marker
- Self-test fixture in `scripts/__tests__/`
- Wire as `yarn check:style-guide`, chain into existing `lint` script
- Effort: S (~2-3h)

### Acceptance criteria

- [ ] Audit artifacts (steps 1-6) committed to PR description or this `_bmad-output/` directory
- [ ] `docs/style-guide.md` references only tokens/hexes present in `src/shared/theme.ts`
- [ ] Zero orphaned tokens in theme.ts (or each is explicitly justified in PR)
- [ ] `check-style-guide-drift.ts` passes locally and in CI
- [ ] Sally signs off that visual examples match shipped UI
- [ ] Follow-up issue filed for promoting hardcoded hexes in `src/` into named tokens (out of scope here)

---

## F2 — SVG Logo is Raster PNG `[P1 — Sprint 2]`

### What's broken

`public/images/blipit.svg` is actually a base64-encoded PNG wrapped in an SVG container. Visibly soft on HiDPI/Retina displays at 200px logoMd size.

### Persona signals

- **P5 (Stats Fan):** "On a 4K display the logo is visibly soft. It looks like a screenshot of a logo, not a logo. When I'm about to trust ERA calculations, a blurry logo is a bad opening handshake. SVG is table stakes in 2025."
- **P6 (Power User):** "A base64-encoded raster embedded inside an SVG wrapper is not an SVG — it's a PNG wearing a costume. Whoever shipped this either didn't know the difference or didn't care, and both make me wonder what else in the asset pipeline was rubber-stamped."
- **P1 (Casual Watcher):** Notices it on home screen but doesn't churn over it.

### Architectural verdict (Winston)

**REQUEST_CHANGES.** "Switch to `blipit-512.png` with `srcset`. If `public/manifest.webmanifest` references the SVG, audit that reference too — a base64-PNG-in-SVG wrapper may be rejected by some manifest validators."

### Sprint 2 spec

- Switch logo references to `blipit-512.png` with proper `srcset` and `sizes` attributes
- Audit `public/manifest.webmanifest` for SVG references; replace with PNG variants if found
- Document true-vector commission as a future design task (not a code task)

---

## F3 — Touch Targets Below WCAG `[P1 — Sprint 1]`

### What's broken

- `HelpButton`: 25×25 px
- Close buttons: 28×28 px
- `inputSm` height: 30 px
- Save-card Load/Export/Delete buttons: 32 px height

### WCAG citations (Mary)

- **WCAG 2.2 SC 2.5.8 "Target Size (Minimum)" Level AA:** ≥ 24×24 CSS pixels
- **WCAG 2.2 SC 2.5.5 "Target Size (Enhanced)" Level AAA:** ≥ 44×44 CSS pixels
- Apple HIG recommends 44pt; Material Design recommends 48dp — both stricter than WCAG AA

### Persona signals

- **P1 (Casual Watcher):** "Lying in bed, one-handing my phone, I tap the Help or close button and _nothing happens_ — so I tap again, slightly harder, slightly off. A 25px button at 11pm with one thumb is basically a test I didn't sign up for. I've rage-closed apps for less."
- **P4 (Save Curator):** "I've started using a stylus specifically because I was afraid of hitting Delete when I meant Export. Minimum 44px touch targets on anything that touches my saves — this isn't a nice-to-have."
- **P2 (Manager Strategist):** "On tablet I've accidentally dismissed the decision panel when I meant to tap something nearby. The undersized close button has cost me meaningful Manager Mode interactions."

### Spec (locked — D3 in 00-overview)

- Bump effective tap area to ≥ 44×44 CSS px on: HelpButton, all close buttons, save-card action buttons (Load/Export/Delete)
- **MUST use transparent hit-area expansion** (`::before` pseudo-element with `position: absolute; inset: -<delta>px;`) — NOT real padding that shifts neighboring layout
- Visual footprint of buttons unchanged — only hit area expands

### Acceptance criteria

- [ ] All flagged buttons have ≥ 44×44 effective tap area when measured via Playwright `boundingBox()`
- [ ] No visual regression on `e2e/tests/responsive-smoke.spec.ts` snapshots
- [ ] Visual snapshots for `HelpButton`, save cards, modal close buttons unchanged (visible footprint identical)
- [ ] New unit test in component test file asserting `::before` pseudo-element exists and has correct inset

---

## F4 — Small Font Sizes `[P1 — Sprint 2]`

### What's broken

Theme tokens `xs=10px`, `sm=11px`, `tiny=0.7rem` used for visible text labels in scoreboard, stats tables, and editor.

### Persona signals

- **P1:** "With my astigmatism, 10px text in a dark room isn't text — it's just texture."
- **P3 (Team Builder):** "Fine-tuning nine lineup slots at 10-11px stat labels is a squinting exercise even with perfect vision. Density should come through layout efficiency, not shrinking text until illegible."
- **P5 (Stats Fan):** "10px labels next to 13px data create a near-flat hierarchy — that's not a hierarchy, that's two small things. Bump labels to 11px and headers to 13px and the whole table breathes correctly."
- **P6:** "Labels at that size suggest the layout didn't account for them — which makes me wonder whether the _data driving them_ was an afterthought too."

### Sprint 2 spec

- Raise minimum visible text size to **12px** (no exceptions)
- Migrate `xs` token usages to `sm` (12px) or higher
- Token-level work — depends on F1 token audit completing first
- **Hidden complexity (Amelia):** breaks unknown number of visual snapshots — budget Docker regen time

---

## F5 — BSO Color-Only Information `[P1 — Specced now, built Sprint 2]`

### What's broken

Ball/Strike/Out dots communicate game state exclusively through color (Ball=green `#44cc88`, Strike=gold `#f5c842`, Out=red `#ff7070`). ~8% of males with red-green CVD cannot reliably distinguish.

### WCAG citation (Mary)

**WCAG 2.2 SC 1.4.1 "Use of Color" Level A:** Color must not be the only visual means of conveying information.

### User impact (Mary's math)

~51/1000 users (60% male skew × 8% red-green CVD prevalence + ~3 female users) cannot reliably read current count by color alone.

### Persona signals

- **P6 (Power User):** "I want a count that reads `B: 3 S: 2 O: 1` somewhere, unambiguously, always. Color-only differentiation means I'm doing state inference, not state reading. For a simulator where the entire point is deterministic reproducibility, making the current count ambiguous is a design failure proportional to the feature's centrality."
- **P2:** "What I want is the count to be visually dominant — size and contrast matter more to me than color coding."
- **P1:** "The text labels save me at night. Without those I'd be lost on the count."

### Final spec (locked — Sally conceded to Buck's stadium-authentic approach)

**Visible text label — primary channel:**

- Render `B 3  S 2  O 1` as a single line directly beneath (mobile) or to the right of (desktop ≥ 1024px) the dot cluster
- Font: existing scoreboard family
- **20px mobile / 24px desktop**, weight 700
- `font-variant-numeric: tabular-nums` (digits don't jitter as count changes)
- Letter-spacing 0.04em between B/S/O groups so they parse as three chunks
- Color must measure **≥ 7:1 contrast (WCAG AAA SC 1.4.6)** — primary state readout

**Dots — secondary, decorative reinforcement:**

- Keep green/gold/red colors
- Add 1px inner border (`rgba(0,0,0,0.35)`) for grayscale/CVD distinguishability
- **Test in Sim Daltonism** (deuteranopia + protanopia) before merge

**Screen reader hybrid:**

```html
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
  aria-label="Count: 3 balls, 2 strikes, 1 out"
>
  <span aria-hidden="true">B 3 S 2 O 1</span>
  <!-- dot cluster -->
</div>
```

- `aria-live="polite"` — won't interrupt play-by-play TTS

### Sign-off owners

- WCAG: Sally
- Stadium authenticity: Buck

---

## F6 — Low-Contrast Text `[P1 — Tier 1 in Sprint 1, Tier 2/3 deferred]`

### What's broken

Multiple theme tokens fail WCAG 1.4.3 minimum contrast (4.5:1 for normal text):

| Token          | Foreground | Background | Approx Ratio | Status    |
| -------------- | ---------- | ---------- | ------------ | --------- |
| `textDimmer`   | `#6B7785`  | `#0d1b2e`  | ~3.2:1       | FAIL      |
| `textHint`     | `#6680aa`  | `#0d1b2e`  | ~3.8:1       | FAIL      |
| `textNavFaint` | `#3a5070`  | `#000000`  | ~2.0:1       | FAIL HARD |
| `textScoreDim` | `#3d5a7a`  | `#0a1628`  | ~1.8:1       | FAIL HARD |
| Table `Th`     | `#888`     | `#0d1b2e`  | ~3.8:1       | FAIL      |

### WCAG citations (Mary)

- **WCAG 2.2 SC 1.4.3 "Contrast (Minimum)" Level AA:** ≥ 4.5:1 for normal text; ≥ 3:1 for large text (≥ 18pt or ≥ 14pt bold)
- **WCAG 2.2 SC 1.4.6 "Contrast (Enhanced)" Level AAA:** ≥ 7:1 for normal text

### User impact (Mary's math)

**~250-350 users of 1000 meaningfully affected.** Presbyopia affects ~100% of adults 45+; ~25% of audience likely 45+; CVD overlap adds ~50 more.

### Universal persona signal

- **P1:** "My single biggest readability issue. I end up ignoring whatever's written there and hoping it wasn't important — until it turns out it was the inning or the score."
- **P2:** "**This is my number one gameplay grievance.** Subdued hint-text styling on game-critical data is a category error. Hints can be soft; game state cannot."
- **P3:** "Reading 20+ labels per session at 3.8:1 contrast adds up to real cognitive fatigue."
- **P4:** "Save date text washes out completely on a bright tablet by a window. Date metadata is load-decision-critical — not decorative."
- **P5:** "When I see a designer didn't check contrast on table headers, I start wondering what else wasn't checked. Wrong contrast on data labels is a _correctness signal_ to me."
- **P6:** "Asking me to trust data I can't comfortably read is a contradiction in terms."

### Tier-1 slice (Sprint 1)

**Tokens to bump:**

- `textHint` → bump until ≥ 4.5:1 against `#0d1b2e`. Suggested target: `#a8b8d0` or similar
- `textNavFaint` → bump until ≥ 4.5:1 against `#000000`. Currently 2.0:1 — needs significant lightening
- `textScoreDim` → bump until ≥ 7:1 against `#0a1628` (AAA — used on game-critical scoreboard)
- Table `Th` color (`#888`) → bump to `#b0b8c4` or higher (≥ 4.5:1)
- Scoreboard primary numerics → ensure ≥ 7:1 (AAA)

**Surfaces covered by Tier 1:** body text, scoreboard numerics, button labels, form input labels, modal copy.

**Estimated snapshot churn:** ~8-12 snapshots (per Amelia's revised estimate after slicing). **Hard ceiling:** if Tier 1 exceeds 15 snapshots mid-sprint, re-triage immediately.

### Tier 2 (Sprint 2)

- Secondary metadata, timestamps, footer text, help text
- `textDimmer` cleanup
- Remaining table cell variants

### Tier 3 (backlog)

- Decorative/ambient text, debug overlays, logo subtext

### Acceptance criteria for Tier 1

- [ ] All tokens listed above measure ≥ stated WCAG threshold using a contrast tool (e.g. axe-core or `https://webaim.org/resources/contrastchecker/`)
- [ ] axe-core report attached to PR shows 0 contrast violations on body, scoreboard, save list, and modal surfaces
- [ ] Visual snapshot diffs reviewed individually (NOT auto-regenerated wholesale)
- [ ] Tokens marked as "audited — Sprint 1" in the rewritten style guide so remaining tokens are clearly identified as F6-remainder
- [ ] No new failures introduced on previously-passing surfaces

---

## F7 — No Light/High-Contrast Mode Support `[P2 — Roadmap]`

### What's broken

No `prefers-color-scheme` or `prefers-contrast` media query handling. App is dark-theme only.

### Persona signals

- **P4:** "On the tablet at the kitchen table on a Saturday morning with sunlight, the whole interface reads muddy. A high-contrast option would eliminate half my eyestrain complaints."
- **P1:** "I'd flip a single toggle if it existed and never touch it again."
- **P6:** "Absence of a high-contrast mode means CSS custom properties weren't structured for theming, which has downstream implications for adding light mode later without a full CSS rewrite."

### Status

**Roadmap.** Significant engineering lift; downstream of F6 contrast work. Revisit post-League-Mode GA.

---

## F8 — Focus Indicator on Home Navigation `[P2 — DEFERRED, NOT Sprint 1]`

### What's broken

`focus-visible`-only focus rings — may miss keyboard users on older browsers.

### Persona signals

- **P3:** "A strong focus ring on every interactive element in the editor is a productivity feature for me, not just an accessibility one."
- **P5:** "Tab through stats tables to navigate columns. Weak or absent rings on 10-column tables lose me instantly."
- **P6:** "If the active element isn't visually indicated, I'm flying blind."

### Status

**Out of Sprint 1 (Winston explicit ruling).** Reconsider for Sprint 2 alongside F6 Tier 2 — keyboard-power-user crowd cares.

---

## F9 — League Teaser Affordance `[P2 — Sprint 1]`

### What's broken

`LeagueTeaserBox` uses gold text (`#f0c040`) styled like an interactive CTA but is non-interactive. Users tap/click it expecting a roadmap or signup flow; nothing happens.

### Persona signals

- **P1:** "I tapped that gold box. Then I tapped again thinking my first tap didn't register. Then I sat there for a second feeling mildly stupid before moving on. I felt vaguely tricked, and now I don't fully trust other things in the UI that look interactive."
- **P2:** "Either make it do something or style it as a static badge so I stop trying to interact with it."
- **P6:** "A developer shipped a component with interactive visual affordance without wiring it to any action. I've now lost confidence in whether _other_ interactive elements are wired correctly. I start stress-testing buttons I should be able to trust."

### Spec (Sprint 1)

- Add `pointer-events: none` and `cursor: default` to outer container
- Add a lock icon (or similar non-interactive glyph) to the visual to clearly signal "not yet"
- Update copy from "League play coming soon" to a more concrete "🔒 League Mode — Coming [target quarter]"
- Verify no `onClick` handler is bound

### Acceptance criteria

- [ ] Element no longer responds to clicks (Playwright test confirms no event fires)
- [ ] Lock icon visible
- [ ] Copy is specific (target quarter, e.g., "Coming Q3 2026")
- [ ] Visual snapshot updated

---

## F10 — Missing `lang` Attribute Verification `[P2 — Sprint 1]`

### What's broken

Need to confirm `<html lang="en">` is set in `index.html`.

### WCAG citation (Mary)

**WCAG 2.2 SC 3.1.1 "Language of Page" Level A** — required, not optional. Affects:

- Screen reader pronunciation
- Browser spell-check behavior
- CSS `hyphens` property
- Quote styling (`<q>` element)

### Persona signals

- **P4:** "I use a screen reader occasionally with my tablet. Misidentified language causes TTS to mispronounce team names in confusing ways."
- **P6:** "It's the kind of omission that happens when someone generates a boilerplate `index.html` and ships it unchanged. Thirty seconds to add. Objectively incorrect to omit."

### Spec

- Verify `index.html` root element is `<html lang="en">`
- If missing or different, add it
- Effort: XS (one-line check + possibly one-line fix)

### Acceptance criteria

- [ ] `<html lang="en">` present in `index.html`
- [ ] Add a unit/E2E test that asserts the attribute is present (shift-left guardrail)

---

## Summary Table

| ID        | Severity | Sprint      | Effort | WCAG SC          | Owner                             |
| --------- | -------- | ----------- | ------ | ---------------- | --------------------------------- |
| F1        | P0       | 1           | M      | — (process)      | Paige + Amelia                    |
| F2        | P1       | 2           | S      | —                | Amelia                            |
| F3        | P1       | 1           | S      | 2.5.5 / 2.5.8    | Amelia                            |
| F4        | P1       | 2           | M      | (no specific SC) | Amelia                            |
| F5        | P1       | 2 (specced) | M      | 1.4.1 + 1.4.6    | Amelia (Sally spec, Buck signoff) |
| F6 Tier 1 | P0       | 1           | M      | 1.4.3 / 1.4.6    | Amelia                            |
| F6 Tier 2 | P1       | 2           | M      | 1.4.3            | Amelia                            |
| F6 Tier 3 | P2       | backlog     | M      | 1.4.3            | TBD                               |
| F7        | P2       | roadmap     | L      | (multiple)       | TBD                               |
| F8        | P2       | 2 candidate | XS-S   | 2.4.7 / 2.4.11   | TBD                               |
| F9        | P2       | 1           | S      | — (UX)           | Amelia                            |
| F10       | P2       | 1           | XS     | 3.1.1            | Amelia                            |
