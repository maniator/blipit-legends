# Story 7.1 — F2: Logo PNG with srcset + Manifest Audit

**Sprint:** Sprint 2  
**Epic:** F2 — SVG Logo is Raster PNG  
**Status:** planned  
**Owner:** Amelia  
**Effort:** S  
**WCAG:** N/A (quality/HiDPI fix, not a WCAG item)

---

## User Story

**As** a user on a HiDPI/Retina display,  
**I want** the BlipIt Legends logo to render sharply at any resolution,  
**so that** the app looks professional and trustworthy on modern displays.

---

## Background

`public/images/blipit.svg` is actually a base64-encoded PNG wrapped in an SVG container — it is
**not** a true vector SVG. It renders visibly soft on HiDPI/Retina displays (200px logoMd size).
Winston's architectural verdict: "Switch to `blipit-512.png` with `srcset`."

---

## Acceptance Criteria

- [ ] Logo rendered via `<img src="blipit-512.png" srcset="blipit-512.png 1x, blipit-512.png 2x" sizes="..." alt="BlipIt Legends">` (or equivalent styled-component pattern)
- [ ] `public/manifest.webmanifest` audited; any SVG logo references replaced with PNG variants
- [ ] Logo is visually sharp on HiDPI (2× pixel ratio) in Playwright visual snapshots
- [ ] No regression on logo rendering in responsive-smoke spec
- [ ] "True vector SVG commission" documented as future design task (not a code task) in `deferred-work.md`
- [ ] Visual snapshot updated (logo change is intentional)

---

## Files to Modify / Create

```bash
# Find all logo references
rg "blipit\.svg\|blipit\.png\|logoMd\|logoSm" src/ public/ --files-with-matches
cat public/manifest.webmanifest
```

Likely:

- `public/manifest.webmanifest` — replace SVG icon reference with PNG
- Component that renders logo (e.g., `src/features/gameplay/components/HomeScreen/` or shared `Logo` component)
- Update `srcset` / `sizes` in logo `<img>` element
- `_bmad-output/implementation-artifacts/deferred-work.md` — append true-vector note

---

## Pre-PR Checklist

```bash
yarn lint
yarn typecheck
yarn typecheck:e2e
yarn test
yarn check:style-guide
# Visual snapshot regen: expected for logo; route to e2e-test-runner
```

---

## Notes

- Do **not** attempt to rewrite the SVG to true vector in this story — that is a design task.
- Focus only on switching the `<img>` reference to the existing PNG with proper srcset.
- If `blipit-512.png` does not exist in `public/images/`, extract it from the base64 in `blipit.svg` or request it from Sally.
