# SportsGameOdds Rate-Limit Batching V1

## Production evidence

Release-safe provider diagnosis observed SportsGameOdds failing before matching with HTTP `429` rate limiting. Five retained upstream samples were all classified `rate_limited`; no immediate retries were attempted. The Odds API remained available, so the failure was isolated to the secondary pricing provider rather than the full pricing pipeline.

## Request-burst root cause

The previous adapter built `startsAfter` and `startsBefore` around each individual event. Since the in-memory coalescer keyed the full request URL, different event start times generated different keys. A worker processing many matches could therefore issue many SportsGameOdds requests in the same minute even when those matches belonged to the same league and day.

## V1 batching policy

The adapter now derives one deterministic request window per UTC calendar day:

- bucket: 24 hours UTC
- candidate overlap: existing matching time window on both sides
- current matching window: 8 hours
- resulting request span: 40 hours
- league remains part of the URL, so different leagues never share data

Every same-league event whose kickoff falls in the same UTC day produces the same SportsGameOdds URL. Concurrent calls therefore share the same in-flight promise and cached response.

This batching changes only acquisition efficiency. Candidate evaluation still applies the existing event-level team, time and confidence gates after the shared response is returned.

## 429 handling

HTTP 429 is never immediately retried. The request key is held in local cooldown for at least 60 seconds. A longer valid `Retry-After` value extends that cooldown. The safe response retains only status/category, bounded Retry-After, attempt count and retry boolean; provider error bodies are not retained.

Transient 5xx/network handling stays bounded to one retry.

## Unchanged matching gates

- minimum team similarity: `0.55`
- event time window: `8h`
- minimum match confidence: `0.72`

No threshold is loosened to improve coverage.

## Deterministic regressions

The request-contract suite proves:

- same-day windows are deterministic and span 40 hours
- eight same-league same-day matches collapse to one upstream request
- different leagues retain distinct request keys
- a cached 429 is reused instead of causing another burst
- missing/zero Retry-After receives a one-minute fallback cooldown
- 401 and 429 are never immediately retried
- 5xx remains limited to one retry
- API keys stay exclusively in the `x-api-key` header

## Safety

This is paper-only data acquisition and observability. It does not authenticate to bookmakers, submit bets, move money, alter probabilities or change staking decisions.
