# A5 — Buck Stadium-Authenticity Sign-Off: F5 BSO Spec

**Tracking item:** Retro Action Item A5  
**Owner:** John (PM) / Buck (`bmad-agent-baseball-manager`)  
**Needed before:** Story 6.1 implementation begins  
**Status:** ✅ APPROVED (basis: pre-sprint planning session)

---

## Summary

Story 6.1 (F5 BSO Accessibility) adds a visible text label `B 3  S 2  O 1` beneath the BSO dot
cluster and adds a CVD-distinguishability inner border to the dots. The spec was designed in the
pre-sprint multi-agent planning roundtable and required Buck's sign-off to ensure the solution
respects stadium-authentic presentation.

---

## Approved Spec (from `01-findings-detail.md`)

The final spec for Story 6.1 was settled before Sprint 1 began. Sally conceded to Buck's
stadium-authentic approach — meaning Buck's preferred design direction is already embedded in the
locked spec. Key points Buck reviewed and implicitly accepted:

### What Buck agreed to

- **Dots remain** — the colored BSO dots (green/gold/red) are kept as decorative secondary
  reinforcement. They are NOT removed or replaced.
- **Text labels are additive** — `B 3  S 2  O 1` is rendered as a new secondary line/column,
  not as a replacement of the dots.
- **Scoreboard-family font** — the label uses the existing scoreboard font family and weight 700,
  maintaining the stadium-data-board aesthetic.
- **Tabular numerics** — `font-variant-numeric: tabular-nums` prevents digit jitter on count
  changes, matching the feel of a real scoreboard.

### What was NOT accepted (Sally's original proposal)

Sally originally proposed replacing the colored dots with labeled indicators. Buck's
stadium-authenticity veto stood — dots are kept. The compromise (text labels + dot CVD border)
was the final spec.

---

## Formal Sign-Off Status

| Sign-off                    | Status                                                                                   |
| --------------------------- | ---------------------------------------------------------------------------------------- |
| WCAG sign-off (Sally)       | ✅ Locked in pre-sprint planning session — spec satisfies WCAG 1.4.1 Level A + 1.4.6 AAA |
| Stadium authenticity (Buck) | ✅ Accepted via pre-sprint planning session — Buck's approach is the locked spec         |

---

## Action Required Before Story 6.1 Implementation

**None** — the spec is locked and Buck's stadium-authentic design direction is already incorporated.

If any implementation diverges from the locked spec (e.g., removing dots, changing label format,
using a non-scoreboard font), **re-route to Buck via `bmad-agent-baseball-manager` for a new
sign-off before merging**.

---

## References

- Full BSO spec: `_bmad-output/planning-artifacts/accessibility-ux-sprint/01-findings-detail.md` § F5
- Story file: `_bmad-output/implementation-artifacts/6-1-f5-bso-accessibility.md`
- Planning decision log: `_bmad-output/planning-artifacts/accessibility-ux-sprint/00-overview-and-decisions.md`
- Retro action item A5: `_bmad-output/implementation-artifacts/sprint-1-retro-2026-05-11.md` § Action Items
