# Scorecaster Pricing Provider Readiness V1

## Purpose

Production league readiness separates **pricing-provider reliability** from **optional contextual evidence**.

This prevents weather, injury, lineup, news or generic context availability from being averaged into the same provider-availability denominator used to judge whether live market pricing is operational.

## Pricing denominator

Only provider observations whose family is `odds` are eligible for pricing-provider availability.

For a secondary odds provider:

- `live` observations can count as available when `ok=true`.
- `no_match`, `low_match_confidence`, `api_error`, `fetch_error`, `timeout`, `not_verified` and `unavailable` count as unavailable pricing evidence.
- `unsupported_league` and `not_configured` are excluded from that provider's availability denominator because the provider was not eligible to supply pricing for that event. Missing secondary coverage remains visible through event-level `provider_count` and `multiProviderRate`; it is not imputed as a successful quote.

## Independent gates

Pricing-provider availability does **not** replace the other readiness gates:

- verified fixture identity
- market freshness
- event-level multi-provider coverage
- provider disagreement
- unified evidence coverage
- closing-line chronology and coverage
- protected worker health
- event-specific active incidents

A league with a healthy primary provider can therefore remain degraded when secondary market coverage is insufficient. The change does not lower any configured threshold.

## Optional context provider incidents

A global `provider_health` incident from a non-odds family is retained in provider telemetry but cannot by itself create a pricing hard-disable for every league.

Event-scoped adverse contextual evidence remains part of readiness and can still downgrade or disable the affected event/league according to the existing safety rules.

## Telemetry

The API keeps all provider rows visible and adds separate summary fields for:

- average odds-provider availability
- average all-provider availability
- odds-provider count
- optional-provider count
- readiness-active incidents
- all active incidents
- optional provider-health incident count
- non-eligible odds observations excluded from the availability denominator

## Safety boundary

This change is measurement-only:

- paper-only
- no bookmaker credentials
- no deposits, withdrawals or Cash Out
- no real-money execution
- no probability or stake changes
- no automatic PLAY upgrade
- no threshold reduction
- no missing evidence imputation
