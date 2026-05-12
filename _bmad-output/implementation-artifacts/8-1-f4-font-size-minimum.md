# Story 8.1 — F4: Font Size Minimum Bump

**Sprint:** Sprint 2  
**Epic:** F4 — Small Font Sizes  
**Status:** planned  
**Owner:** Amelia (impl) → Sally (sign-off)  
**Effort:** M (depends on snapshot count)  
**WCAG:** Best practice for readability; no specific WCAG SC but aligns with 1.4.4 (Resize Text)

---

## User Story

**As** a user reading scoreboard labels, stats table headers, or editor fields,  
**I want** all visible text to be at least 12px,  
**so that** I can read it comfortably without straining, especially on dark backgrounds.

---

## Background

Theme tokens `xs=10px`, `sm=11px`, `tiny=0.7rem` are used for visible text labels in the
scoreboard, stats tables, and team editor. These are too small for comfortable reading, especially
in dark-room / mobile / low-vision contexts. Sprint 2 raises the minimum to **12px**.

**⚠️ Snapshot risk:** This change will likely break 10–30 visual snapshots. Budget time for
individual review of each diff and Docker regen via `e2e-test-runner`. Do NOT bulk-regenerate.

**Dependency:** F1 token audit (Story 1.1) completed in Sprint 1 — the token surface is now fully
mapped. This story depends on that output.

---

## Acceptance Criteria

- [ ] `xs` token updated to `12px` (minimum) in `src/shared/theme.ts`
- [ ] `tiny` token updated to `0.75rem` (12px at 16px base) in `src/shared/theme.ts`
- [ ] `sm` token at `12px` minimum (check current value; bump if < 12)
- [ ] All consumers of `xs`, `tiny`, `sm` that use them for **visible text** confirmed at ≥ 12px
- [ ] `docs/style-guide.md` typography section updated to reflect new minimum sizes
- [ ] `check-style-guide-drift.ts` passes after style guide update
- [ ] Individual snapshot diffs reviewed with Sally before approving any regen
- [ ] **Mid-sprint guardrail:** if > 20 snapshots break, raise to John for re-triage

---

## Files to Modify

```bash
# Find token usage
rg "theme\.fontSizes\.xs\|theme\.fontSizes\.tiny\|theme\.fontSizes\.sm" src/ --files-with-matches
rg "fontSizes:" src/shared/theme.ts
```

Likely:

- `src/shared/theme.ts` — bump `xs`, `tiny`, `sm` values
- `docs/style-guide.md` — typography section
- Multiple styled-component files consuming these tokens

---

## Pre-PR Checklist

```bash
yarn lint
yarn typecheck
yarn typecheck:e2e
yarn test
yarn check:style-guide
# Snapshot regen: REQUIRED — route to e2e-test-runner operational specialist
# MUST run inside Docker: mcr.microsoft.com/playwright:v1.58.2-noble
```

**Do NOT use `yarn test:e2e:update-snapshots` directly unless inside the Docker container.**

---

## Hidden Risks

- **Snapshot cascade:** Font size bumps change text flow which can affect layout snapshots. Estimate
  10–30 snapshots; ceiling 20 before re-triage with John.
- **Visual harmony:** Bumping `xs` to 12px while `sm` is still 11px creates an inverted hierarchy
  — ensure `sm ≥ xs` after bumping.

---

## Routing

- Implementation: Amelia
- WCAG / visual sign-off: Sally (`bmad-agent-ux-designer`)
- Snapshot regen: `e2e-test-runner` operational specialist (Docker required)
