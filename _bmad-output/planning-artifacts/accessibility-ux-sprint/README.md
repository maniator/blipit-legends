---
artifact: accessibility-ux-sprint-plan
status: ready-for-implementation
generated_via: bmad-party-mode (multi-agent roundtable + 6 persona interviews + cross-talk)
generated_date: 2026-05-11
owners:
  product: bmad-agent-pm (John)
  design: bmad-agent-ux-designer (Sally)
  architecture: bmad-agent-architect (Winston) — APPROVED WITH CONDITIONS
  implementation: bmad-agent-dev (Amelia)
  documentation: bmad-agent-tech-writer (Paige)
  realism_signoff: bmad-agent-baseball-manager (Buck) — F5 only
inputs:
  - sally heuristic review (10 findings, P0-P2)
  - 6 persona interviews (P1 Casual Watcher → P6 Power User)
  - mary impact-math analysis
  - cross-talk round (sally↔buck, john↔mary, amelia↔paige, winston final verdict)
---

# Accessibility & UX Sprint — BlipIt Legends

This is the consolidated planning artifact for the **Critical Accessibility & Trust Sprint**, generated through a full bmad multi-agent roundtable. A future implementing agent (Amelia) should be able to pick this up and execute Sprint 1 with no further clarification needed.

## Navigation

| File                                                             | Contents                                                                 | Audience                |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------- |
| [`00-overview-and-decisions.md`](./00-overview-and-decisions.md) | Executive summary, sprint shape, key decisions, agent verdicts           | All — **read first**    |
| [`01-findings-detail.md`](./01-findings-detail.md)               | All 10 findings with WCAG citations, persona evidence, fix specs         | Sally, Amelia, Paige    |
| [`02-persona-impact-matrix.md`](./02-persona-impact-matrix.md)   | 6 personas × 10 findings consensus map + Mary's user-impact math         | John, stakeholders      |
| [`03-sprint-stories.md`](./03-sprint-stories.md)                 | Per-story acceptance criteria, ready-for-Amelia story shells             | Amelia (implementer)    |
| [`04-implementation-notes.md`](./04-implementation-notes.md)     | File-level technical notes, snapshot cascade warnings, CI guardrail spec | Amelia                  |
| [`05-test-strategy.md`](./05-test-strategy.md)                   | Unit + a11y + E2E test additions (shift-left first)                      | Amelia, e2e-test-runner |

## TL;DR

**Sprint 1 scope (one focused sprint, parallel with League Mode work):**

1. **F1** — Style Guide ↔ Theme Drift fix + CI guardrail to prevent regression
2. **F3** — Touch targets bumped to ≥ 44×44 effective tap area (WCAG AAA, transparent hit expansion)
3. **F6 Tier 1** — Highest-impact contrast bumps: `textHint`, `textNavFaint`, `textScoreDim`, scoreboard numerics
4. **F9** — League Teaser non-affordance (pointer-events:none, lock icon, accurate "coming soon" copy)
5. **F10** — `html lang="en"` verification + add if missing

**Sprint 2 (next):**

- F5 — BSO accessibility (Sally's spec is in this artifact, ready to build)
- F2 — Logo SVG → PNG with srcset; manifest audit
- F4 — Small font sizes (token-level)
- F6 Tier 2 — remaining contrast token sweep

**Roadmap (not scheduled):**

- F7 — Light/High-Contrast Mode
- F8 — Focus indicator audit (out of Sprint 1; consider Sprint 2 or 3)

## Architectural Non-Negotiable (Winston)

> All color and sizing values introduced or modified in Sprint 1 **MUST** flow through `theme.ts` tokens consulted against `docs/style-guide.md`. Zero hardcoded hex values, zero one-off `px` font sizes, zero inline `@media` strings — use `mq` helpers from `@shared/utils/mediaQueries`.

## Routing for Implementation

When picking up this work:

1. Start with `bmad-agent-dev` (Amelia) → SR menu for the F1 audit and CI guardrail.
2. F3, F6 Tier 1 → Amelia → UI menu (visual snapshot implementation), with Sally's design specs in `01-findings-detail.md`.
3. F9, F10 → Amelia → SR menu (small mechanical fixes).
4. **Before merging any PR**: route to `bmad-agent-architect` (Winston) → CR menu for sign-off, since this sprint touches design tokens (high-value).
5. Visual snapshot regen → `e2e-test-runner` operational specialist (must run inside `mcr.microsoft.com/playwright:v1.58.2-noble` Docker container).
6. WCAG verification evidence (axe-core or Lighthouse output) → attached to PR by Amelia, signed off by Sally.

## Audit Trail

Full multi-agent transcript: see git history of this directory's creation commit. Roundtable participants: Sally, John, Winston, Amelia, Buck, Mary, Paige, plus persona interviews P1–P6 (hosted by Sally via P1–P6 menu items).
