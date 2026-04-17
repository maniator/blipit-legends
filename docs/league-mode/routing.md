# League Mode — Routing

## Near-term route additions

- `/leagues`
- `/leagues/new`
- `/leagues/:leagueId`
- `/leagues/:leagueId/seasons/:leagueSeasonId/schedule`

## Existing route compatibility

- Keep exhibition and current game routes intact
- League game launches must use a reload-safe league context handoff
  - Prefer URL-addressable identifiers for league/season/scheduled-game context
  - If `location.state` is used as temporary navigation handoff, copy required league context into persistent state on first load before `/game` clears router state
- Existing stats routes remain unchanged in near-term scope

## Future route additions (deferred)

- League playoff routes
- League roster/trade routes
- Stats hub split (`/stats/exhibition` and `/stats/league/:leagueId`) with legacy redirects

## Navigation constraints

- Always URL-encode path segment IDs
- Preserve backwards compatibility when introducing future redirect trees
