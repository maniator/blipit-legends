# D-02 Implementation Prompt — Hub Discoverability

> Copy-paste this prompt verbatim into a new Copilot agent session.  
> This is a short, single-task UI fix. No schema changes. No Winston CR required.

---

## Context

`SeasonTeamPage` exists and is reachable from standings rows in `SeasonHomePage` — clicking a
team name in the standings table navigates to that team's season-scoped stats page. However,
the `LeaguesHubPage` "View teams" action still navigates to the global `/teams` route (the
general custom-team management screen) rather than the season-scoped team page. Users browsing
from the hub cannot reach per-season team stats without going through the standings table first.

This is a one-target navigation fix.

---

## Canonical Spec Reference

`docs/league-v1-followup/08-deferred-to-v2.md` § D-02

---

## Pre-Reading

- `src/features/leagues/pages/LeaguesHubPage/index.tsx` — locate the "View teams" action/button
- `src/features/leagues/pages/SeasonHomePage/index.tsx:256-266` — see how standings rows navigate
  to `SeasonTeamPage` for the correct navigation pattern to replicate

---

## Implementation Steps

1. Open `LeaguesHubPage/index.tsx` and locate the "View teams" link or button.
2. Determine the correct target:
   - If the hub has an active season in context, navigate to `/stats/:teamId` for the user's
     managed team in that season, OR to the season standings page so the user can pick a team.
   - If no active season is selected, the button should remain disabled or navigate to `/teams`
     (the general management screen) — do NOT attempt to derive a team ID when no season is active.
3. Verify the navigation target is consistent with how `SeasonHomePage` links to team stats
   (lines 256–266 of `SeasonHomePage/index.tsx`).
4. If the fix requires reading active-season state from a hook or context, use only existing hooks —
   do NOT add new state or context for this item.

---

## Acceptance Criteria

- On `LeaguesHubPage`, with an active season, "View teams" navigates to the season-scoped team
  stats page (or season standings where user can pick a team).
- With no active season, the action either navigates to `/teams` or is visually disabled.
- No console errors on navigation.
- No other hub links are affected.

---

## Validation

```bash
yarn lint
yarn format:check
yarn typecheck
yarn build
```

---

## Out of Scope

- Adding new routes or new pages
- Changing `SeasonTeamPage` itself
- Any stats aggregation changes
