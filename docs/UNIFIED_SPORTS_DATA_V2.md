# Unified Sports Data V2

Unified Sports Data V2 turns the event-level V1 ledger into a persistent, monitored production system.

## What V2 adds

- 30-minute event and selection snapshots
- provider-by-provider observations and availability history
- provider divergence monitoring
- persistent data coverage and AI-use history
- operational incidents for outages, weak coverage, divergence and adverse verified context
- opening and final pre-start odds records
- post-start closing-line and price-CLV finalization
- web, Event Detail and native mobile history views
- one combined Alert Inbox view for decision and unified-data incidents

## Safety boundary

The safety rules remain unchanged:

1. Published probability remains the no-vig market consensus.
2. Context cannot upgrade CAUTION or SKIP to PLAY.
3. Verified adverse context may only downgrade PLAY to CAUTION.
4. The total contextual effect remains bounded by V1.
5. Closing odds are created only after the event start from the final stored pre-start snapshot.
6. Closing odds and CLV are calibration data and never enter a pregame decision.
7. Missing providers remain explicit missing-data states. No replacement facts are invented.
8. Scorecaster remains paper-only and does not place real-money bets.

## Storage

Run:

```sql
supabase/scorecaster_unified_data.sql
```

The migration creates four shared operational tables:

### `unified_data_snapshots`

One row per event, selection and 30-minute capture bucket. It stores:

- current decision and price
- market probability
- provider count and disagreement
- configured-family coverage
- AI-used factor count
- bounded context impact
- safety action
- missing families
- compact factor and provider summaries
- the complete audited V1 ledger

### `unified_data_provider_observations`

Provider-specific health observations linked to a snapshot:

- provider and data family
- live/degraded/not-configured mode
- success state
- trust and confidence
- observation age
- divergence from the primary odds source

### `unified_data_closing_records`

Finalized after the event start:

- first stored pregame price as opening odds
- last stored price at or before start as closing odds
- opening and closing timestamps
- market price CLV: `openingOdds / closingOdds - 1`
- snapshot IDs proving chronology

### `unified_data_incidents`

Deduplicated operational incidents:

- provider disagreement
- weak data-family coverage
- adverse verified contextual evidence
- persistent provider outage or degradation

All four tables use forced RLS. Authenticated users can read shared operational history. Only the service-role worker can write.

## Capture worker

Endpoint:

```text
GET /api/internal/unified-data
Authorization: Bearer <CRON_SECRET>
```

GitHub Actions workflow:

```text
.github/workflows/unified-data-capture.yml
```

Schedule:

```text
17 and 47 minutes past every hour
```

The worker:

1. loads current verified Top Picks
2. stores one snapshot per current selection
3. stores provider observations
4. calculates recent provider quality
5. opens or resolves incidents
6. finalizes closing records for events whose start time has passed

The worker fails closed when `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` or the migration is unavailable.

## Public APIs

### Current ledger

```text
GET /api/data-layer
GET /api/data-layer?eventId=<id>&sports=<sport_key>
```

### History

```text
GET /api/data-layer/history
GET /api/data-layer/history?hours=168&limit=1200
GET /api/data-layer/history?eventId=<id>&selection=<selection>&hours=720
```

The history API returns only shared sports-operation data. It contains no account, stake, bankroll, payment or user identity data.

### Health

```text
GET /api/data-layer/health
```

It reports:

- migration state
- snapshot count and latest capture
- capture freshness
- worker configuration
- provider capability configuration
- safe next activation step

It never returns provider keys or secrets.

## User interfaces

### Web

- `/data-layer`: current ledgers, trends, provider quality, incidents and closing records
- `/provider-health`: unified provider history alongside Decision Diagnostics
- Event Detail: current AI provenance plus event-specific history and closing line
- `/alerts`: combined decision-flow and unified-data incidents

### Native mobile

`More -> Unified Sports Data` includes:

- current AI-used and AI-not-used factors
- seven-day production history summary
- provider quality
- active incidents
- closing odds and market CLV

## Production activation checklist

1. Apply `supabase/scorecaster_unified_data.sql` after Decision Diagnostics and before Settlement Monitor.
2. Verify `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in Vercel.
3. Configure one strong random `CRON_SECRET` in both Vercel and GitHub Actions.
4. Set GitHub variable `SCORECASTER_PRODUCTION_URL` or use the reviewed default.
5. Run the `Scorecaster Unified Data Capture` workflow manually.
6. Confirm `/api/data-layer/health` reports `migrationActive: true`.
7. Confirm a snapshot appears within one capture window.
8. Verify provider observations contain no credentials or raw secret headers.
9. Keep the scheduler active through at least one event start.
10. Confirm closing odds equal the last snapshot at or before start and never a post-start price.
11. Verify all incident types open and resolve correctly with controlled test data.
12. Verify web and native displays in Finnish, English and Spanish.

## Provider activation

V2 does not change the provider credentials introduced by V1. Full coverage still depends on:

```text
ODDS_API_KEY
SPORTSGAMEODDS_API_KEY
SPORTSGAMEODDS_LEAGUE_MAP_JSON
SPORTSDATA_API_KEY
LINEUP_API_URL
LINEUP_API_KEY
SPORTS_CONTEXT_API_URL
SPORTS_CONTEXT_API_KEY
NEWS_API_KEY
NEWS_SOURCE_TRUST_JSON
VENUE_COORDINATES_JSON
```

Provider activation and historical storage are separate. The history worker can run safely with partial provider coverage and will document exactly what is missing.

## Regression gates

Mandatory tests cover:

- deterministic 30-minute buckets
- complete snapshot serialization
- provider attribution
- forced pre-start closing chronology
- price-CLV calculation
- provider quality aggregation
- incident detection
- history trend generation
- migration, worker, scheduler, APIs and UI presence
- release manifest registration
- unchanged downgrade-only and paper-only boundaries