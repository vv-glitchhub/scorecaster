# Sports Analytics Automation V1

Sports Analytics Automation V1 turns the sport-specific catalogue and Expected Performance Engine into an automatic, visual data pipeline.

## What is automatic

Every 30 minutes the existing `Scorecaster Unified Data Capture` workflow calls:

```text
GET /api/internal/unified-data
GET /api/internal/sports-analytics
Authorization: Bearer <CRON_SECRET>
```

The Sports Analytics worker:

1. loads current verified Top Picks events
2. keeps one representative selection per event
3. converts existing Scorecaster evidence into normalized observations
4. requests optional xG, event, tracking, player and golf-shot observations from the configured external provider
5. merges and deduplicates observations with SHA-256 fingerprints
6. creates one event snapshot per 30-minute capture bucket
7. stores observations and visual coverage summaries in Supabase
8. keeps production probability and paper-only safety boundaries unchanged

The internal automatic layer works with Scorecaster's existing configured data. It includes available market, provider-quality, lineup, injury, rest, travel, weather, news, intelligence and unified-ledger evidence.

## External provider adapter

Rich proprietary feeds are connected through one server-only HTTPS adapter:

```text
SPORTS_ANALYTICS_API_URL=
SPORTS_ANALYTICS_API_KEY=
SPORTS_ANALYTICS_PROVIDER_NAME=
```

Scorecaster sends a bounded POST contract containing only event identity and requested metric names. The API key is sent in an `Authorization: Bearer` header and never appears in a URL, browser bundle or stored observation.

Expected response shape:

```json
{
  "provider": "licensed-provider",
  "observedAt": "2026-07-26T10:25:00Z",
  "sourceTrust": 0.9,
  "confidence": 0.85,
  "observations": [
    {
      "family": "expected",
      "metric": "xg",
      "value": 0.21,
      "unit": "probability",
      "participantId": "player-or-team-id",
      "metadata": { "playId": "provider-play-id" }
    }
  ],
  "shots": [
    {
      "id": "shot-id",
      "playerId": "golfer-id",
      "startDistanceMeters": 92,
      "endDistanceMeters": 4.5,
      "expectedEndDistanceMeters": 7.5,
      "greenHit": true,
      "club": "PW",
      "lie": "fairway"
    }
  ]
}
```

The adapter accepts up to 1,000 observations and 500 golf shots per response, enforces HTTPS in production, uses a 20-second timeout and rejects responses larger than 2 MB.

A provider must still be licensed and configured. The application cannot legally or technically manufacture NHL EDGE, NBA tracking, ShotLink, StatsBomb or another proprietary feed without access rights and credentials.

## Normalized observation contract

Every stored observation has:

```text
event ID
sport key
canonical sport
league
participant ID
data family
metric
numeric value
unit
observed time
captured time
provider
source trust
confidence
safe metadata
paper-only flag
```

Metadata fields matching secret, token, password, authorization, API key or credential patterns are discarded before storage.

## Storage

Run:

```text
supabase/scorecaster_sports_analytics.sql
```

It creates:

### `sports_analytics_snapshots`

One event row per 30-minute capture bucket containing:

- event and sport identity
- observation and provider counts
- advanced-metric coverage score
- available and missing metrics
- family-level coverage
- provider status
- golf proximity profile
- safe operational summary

### `sports_analytics_observations`

Normalized numeric observations with provider, time, trust, confidence and lineage metadata.

Both tables:

- use forced Row Level Security
- deny direct anonymous and authenticated access
- allow reads and writes only to the service role
- require `paper_only = true`
- are exposed to clients only through the sanitized server API

Production activation runs:

```text
scripts/verify-sports-analytics-schema.sql
```

This verifies tables, forced RLS, service-role permissions, disabled direct client access and bounded paper-only rows.

## Public API

```text
GET /api/sports-analytics
GET /api/sports-analytics?sport=ice_hockey
GET /api/sports-analytics?eventId=<event-id>
GET /api/sports-analytics?hours=168&limit=500
```

When storage has not yet been migrated or contains no snapshots, the API creates a read-only live fallback from current Top Picks. The response clearly reports `liveFallback: true`; it does not pretend that persistent history exists.

## Visual data center

Web page:

```text
/sports-analytics
```

It shows:

- event, observation and provider totals
- the 30-minute automatic capture state
- sport selector for all catalogue sports
- advanced-metric coverage ring
- data-family coverage bars
- available metric chips
- missing metric activation queue
- provider state and failure reason
- latest event snapshots
- normalized observation table
- golf distance-bucket chart with remaining distance, green-hit rate, Proximity Gained and target-zone rates

The page separates operational observations from advanced catalogue coverage. Existing odds or context data does not falsely count as xG or tracking coverage.

## Safety boundary

Sports Analytics Automation V1 does not change the production model boundary:

- probability remains no-vig market consensus
- analytics cannot upgrade CAUTION or SKIP to PLAY
- external metrics remain context or shadow-model evidence until reviewed promotion
- outcomes and closing prices remain evaluation-only
- missing data remains visible
- real-money execution remains absent

## Production activation

1. Merge the reviewed branch.
2. Apply `supabase/scorecaster_sports_analytics.sql` in the ordered migration rollout.
3. Verify `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` in Vercel.
4. Verify the matching `CRON_SECRET` in GitHub Actions.
5. Run production activation schema verification.
6. Run the Unified Data Capture workflow manually once.
7. Confirm the Sports Analytics worker reports stored events and observations.
8. Confirm `/sports-analytics` displays persistent rather than fallback data.
9. Configure the optional external provider only after licensing and provider-contract verification.
10. Verify xG, tracking or golf-shot rows preserve event identity, observation time and source attribution.

## Regression gates

Mandatory tests cover:

- sport-key normalization
- deterministic 30-minute buckets
- automatic conversion of existing Scorecaster data
- external observation and golf-shot normalization
- secret removal from metadata
- event snapshot and golf-profile generation
- service-role-only SQL storage
- protected worker authorization
- scheduled capture route
- visual page presence
- paper-only and no-probability-change boundaries
