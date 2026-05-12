---
applyTo: "**/*.{ts,tsx,js,jsx,css,scss,md,yml,yaml,json}"
excludeAgent: "cloud-agent"
---

# BMAD-Style Code Review Instructions

When reviewing code in this repository, apply a **two-step BMAD review process**:

## Step 1 — `bmad-code-review` lens

Examine the diff for:

- Correctness and regression risk
- Edge cases and boundary conditions
- Missing or inadequate tests
- Migration risk (especially RxDB schema changes)
- Accessibility defects
- Performance concerns (hot paths, heavy re-renders, storage limits)
- Acceptance-criteria mismatch

## Step 2 — `bmad-party-mode` synthesis

Activate only the personas implied by the changed files. Do not activate a persona whose domain is not represented in the diff.

### Persona activation guide

| Persona                               | Activate when the diff touches…                                                             |
| ------------------------------------- | ------------------------------------------------------------------------------------------- |
| **QA / Test Architect**               | test files, Playwright specs, coverage gaps, flaky behavior, regression risk                |
| **Frontend / UX**                     | React components, styled-components, accessibility, responsive behavior, visual regressions |
| **Architecture / Tech Lead**          | module boundaries, state flow, coupling, maintainability, ownership drift                   |
| **Persistence / Data**                | RxDB schemas, migrations, save/load compatibility, export/import, versioning                |
| **Product / PM**                      | acceptance criteria, workflow integrity, user-visible behavior                              |
| **Game Simulation / Baseball Domain** | baseball rules, simulation logic, league flow, stats, game-management behavior              |
| **Security / Performance**            | unsafe input handling, data leakage, hot paths, heavy re-renders, storage limits            |

## Output rules

- Prioritize concrete defects and regressions over style opinions.
- Point to exact file and local context (line numbers) when possible.
- Flag missing tests when behavior changes.
- For schema or storage changes, explicitly check migration strategy and backward compatibility.
- For UI changes, explicitly check accessibility (WCAG AA) and mobile/responsive behavior.
- If no meaningful issue exists in a lane, skip that lane — do not create filler comments.
- Do not claim BMAD skills were invoked unless runtime logs explicitly show skill loading or execution.
