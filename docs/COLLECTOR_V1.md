# Scorecaster Collector V1

Scorecaster Collector is a rights-aware sports-data ingestion layer. It collects first-party Scorecaster event data every 30 minutes and can ingest one separately licensed HTTPS JSON provider without exposing provider credentials to browsers.

## Safety boundary

Collector does not bypass logins, paywalls, robots protections, rate limits or access controls. Unknown sources are rejected. Production collection and publication fail closed unless the source registry explicitly records commercial-use permission.

Research datasets such as StatsBomb Open Data and MoneyPuck remain disabled and non-publishable by default. They may be used in a separate development environment only when their current license permits the intended use.

Collector never changes production probability, upgrades CAUTION/SKIP to PLAY or executes real-money bets. All records remain paper-only.

## Components

- `lib/collector-source-registry.mjs`: source, license and rights registry
- `lib/collector-normalize.mjs`: normalization, chronology checks, fingerprints and deduplication
- `lib/collector-json-provider.js`: bounded server-only HTTPS JSON provider adapter
- `app/api/internal/collector`: protected scheduled collection worker
- `app/api/internal/collector/import`: protected import for separately licensed files/data
- `app/api/collector`: publishable-only normalized data API
- `app/api/collector/sources`: sanitized source and rights status
- `app/api/collector/health`: database and worker health
- `/data-collector`: visual source, licensing, health and data dashboard
- `supabase/scorecaster_collector_v1.sql`: forced-RLS storage

## Generic JSON provider contract

The provider endpoint receives a POST request:

```json
{
  "version": "scorecaster-collector-contract-v1",
  "requestedAt": "2026-01-01T12:00:00.000Z",
  "context": {
    "eventIds": ["event-id"],
    "sports": ["ice_hockey"],
    "since": "2025-12-31T12:00:00.000Z"
  }
}
```

It should return either `{ "records": [...] }` or `{ "data": [...] }`. Each record should include `eventId`, `sport`, `metric`, `observedAt` and optional `value`, `unit`, `entityId`, `league`, `confidence`, `sourceTrust` and `payload`.

## Activation

1. Merge the reviewed release.
2. Run the production activation workflow with `action=migrate`.
3. Run it again with `action=probe`.
4. Verify `/api/collector/health` reports `healthy`.
5. Verify `/data-collector` shows first-party publishable observations.

The scheduled workflow runs at minutes 7 and 37 of every hour.

## Adding an external provider

Configure server-only environment variables from `.env.example`. Keep these values until the provider contract has been checked:

```text
COLLECTOR_JSON_ENABLED=false
COLLECTOR_JSON_ACCESS_MODE=disabled
COLLECTOR_JSON_COMMERCIAL_ALLOWED=false
COLLECTOR_JSON_TRAINING_ALLOWED=false
```

Enable production only after the operator has written permission covering Scorecaster's commercial analytics, historical storage, derived metrics and model training. Redistribution permission is tracked separately and defaults to false.
