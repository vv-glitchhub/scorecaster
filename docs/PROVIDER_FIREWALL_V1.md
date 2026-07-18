# Provider Firewall V1

Provider Firewall V1 prevents public callers from using Scorecaster as an unrestricted proxy to paid sports-context providers.

## Architecture

The server-internal module `lib/sports-intelligence-service.js` is the only component that calls the configured news, injury and lineup adapters.

Top Picks and Agent enrichment call that module directly inside the server process. They do not send an HTTP request to `/api/intelligence` and do not require a client-visible internal token.

The manual `/api/intelligence` endpoint is retained for authenticated web and native product flows. It requires:

- a valid Supabase cookie session or bearer session
- a valid same-origin request for cookie authentication
- a per-user database-backed request quota
- a bounded JSON request body
- normalized team, sport, league, event and start-time fields

A request without an Origin header is not accepted as a browser-cookie mutation. Native clients must provide a valid bearer session.

## Provider budgets

The internal service uses:

- a five-minute match cache
- at most 500 cache entries per server instance
- at most 72 new provider cache misses per five-minute window per server instance
- existing Top Picks enrichment limits

A cache hit does not consume the cache-miss budget. When the provider budget is exhausted, Scorecaster returns an explicit unavailable context report. It does not invent replacement injuries, lineups, news or probabilities.

## Data and decision boundaries

Provider Firewall V1 does not change the market-consensus probability, edge or expected value.

Sports Intelligence remains downgrade-only:

- verified context may downgrade PLAY
- missing or conflicting context may block new paper exposure
- context may not upgrade WATCH or SKIP to PLAY
- no provider call places a bet or transfers money

## Secret handling

Provider credentials remain server-only. They must never use a `NEXT_PUBLIC_` or `EXPO_PUBLIC_` prefix and must never be stored in the mobile application.

## Regression gate

`npm run test:provider-firewall` verifies that:

- missing-origin anonymous requests are rejected
- bearer-authenticated native requests remain supported
- authentication and quota checks run before provider loading
- the public API route does not import provider adapters
- Agent and Top Picks use the internal service rather than `/api/intelligence`
- cache size, lifetime and provider miss budgets remain bounded
