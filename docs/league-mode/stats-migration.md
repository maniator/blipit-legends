# League Mode — Stats Hub Migration

> ⏭ **Future Phase (Phase 7)** — The Stats Hub migration is not part of the initial league-mode implementation. The existing `/stats` routes continue to work unchanged in the initial slice. This document describes the migration plan for when league stats are added. See [README.md](README.md) for the staged roadmap.

> See [README.md](README.md) for decisions log and [routing.md](routing.md) for the full route tree.

---

## Goal

The current `/stats` route tree is exhibition-only (career stats for games played in `/exhibition/new`). League Mode needs its own stats view — per-league standings, leaderboards, and individual player breakdowns filtered to a season.

Rather than creating a disconnected `/league-stats` route, the cleanest solution is to **promote `/stats` to a hub** with two tabs: Exhibition and League. This is purely additive routing — no existing stats data, components, or behavior changes.

---

## Before / After

### Before

```
/stats                              → CareerStatsPage (redirects to first team)
/stats/:teamId                      → CareerStatsPage
/stats/:teamId/players/:playerId    → PlayerCareerPage
/stats/players/:playerId            → PlayerCareerPage
/career-stats                       → redirect → /stats
```

### After

```
/stats                              → redirect → /stats/exhibition
/stats/exhibition                   → CareerStatsPage (unchanged behavior)
/stats/exhibition/:teamId           → CareerStatsPage (team filter)
/stats/exhibition/:teamId/players/:playerId  → PlayerCareerPage
/stats/exhibition/players/:playerId → PlayerCareerPage

/stats/league/:leagueId             → LeagueStatsPage

── Legacy redirects (all old bookmarks preserved) ────────────────────────────
/career-stats                       → redirect → /stats/exhibition
/stats/:teamId                      → redirect → /stats/exhibition/:teamId
/stats/:teamId/players/:playerId    → redirect → /stats/exhibition/:teamId/players/:playerId
/stats/players/:playerId            → redirect → /stats/exhibition/players/:playerId
```

No existing URL ever returns a 404 or unexpected page. All internal navigation in `CareerStatsPage` and `PlayerCareerPage` that currently generates `/stats/:teamId` links must be updated to `/stats/exhibition/:teamId`, but this is a contained search-and-replace across the careerStats feature.

---

## New Components

### `StatsHubLayout`

Thin layout wrapper that renders a two-tab nav above `<Outlet />`:

```
┌─────────────────────────────────┐
│  Stats                          │
│  [Exhibition]  [League]         │  ← tab bar
├─────────────────────────────────┤
│  <Outlet />                     │  ← CareerStatsPage or LeagueStatsPage
└─────────────────────────────────┘
```

- **Exhibition tab** → navigates to `/stats/exhibition`
- **League tab** → navigates to `/stats/league/:firstLeagueId` (or `/leagues` if no leagues exist yet)
- Active tab is determined by `useMatch` on the current path prefix

`StatsHubLayout` is lazy-loaded via `React.lazy()` like all other page-level components.

### `LeagueStatsPage`

Located at `src/features/leagues/pages/LeagueStatsPage/`. Renders per-league, per-season stats.

**URL:** `/stats/league/:leagueId`

**Content:**

```
┌─────────────────────────────────────────────┐
│  Hawks League  ·  Season 2 ▼                │  ← season picker
├─────────────────────────────────────────────┤
│  Standings                                  │
│  ┌──────────────────────────────────────┐   │
│  │ East Division                        │   │
│  │  Team        W   L   Pct   GB        │   │
│  │  Hawks       8   2  .800   —         │   │
│  │  Comets      6   4  .600   2.0       │   │
│  └──────────────────────────────────────┘   │
├─────────────────────────────────────────────┤
│  Batting Leaders                            │
│  HR: Rivera (12)  AVG: Patel (.381)  ...   │
├─────────────────────────────────────────────┤
│  Pitching Leaders                           │
│  ERA: Wu (2.14)  K: Jones (88)  SV: ...    │
└─────────────────────────────────────────────┘
```

Stats are derived from `completedGames` and `batterGameStats` / `pitcherGameStats` filtered by `leagueSeasonId`.

---

## Internal Link Updates

All places in the careerStats feature that currently navigate to or generate `/stats/:teamId` need to be updated to `/stats/exhibition/:teamId`. This is a mechanical find-and-replace across:

| File | Change |
|---|---|
| `src/features/careerStats/pages/CareerStatsPage/index.tsx` | Update `navigate("/stats/${...}")` → `/stats/exhibition/${...}` |
| `src/features/customTeams/pages/ManageTeamsScreen/index.tsx` | Update career-stats nav link |
| `src/features/careerStats/hooks/useGameHistorySync.ts` | Update any generated stat URLs |
| `src/features/careerStats/pages/PlayerCareerPage/usePlayerCareerData.ts` | Update back-navigation links |
| `src/features/gameplay/components/AppShell/index.tsx` | Update `onCareerStats` callback target |

After updating these, verify no remaining `/stats/:teamId` hard-coded strings exist in the source:

```bash
grep -r '"/stats/' src/ --include="*.ts" --include="*.tsx" | grep -v '/stats/exhibition' | grep -v '/stats/league'
```

Any remaining hits are either legacy redirects (intentional) or missed update sites (fix them).

---

## Migration Checklist

- [ ] Create `src/features/leagues/pages/StatsHubLayout/` — thin layout with two-tab nav
- [ ] Create `src/features/leagues/pages/LeagueStatsPage/` — per-league stats with season picker and standings + leaderboard
- [ ] Update `src/router.tsx` — reroute `/stats` tree as described above; add legacy redirect routes
- [ ] Update all internal links in careerStats feature from `/stats/:teamId` → `/stats/exhibition/:teamId`
- [ ] Add lazy imports for `StatsHubLayout` and `LeagueStatsPage` to `router.tsx`
- [ ] Verify legacy redirects work end-to-end with a router test (add cases to `src/router.test.tsx`)
- [ ] Update the route table in `docs/architecture.md` to reflect the new `/stats` tree
- [ ] Update `AppShell`'s `onCareerStats` callback to navigate to `/stats/exhibition` instead of `/stats`
