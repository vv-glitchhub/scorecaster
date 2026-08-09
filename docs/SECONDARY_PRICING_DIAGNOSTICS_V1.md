# Scorecaster Secondary Pricing Diagnostics V1

## Purpose

Secondary Pricing Diagnostics V1 explains *why* multi-provider pricing coverage is missing without lowering the SportsGameOdds match-confidence threshold or exposing provider payloads.

The diagnostics are part of the release-safe Production Evidence JSON under:

`providerReadiness.secondaryPricingDiagnostics`

## Data boundary

The report is aggregate-only. It exposes no:

- event IDs
- team names
- selections
- raw provider payloads
- API keys or credentials
- user identifiers

The diagnostics use only the already reviewed unified-data snapshots and provider-observation metadata.

## Mode buckets

For each odds provider and provider/league pair, the report counts the latest event-provider observation in these buckets:

- `live`
- `no_match`
- `low_match_confidence`
- `unsupported_league`
- `not_configured`
- `api_error`
- `fetch_error`
- `timeout`
- `not_verified`
- `unavailable`
- `other`

Repeated captures do not inflate the denominator; only the latest observation for an event/provider pair is counted.

## Denominators

`observations`
: all latest observations for the provider in the selected evidence window.

`eligibleObservations`
: observations for which the provider was eligible to supply a quote. `unsupported_league` and `not_configured` are excluded.

`liveObservations`
: eligible observations whose mode is `live` and whose operational `ok` flag is true.

`usableRate`
: `liveObservations / eligibleObservations`.

`liveCoverageOfLeague`
: live observations divided by the total number of latest event snapshots in that league. This remains distinct from the Production Evidence engine's event-level `multiProviderRate`.

## Match confidence

When safe numeric match-confidence evidence is present in provider observations, the diagnostics expose only aggregate sample count, mean, minimum and maximum. No candidate teams or event matching payloads are exposed.

The current SportsGameOdds safety threshold remains **0.72**. This diagnostics layer does not lower or change it.

## How to use the result

- High `unsupported_league`: provider is not eligible for those events; do not invent league IDs. Secondary coverage remains missing.
- High `no_match`: inspect event/team normalization and request scope.
- High `low_match_confidence`: inspect aliases/orientation/time matching before considering any threshold change.
- High `api_error`, `fetch_error` or `timeout`: fix provider transport/reliability rather than event matching.
- Healthy `live` rate but weak league `multiProviderRate`: inspect capture/event-linking or independent-provider counting.

## Safety

This is measurement only:

- paper-only
- no bookmaker login
- no real-money execution
- no deposits, withdrawals or Cash Out
- no probability changes
- no stake changes
- no automatic PLAY upgrades
- no missing-data imputation
