# League Mode — Routing

## Near-term route additions

- `/leagues`
- `/leagues/new`
- `/leagues/:leagueId`
- `/leagues/:leagueId/seasons/:leagueSeasonId/schedule`

## Existing route compatibility

- Keep exhibition and current game routes intact
- League game launches must pass league context through location state
- Existing stats routes remain unchanged in near-term scope

## Future route additions (deferred)

- League playoff routes
- League roster/trade routes
- Stats hub split (`/stats/exhibition` and `/stats/league/:leagueId`) with legacy redirects

## Navigation constraints

- Always URL-encode path segment IDs
- Preserve backwards compatibility when introducing future redirect trees
