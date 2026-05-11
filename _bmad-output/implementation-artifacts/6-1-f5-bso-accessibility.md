# Story 6.1 — F5: BSO Accessibility (Color-Only Information)

**Sprint:** Sprint 2  
**Epic:** F5 — BSO Color-Only Information  
**Status:** planned  
**Owner:** Amelia (impl) → Sally (WCAG sign-off) → Buck (stadium-authenticity sign-off, see A5)  
**Effort:** M  
**WCAG:** 1.4.1 "Use of Color" Level A; 1.4.6 "Contrast (Enhanced)" Level AAA

---

## User Story

**As** a user with color vision deficiency (CVD),  
**I want** the Ball/Strike/Out count to be readable without relying on color alone,  
**so that** I can follow the game state accurately regardless of my color perception.

---

## Background

Ball/Strike/Out dots communicate game state exclusively through color (Ball=green `#44cc88`,
Strike=gold `#f5c842`, Out=red `#ff7070`). ~8% of males with red-green CVD cannot reliably
distinguish these. ~51/1000 users are meaningfully affected.

The spec was collaboratively designed by Sally (WCAG) and Buck (stadium authenticity). Sally
conceded to Buck's stadium-authentic approach — dots remain as decorative reinforcement while a
**visible text label** becomes the primary accessibility channel. See sign-off record:
`_bmad-output/implementation-artifacts/buck-f5-bso-signoff.md`.

---

## Acceptance Criteria

- [ ] `B 3  S 2  O 1` text label rendered directly beneath (mobile) or to the right of (desktop ≥ 1024px) the dot cluster
- [ ] Label uses existing scoreboard font family, weight 700, 20px mobile / 24px desktop
- [ ] Label uses `font-variant-numeric: tabular-nums`
- [ ] Letter-spacing 0.04em between B/S/O groups
- [ ] Label color measures **≥ 7:1 contrast (WCAG AAA SC 1.4.6)** against game page background
- [ ] Dots retain green/gold/red colors (decorative secondary channel)
- [ ] Dots have 1px inner border `rgba(0,0,0,0.35)` for grayscale/CVD distinguishability
- [ ] Dots tested in Sim Daltonism (deuteranopia + protanopia) — evidence screenshot attached to PR
- [ ] ARIA markup applied: `role="status"`, `aria-live="polite"`, `aria-atomic="true"`, `aria-label="Count: N balls, N strikes, N out"`, dot cluster wrapped in `aria-hidden="true"`
- [ ] No visual regression on existing BSO visual snapshots (update intentionally if layout changes)
- [ ] Unit test asserts text label renders correct count for various BSO states
- [ ] E2E test asserts label is visible and readable on game page

---

## Spec Detail

### Text Label — Primary Channel

```tsx
// Layout: label directly beneath dot cluster (mobile) or to right (desktop ≥ 1024px)
// Font: existing scoreboard family, weight: 700
// Size: 20px mobile, 24px desktop
// font-variant-numeric: tabular-nums
// letter-spacing: 0.04em between B/S/O groups
// Color: ≥ 7:1 contrast (AAA)
```

### Dots — Secondary Decorative Reinforcement

```tsx
// Keep existing green/gold/red colors
// Add: border: 1px solid rgba(0,0,0,0.35) — improves grayscale/CVD distinguishability
```

### Screen Reader ARIA

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

---

## Files to Modify

```bash
# Find BSO component
rg "Ball.*Strike.*Out\|BSO\|ballStrike\|bsoCount" src/ --files-with-matches
rg "bso\|BallStrikeOut" src/ --files-with-matches
```

Likely:

- `src/features/gameplay/components/Scoreboard/` (or similar BSO component)
- Associated `.test.tsx` for unit coverage
- `e2e/tests/` for E2E guard

---

## Pre-PR Checklist

```bash
yarn lint
yarn typecheck
yarn typecheck:e2e
yarn test
yarn check:style-guide
yarn check:circular-deps
# Snapshot regen: route to e2e-test-runner if layout changes
```

**Before implementing:** Confirm Buck sign-off recorded in
`_bmad-output/implementation-artifacts/buck-f5-bso-signoff.md` (Action item A5).

---

## Routing

- Implementation: Amelia
- WCAG sign-off: Sally (`bmad-agent-ux-designer`)
- Stadium-authenticity sign-off: Buck (`bmad-agent-baseball-manager`) — see A5 artifact
- Snapshot regen: `e2e-test-runner` operational specialist
