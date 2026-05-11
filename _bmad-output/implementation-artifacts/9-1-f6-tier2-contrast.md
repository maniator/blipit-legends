# Story 9.1 — F6 Tier 2: Secondary Metadata Contrast

**Sprint:** Sprint 2  
**Epic:** F6 — Low-Contrast Text (Tier 2)  
**Status:** planned  
**Owner:** Amelia (impl) → Sally (WCAG sign-off)  
**Effort:** M (depends on snapshot count)  
**WCAG:** 1.4.3 "Contrast (Minimum)" Level AA (≥ 4.5:1)

---

## User Story

**As** a user reading secondary metadata, timestamps, footer text, or help text,  
**I want** that text to meet WCAG AA contrast against the dark background,  
**so that** I can read it without straining, especially in dark-room conditions.

---

## Background

Sprint 1 (Story 3.1) addressed Tier 1: the five highest-impact contrast tokens (`textHint`,
`textNavFaint`, `textScoreDim`, table `Th`, scoreboard numerics). Tier 2 addresses the remaining
tokens that fail WCAG 1.4.3 AA: secondary metadata, timestamps, footer text, and `textDimmer`.

**Dependency:** Builds on Sprint 1 tokens — the Tier 1 work established the methodology and
updated `docs/style-guide.md` with the "audited — Sprint 1" markers. Tier 2 follows the same
pattern.

---

## Tier 2 Token Targets

From `01-findings-detail.md`:

| Token        | Current hex | Background | Approx Ratio | Target       |
| ------------ | ----------- | ---------- | ------------ | ------------ |
| `textDimmer` | `#6B7785`   | `#0d1b2e`  | ~3.2:1       | ≥ 4.5:1 (AA) |

Plus any tokens discovered during Sprint 1 audit that didn't reach Tier 1 priority, including:

- Secondary metadata text (timestamps, captions)
- Footer text
- Help/hint text that escaped Tier 1

---

## Acceptance Criteria

- [ ] All Tier 2 tokens identified and listed with current ratio / target
- [ ] Each token bumped to ≥ 4.5:1 WCAG AA against its actual background color
- [ ] axe-core report (or equivalent) attached to PR — 0 contrast violations on affected surfaces
- [ ] `docs/style-guide.md` updated: Tier 2 tokens marked "audited — Sprint 2"
- [ ] Tier 3 tokens (decorative/ambient) explicitly listed as "pending Tier 3 / backlog"
- [ ] `check-style-guide-drift.ts` passes after style guide update
- [ ] Individual snapshot diffs reviewed (NOT bulk regenerated)
- [ ] **Mid-sprint guardrail:** if > 15 snapshots break, raise to John for re-triage
- [ ] No previously-passing surface introduces new failures

---

## Files to Modify

```bash
# Find affected token usage
rg "textDimmer\|textMuted\|textFooter\|textMeta" src/ --files-with-matches
rg "theme\.colors\.text" src/ | grep -v "textPrimary\|textSecondary\|textHint\|textNavFaint\|textScoreDim" | head -20
```

Likely:

- `src/shared/theme.ts` — bump Tier 2 token values
- `docs/style-guide.md` — update audit markers
- Visual snapshot updates (intentional)

---

## Pre-PR Checklist

```bash
yarn lint
yarn typecheck
yarn typecheck:e2e
yarn test
yarn check:style-guide
# Snapshot regen: route to e2e-test-runner operational specialist (Docker required)
```

---

## Notes

- Use the same contrast verification methodology as Story 3.1: axe-core evidence artifact committed
  to `_bmad-output/planning-artifacts/accessibility-ux-sprint/audit-results/`.
- Do NOT touch Tier 3 tokens (decorative/ambient text, debug overlays) — those are backlog.

---

## Routing

- Implementation: Amelia
- WCAG sign-off: Sally (`bmad-agent-ux-designer`)
- Snapshot regen: `e2e-test-runner` operational specialist
