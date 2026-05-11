# Sprint Kickoff Prompts

<!-- generated: 2026-05-11 | plan version: accessibility-ux-sprint v1 | re-verify paths and story numbers if plan files have changed since this date -->

Copy-paste these prompts verbatim into a new agent session to kick off each sprint. All routing rules, guardrails, and tips are embedded — the session needs no prior context beyond what is in this repository.

---

## Sprint 1 — Critical Fixes (F1, F3, F6 Tier 1, F9, F10)

```
Implement Sprint 1 of the Accessibility & UX sprint plan. The full plan is at:

  _bmad-output/planning-artifacts/accessibility-ux-sprint/

Read the files in this order before starting:
  1. README.md                     — routing rules and architectural non-negotiable
  2. 00-overview-and-decisions.md  — scope (LOCKED), key decisions, guardrails
  3. 03-sprint-stories.md          — per-story acceptance criteria
  4. 04-implementation-notes.md    — file-level search commands and CI spec

## Agent routing (REQUIRED — do not skip)
- All implementation routes through bmad-agent-dev (Amelia). If the session
  opens with a skill picker, invoke bmad-agent-dev and select the SR menu to
  start; switch to the UI menu for F3 and F6 Tier 1 work.
- F1 audit documentation routes through bmad-agent-tech-writer (Paige) for
  the style-guide rewrite (Story 1.2). Amelia executes the grep/script work.
- Story 3.1 (F6 Tier 1) WCAG evidence must be reviewed and signed off by
  bmad-agent-ux-designer (Sally) — hard gate before the PR is created.
- After all stories are complete, BEFORE calling create_pull_request, route to
  bmad-agent-architect (Winston) → CR menu for engineering sign-off. Winston
  must issue APPROVE before the PR is created — hard gate, not optional.
  Both Sally and Winston gates must clear; order: Sally → Winston → PR.
- Visual snapshot regeneration (if needed after F6 Tier 1) routes EXCLUSIVELY
  to the e2e-test-runner operational specialist. Snapshots MUST be regenerated
  inside mcr.microsoft.com/playwright:v1.58.2-noble. Never regen locally.

## Execution order
1. Story 1.1 — F1 audit: run the rg commands in 04-implementation-notes.md,
   commit results to _bmad-output/planning-artifacts/accessibility-ux-sprint/audit-results/
2. Stories 5.1, 4.1, 2.1 in parallel — quick wins with no F1 dependency:
   - Story 5.1: verify/add <html lang="en"> + automated guard test
   - Story 4.1: LeagueTeaserBox non-affordance (pointer-events:none, lock icon, copy —
     confirm target quarter with John via bmad-agent-pm → M1 menu BEFORE writing copy)
   - Story 2.1: touch target hit expansion (::before pseudo, NOT real padding)
3. Stories 1.2 + 1.3 — style-guide doc rewrite, then CI guardrail script
4. Story 3.1 — F6 Tier 1 contrast token bumps (do last; highest snapshot risk)

## Hard guardrails — stop and raise these, do not push through
- F6 Tier 1 (Story 3.1): review every affected snapshot diff individually —
  no bulk-regenerate regardless of count. If more than 15 break, STOP and
  surface the count to the user for re-triage before touching any more.
- All values introduced or modified MUST flow through src/shared/theme.ts
  tokens. Zero hardcoded hex values. Zero inline @media strings — use mq
  helpers from @shared/utils/mediaQueries.
- Touch targets: use ::before pseudo-element hit expansion only. Real padding
  on HelpButton/close buttons shifts layout and cascades snapshots.

## What is explicitly OUT of Sprint 1 (do not build)
F2 (logo PNG), F4 (font sizes), F5 (BSO), F6 Tier 2/3, F7 (light mode),
F8 (focus rings). Full specs for these live in the plan for Sprint 2.

Do not stop to ask clarifying questions — all decisions are locked in the plan.
```

---

## Sprint 2 — Remaining Findings (F2, F4, F5, F6 Tier 2, F8)

```
Implement Sprint 2 of the Accessibility & UX sprint plan. Sprint 1 is already
merged; this sprint completes the remaining findings.

Read these files before starting:
  _bmad-output/planning-artifacts/accessibility-ux-sprint/README.md
  _bmad-output/planning-artifacts/accessibility-ux-sprint/00-overview-and-decisions.md
  _bmad-output/planning-artifacts/accessibility-ux-sprint/01-findings-detail.md
  _bmad-output/planning-artifacts/accessibility-ux-sprint/03-sprint-stories.md  (Sprint 2 shells at bottom)
  _bmad-output/planning-artifacts/accessibility-ux-sprint/04-implementation-notes.md
  _bmad-output/planning-artifacts/accessibility-ux-sprint/05-test-strategy.md

## What to build (Sprint 2 story shells — all specs are in 01-findings-detail.md)
- Story 6.1 — F5: BSO accessibility
    Design spec is LOCKED in 01-findings-detail.md (Sally's final design).
    Key points: visible text label "B 3  S 2  O 1", 20px/700 mobile,
    24px/700 desktop, tabular-nums, WCAG AAA (≥7:1) contrast; dots keep color
    but get 1px inner border; screen-reader: role="status" aria-live="polite"
    aria-atomic="true" on container, visible text aria-hidden="true".
    Buck must still sign off on the IMPLEMENTATION via bmad-agent-baseball-manager
    → RL menu before Story 6.1 is closed — the design lock does not substitute
    for implementation RL approval.
- Story 7.1 — F2: Logo SVG → PNG with srcset + manifest audit
    Route format/resolution/manifest decisions through bmad-agent-ux-designer
    (Sally) before Winston CR — Sally owns final design spec (D5).
- Story 8.1 — F4: Font size minimum bump (xs → 12px minimum), token migration
    All font size changes MUST update src/shared/theme.ts tokens — no one-off px.
- Story 9.1 — F6 Tier 2: secondary metadata, timestamps, footer contrast bumps
    Remaining tokens not touched in Sprint 1 Tier 1.
- Story 10.1 — F8: Focus indicator audit
    Candidate only — confirm in-scope with John (bmad-agent-pm → M1 menu) at
    sprint kickoff if time budget allows.

## Agent routing (REQUIRED — do not skip)
- All implementation routes through bmad-agent-dev (Amelia). If the session
  opens with a skill picker, invoke bmad-agent-dev.
  - F5 BSO visual work → Amelia → UI menu (visual snapshot implementation)
  - F4/F6 Tier 2 token work → Amelia → SR menu
  - F8 focus audit (if in scope) → Amelia → SR menu
- F5 stadium-authenticity sign-off → bmad-agent-baseball-manager (Buck) → RL menu.
  Buck must APPROVE before Story 6.1 is closed.
- WCAG verification evidence (axe-core/Lighthouse) for F6 Tier 2 → collected by
  Amelia, reviewed and signed off by bmad-agent-ux-designer (Sally).
- Confirm F8 scope → bmad-agent-pm (John) → M1 menu at sprint start.
- After ALL stories are complete, BEFORE calling create_pull_request, route to
  bmad-agent-architect (Winston) → CR menu. Winston must issue APPROVE — hard gate.
- Visual snapshot regeneration routes EXCLUSIVELY to the e2e-test-runner
  operational specialist inside mcr.microsoft.com/playwright:v1.58.2-noble.

## Hard guardrails — stop and raise these, do not push through
- F6 Tier 2 snapshot ceiling: same rule as Sprint 1 Tier 1 — if more than 15
  snapshots break, stop and surface the count before continuing.
- All values MUST flow through src/shared/theme.ts tokens. Zero hardcoded hex.
  Zero inline @media strings — use mq helpers.
- F5 BSO: do NOT ship without Buck's RL sign-off. Stadium authenticity is the
  primary constraint on this finding.

## Sprint 1 artifacts to carry forward
Check that Sprint 1's CI guardrail (yarn check:style-guide) passes clean before
touching any tokens. If it fails, fix the drift first.

Do not stop to ask clarifying questions — all specs are locked in the plan.
```
