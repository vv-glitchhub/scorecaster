# Scorecaster Collector V2

Collector V2 turns the rights-aware V1 storage layer into an observable data-quality system without adding a paid dependency or a second database migration.

## New capabilities

- source quality score and A–E grade
- freshness, source-trust, confidence and field-completeness metrics
- sport, event, metric and source coverage summaries
- automatic stale, low-trust, low-confidence and single-source incidents
- hourly or custom-bucket collection time series
- event-level latest metric summaries and chronological drilldowns
- filtered UTF-8 CSV export
- protected integrity and retention maintenance
- daily maintenance dry-run workflow
- Collector V2 health report with run success and rejection rates

## Source quality score

The score is deliberately transparent:

- 35% freshness
- 25% source trust
- 20% confidence
- 20% required-field completeness

The score measures the health of a licensed data flow. It does not grant usage rights and cannot override the source registry.

## APIs

### `GET /api/collector`

Supported filters:

- `sport`
- `eventId`
- `metric`
- `sourceId`
- `hours`
- `limit`
- `bucketMinutes`
- `eventLimit`

The response contains publishable records and a derived `insights` bundle with coverage, source quality, time series, events and incidents.

### `GET /api/collector/event/:eventId`

Returns chronological publishable observations, latest metric state, source quality and incidents for one event.

### `GET /api/collector/export`

Downloads the filtered publishable dataset as UTF-8 CSV. Research-only data is excluded by the database query before serialization.

### `GET /api/internal/collector/maintenance`

Requires `Authorization: Bearer $CRON_SECRET`.

- default mode is `dry-run`
- `retentionDays` is bounded between 30 and 3650
- deletion requires the explicit query parameter `apply=true`
- integrity checks report missing event identifiers and metrics

The scheduled workflow runs with `apply=false`, so automatic deletion is not enabled.

## Dashboard

`/data-collector` now includes:

- configurable time, sport, metric and source filters
- collection-volume sparkline
- automatic incident center
- source grade cards
- sport coverage table
- selectable event summaries
- event metric drilldown
- CSV and event JSON actions
- source and license registry

## Safety boundary

Collector V2 remains paper-only. It never changes the production probability, upgrades a paper decision, executes a bet, bypasses access controls or publishes research-only data. Source license approval remains a separate fail-closed gate.
