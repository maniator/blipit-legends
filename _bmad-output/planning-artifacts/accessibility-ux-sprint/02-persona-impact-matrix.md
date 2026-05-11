# 02 — Persona Impact Matrix

How each of the 6 user personas reacted to each of the 10 findings, plus Mary's quantitative user-impact analysis.

---

## Consensus Matrix

Severity from each persona's perspective (🚨 Critical / ⚠️ High / · Medium / — Low or N/A):

| Finding             | P1 🛋️ Casual | P2 🧠 Strategist | P3 🏗️ Builder | P4 💾 Curator | P5 📊 Stats Fan | P6 🔬 Power User | Verdict               |
| ------------------- | ------------ | ---------------- | ------------- | ------------- | --------------- | ---------------- | --------------------- |
| F1 Theme Drift      | ·            | ·                | ⚠️            | 🚨            | ⚠️              | 🚨               | **Sprint 1**          |
| F2 Blurry Logo      | ·            | —                | ·             | ·             | ⚠️              | ⚠️               | Sprint 2              |
| F3 Touch Targets    | 🚨           | ⚠️               | ·             | 🚨            | ·               | ·                | **Sprint 1**          |
| F4 Small Fonts      | ⚠️           | ⚠️               | ⚠️            | ·             | 🚨              | ·                | Sprint 2              |
| F5 BSO Color-Only   | ·            | ·                | —             | —             | ·               | 🚨               | Sprint 2 (specced)    |
| **F6 Low-Contrast** | **🚨**       | **🚨**           | **🚨**        | **🚨**        | **🚨**          | **🚨**           | **Sprint 1 (Tier 1)** |
| F7 Light Mode       | ·            | ·                | ·             | ⚠️            | ·               | ·                | Roadmap               |
| F8 Focus Rings      | —            | —                | ⚠️            | ·             | ⚠️              | ·                | Sprint 2 candidate    |
| F9 League Teaser    | ·            | ·                | ·             | ·             | ·               | 🚨               | **Sprint 1**          |
| F10 lang Attr       | —            | —                | ·             | ·             | ⚠️              | 🚨               | **Sprint 1**          |

**Key observation:** **F6 (Low-Contrast Text) is the only finding flagged 🚨 Critical by ALL SIX personas.** This is the single strongest user-research signal in the audit and it is what drove the decision to slice F6 into tiers and pull Tier 1 into Sprint 1.

---

## "Biggest Pain Point" Quotes

What each persona named as their #1 friction point in the closing question:

> **P1 Casual Auto-Watcher:** "The combination of tiny touch targets and low-contrast text at night means I'm squinting and mis-tapping just to follow a game I wanted to watch passively — that friction is real enough to make me put my phone down."

> **P2 Manager-Mode Strategist:** "Low-contrast rendering of score, inning, and base-runner state forces me to re-read or misread the exact context I need to make an informed Manager Mode call."

> **P3 Custom-Team Builder:** "The combination of 10–11px stat labels and sub-4.5:1 contrast on the dark editor means I'm constantly straining to parse information I should be able to absorb instantly."

> **P4 Save/Replay Curator:** "Inconsistent accent colors on Load versus Delete buttons — if I can't reliably distinguish the safe action from the destructive one at a glance, I will eventually delete a save I meant to load."

> **P5 Stats-Curious Fan:** "The near-flat typographic hierarchy — 10px labels, 12px headers, 13px data — collapses the visual structure that lets a serious stats reader scan a dense table accurately and quickly."

> **P6 Deterministic Power-User:** "The color-only BSO dots are the single most critical information-display failure — the current count is the game's core state variable and it should be readable with zero ambiguity, zero color dependency, and zero inference required."

**Recurring theme across all personas:** contrast and font-size deficiencies — the "small text in dim color" problem — appear in 5 of 6 closing quotes (only P6 named BSO ambiguity above contrast).

---

## Quantitative Impact (Mary's analysis, n=1000 users)

**Demographic assumptions (baseball-fan skew):**

- 60% male
- 25%+ over age 45
- ~55-65% mobile (extrapolated from sports-media benchmarks — flagged as assumption)

**Per-finding affected user counts:**

| Finding              | Affected Users                        | Rationale                                                          |
| -------------------- | ------------------------------------- | ------------------------------------------------------------------ |
| F6 Low-Contrast Text | **~250-350**                          | Presbyopia (100% of 45+) + CVD overlap (~50)                       |
| F3 Touch Targets     | **~30 blocked, ~600 mildly impacted** | All mobile users mildly; ~5% motor-impairment subset acutely (CDC) |
| F5 BSO Color-Only    | **~51**                               | 600 male × 8% red-green CVD + ~3 female                            |
| F2 Logo Blur         | **~all (cosmetic)**                   | Universal but low severity                                         |
| F4 Small Fonts       | **~250+**                             | Presbyopia (overlap with F6) + astigmatism + low-vision            |
| F1 Theme Drift       | **~all (perceived quality)**          | Universal cumulative trust erosion                                 |
| F10 lang Attribute   | **~30-50**                            | SR users + occasional SR users + browser AT users                  |

**Aggregate insight:** Sprint 1's chosen scope (F1 + F3 + F6 Tier 1 + F9 + F10) reaches the **largest cohort** (~250-600+ users meaningfully helped) at the **lowest implementation risk** (mostly CSS, with one new CI script).

---

## WCAG Compliance Posture (Mary's regulatory analysis)

| Standard                                               | Sprint 1 Coverage                            |
| ------------------------------------------------------ | -------------------------------------------- |
| **WCAG 2.2 SC 1.4.3** Contrast Minimum (Level AA)      | ✅ Tier 1 tokens fixed                       |
| **WCAG 2.2 SC 1.4.6** Contrast Enhanced (Level AAA)    | ✅ Scoreboard numerics + game-critical state |
| **WCAG 2.2 SC 2.5.5** Target Size Enhanced (Level AAA) | ✅ Buttons bumped to ≥ 44×44                 |
| **WCAG 2.2 SC 2.5.8** Target Size Minimum (Level AA)   | ✅ exceeded                                  |
| **WCAG 2.2 SC 3.1.1** Language of Page (Level A)       | ✅ `lang="en"` verified                      |
| **WCAG 2.2 SC 1.4.1** Use of Color (Level A)           | ⏸ deferred to Sprint 2 (F5 specced)          |

**Legal exposure assessment (Mary):**

- US ADA Title III: low direct exposure for free non-commercial PWA
- EU EAA (effective June 2025): likely out of scope if non-commercial
- **Honest framing: justify Sprint 1 on user impact, not litigation defense.** WCAG conformance is increasingly table-stakes regardless.

---

## Persona Signal-to-Sprint Mapping

How the persona feedback translated into the locked Sprint 1 scope:

| Persona insight                                       | Resulting decision                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------------------ |
| All 6 personas flag F6 as #1 or co-#1 pain            | F6 sliced into 3 tiers; Tier 1 in Sprint 1 (D1)                          |
| P4's data-safety concern: Load/Delete color confusion | F1 elevated as foundation for F6 fixes (fix tokens before fixing usages) |
| P1 + P4 acute touch-target frustration                | F3 stays in Sprint 1                                                     |
| P6 + P4 trust erosion from F9 dead affordance         | F9 in Sprint 1 (small effort, large trust win)                           |
| P5 + P6 noted F10 as quality signal                   | F10 in Sprint 1 (XS effort)                                              |
| P3 + P5 productivity gain from F8 focus rings         | F8 deferred to Sprint 2 — not blocking                                   |
| P6 demand for unambiguous count                       | Drove BSO spec (F5) toward text-label-prominent + aria-live hybrid       |
| Buck's stadium-authenticity counter                   | Killed shape-in-dot proposal; led to text-label-first F5 spec            |
