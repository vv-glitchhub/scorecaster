# SportsGameOdds Upstream Errors V1

## Purpose

Production evidence showed that SportsGameOdds supported-league observations were failing before event matching. This package separates upstream API failures from match-quality failures without exposing credentials or arbitrary provider error text.

## Verified API contract

The implementation follows the current official SportsGameOdds v2 documentation:

- `GET https://api.sportsgameodds.com/v2/events`
- authentication through `x-api-key`
- supported query fields include `leagueID`, `oddsAvailable`, `includeOpenCloseOdds`, `startsAfter`, `startsBefore` and `limit`
- the current request uses `limit=50`, within the documented endpoint maximum

The code does not switch authentication style or modify request parameters merely to make production readiness turn green.

## Safe error categories

HTTP/provider failures are reduced to an allowlisted category:

- `bad_request` — 400
- `unauthorized` — 401
- `forbidden` — 403
- `not_found` — 404
- `rate_limited` — 429
- `provider_server_error` — other 5xx
- `provider_unavailable` — 503
- `provider_timeout` — 504 or request timeout
- `network_error`
- `invalid_response`
- `unknown_http_error`

Only the numeric HTTP status, category, bounded Retry-After seconds, attempt count and retry boolean may enter provider telemetry. The upstream response body is not retained in Production Evidence.

## Retry policy

- 400/401/403/404 are not retried.
- 429 is not immediately retried. `Retry-After`, when present, is retained only as a bounded numeric duration for diagnosis.
- retryable 5xx/network/invalid-response failures receive at most **one** additional request.
- the retry backoff is bounded; no retry loop is allowed.

This follows the provider's documented guidance to avoid blind 4xx retries and retry storms.

## Request coalescing

Identical SportsGameOdds `/events` requests share one in-flight/short-lived promise inside a server process. The cache key is the request URL **without the API key**, because the key is supplied only via the header.

The coalescing TTL is 10 seconds. It is intended to prevent different paper-analysis selections for the same league/time window from creating a burst of identical provider calls. It does not create a durable odds cache and does not change the application's live-data cache boundary.

## Production Evidence

Secondary pricing diagnostics aggregate upstream evidence by provider and provider/league:

- error category counts
- HTTP status counts
- average Retry-After seconds
- average attempts
- retry count

No raw provider error body, API key, event ID, team name or user identifier is included in the release-safe output.

## Decision rules

- high 401: investigate configured API key, without exposing its value
- high 403: investigate product/plan permission
- high 429: reduce request bursts and respect provider rate limits; do not retry immediately
- high 400: inspect request validation against official docs
- high 5xx: preserve one bounded retry and monitor provider health
- once upstream calls succeed, use the separate matching diagnostics to evaluate `no_match` / team / time / confidence failures

## Safety boundary

- paper-only
- no bookmaker login
- no deposits, withdrawals or Cash Out
- no real-money execution
- no probability or stake changes
- no automatic PLAY upgrade
- no threshold lowering
- no invented league IDs
- no missing-data imputation
