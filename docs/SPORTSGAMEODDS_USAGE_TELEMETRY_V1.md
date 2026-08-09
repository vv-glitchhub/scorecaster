# SportsGameOdds Usage Telemetry V1

## Purpose

Production evidence showed SportsGameOdds requests failing with HTTP 429 before candidate matching. Rate-limit batching reduces request bursts, but a 429 can still represent different provider-side limits. This telemetry identifies the binding interval without retaining SportsGameOdds account identifiers or raw response bodies.

## Trigger

The usage endpoint is requested only after an observed SportsGameOdds `rate_limited` failure. Other 4xx, 5xx, network and matching outcomes do not trigger usage lookup.

## Request budget

- endpoint: `/v2/account/usage`
- authentication: existing server-only API key in `x-api-key`
- API key is never placed in the URL
- one in-flight/cached usage promise is shared for at least 60 seconds
- usage failure is non-cascading and never changes the original 429 classification
- no automatic retry chain is created by the diagnostic lookup

## Retained evidence

Only these account-agnostic fields are retained:

- `isActive` boolean when supplied
- per-second / per-minute / per-hour / per-day / per-month numeric request/entity current and maximum values inside the internal safe usage object
- bounded request/entity usage ratios
- allowlisted binding labels such as `per-minute:requests` or `per-month:entities`

The production aggregate further reduces repeated event copies to:

- usage evidence present / absent
- union of binding-limit labels
- maximum observed request ratio by interval
- maximum observed entity ratio by interval

Repeated event rows carrying the same cached account usage snapshot are explicitly not treated as independent samples.

## Explicitly excluded

- `keyID`
- `customerID`
- email
- API key
- raw account response
- provider error body
- arbitrary provider text

## Behavior boundaries

Usage telemetry does not:

- change the 0.55 team-similarity gate
- change the 8-hour event matching window
- change the 0.72 match-confidence gate
- alter model probabilities
- alter decision classes or paper stakes
- authenticate to bookmakers
- submit real-money bets or move money

It is read-only provider observability for the paper-only Scorecaster product.
