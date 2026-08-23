# Scorecaster Verified Live Monitor V1

> Data Readiness V1 adds explicit written-rights, live-display, retention, authentication and contract-reference gates. See `docs/DATA_READINESS_V1.md`.

Verified Live Monitor is an informational, paper-only event integrity layer. It tracks timestamped live score, clock, period, provider freshness, provider conflicts, visible correction events, market availability and licensed sport-specific metrics.

It does not place bets, connect to bookmaker accounts, suggest a stake, instruct a live entry or change any pre-match probability, feature, decision or audit.

## Core boundaries

- live and pre-match evidence use separate model and audit versions
- live probability is labelled `live-provider-consensus-v1`
- live probability is never available to pre-match model features
- delayed, stale, conflicting or unidentified event state suspends interpretation
- state cannot move backwards unless a visible append-only correction identifies the superseded row and reason
- alerts are informational and paper-only
- unsupported sports and markets are rejected
- raw provider payloads, API keys and authorization headers are never stored or returned
- no stake, deposit, withdrawal, bookmaker login or real-money execution

The legacy `/api/live-betting` endpoint is retired. It returns a safe deprecation response and does not import the former entry/stake suggestion engine.

## Supported live state

V1 accepts these sport prefixes:

- `soccer`
- `icehockey`
- `basketball`
- `baseball`
- `americanfootball`

Supported markets are `h2h`, `spreads` and `totals`. Sport-specific metrics can be included only in the normalized `metrics` object when the configured source licence permits their collection and display.

## Provider contract

The server calls the configured rights-approved JSON source with:

```json
{
  "version": "scorecaster-live-monitor-provider-v1",
  "requestedAt": "2026-08-06T00:00:00.000Z",
  "events": [
    {
      "eventId": "provider-event-id",
      "sport": "soccer_epl",
      "league": "Premier League",
      "homeTeam": "Home",
      "awayTeam": "Away",
      "commenceTime": "2026-08-06T18:00:00.000Z"
    }
  ]
}
```

The provider responds with `records` or `data`. Every record requires:

```json
{
  "providerReference": "immutable-provider-record-reference",
  "eventId": "provider-event-id",
  "sourceId": "configured_json_api",
  "providerId": "licensed-provider-a",
  "sport": "soccer_epl",
  "market": "h2h",
  "status": "live",
  "period": 1,
  "clockSeconds": 1800,
  "clockDirection": "up",
  "homeScore": 1,
  "awayScore": 0,
  "observedAt": "2026-08-06T18:30:00.000Z",
  "providerUpdatedAt": "2026-08-06T18:29:58.000Z",
  "capturedAt": "2026-08-06T18:30:01.000Z",
  "metrics": {},
  "prices": [],
  "liveProbabilities": {
    "home": 0.64,
    "draw": 0.24,
    "away": 0.12
  },
  "liveModelVersion": "licensed-provider-live-v3"
}
```

A correction must append a new record with:

```json
{
  "correction": true,
  "correctionReason": "Provider corrected an earlier score event",
  "supersedesProviderReference": "earlier-provider-record-reference"
}
```

The earlier row is never rewritten or deleted.

## Freshness and conflict handling

Default provider thresholds:

```text
fresh:   provider age <= 90 seconds
delayed: provider age <= 180 seconds
stale:   provider age > 180 seconds
```

Fresh provider evidence is preferred. Delayed evidence is a fallback with a visible warning. Stale evidence cannot support a current verified state.

A current state requires a provider majority among usable rows. When equally supported providers disagree materially on status, period, clock or score, the event becomes `suspended` and the audit emits a high-severity provider-conflict alert.

## Event integrity

Without a correction event, a provider state is rejected when:

- status moves backwards
- a final event becomes live again
- either team score decreases
- period decreases
- an upward-running clock decreases inside the same period
- a downward-running clock increases inside the same period

Rejected updates remain visible in the integrity audit but never become the accepted current state.

## Product surfaces

- dashboard: `/live-monitor`
- direct event audit: `/live-monitor/[eventId]`
- public redacted audit: `GET /api/verified-live-monitor?eventId=`
- authenticated alert inbox and preferences: `GET/PATCH /api/cloud/verified-live-monitor`
- redacted health: `GET /api/verified-live-monitor/health`
- protected worker: `GET /api/internal/verified-live-monitor`
- event-page summary: `/event/[eventId]`

## User preferences

Authenticated users control:

- monitor enablement
- alert enablement
- quiet-period start and end
- maximum 0–6 live alerts per hour
- minimum 1–25 percentage-point live probability movement

Quiet-period times are interpreted in **UTC** in V1. The UI labels this explicitly. A future timezone-aware preference migration must preserve the UTC meaning of existing rows.

Users may read, mark read, resolve or delete only their own alerts. Authenticated clients cannot insert alerts. The service role is the only alert writer.

## Scheduled worker

`.github/workflows/verified-live-monitor-worker.yml` runs every ten minutes at minutes 3, 13, 23, 33, 43 and 53. It requires `CRON_SECRET` and calls the production worker and redacted health endpoint.

The worker monitors only active user watchlist events from eight hours before start through two hours after start. It applies user alert limits and quiet periods before storing a new alert.

## Environment configuration

The pipeline is fail-closed until all rights and enablement settings are explicit:

```text
LIVE_MONITOR_ENABLED=true
LIVE_MONITOR_SOURCE_ID=configured_json_api
LIVE_MONITOR_API_KEY=<server-only-key>
CRON_SECRET=<shared-worker-secret>
```

The source URL, licence, commercial-use flag, production access mode and source enablement come from the existing Source Registry configuration, normally:

```text
COLLECTOR_JSON_API_URL=https://licensed-provider.example/live
COLLECTOR_JSON_SOURCE_ID=configured_json_api
COLLECTOR_JSON_ENABLED=true
COLLECTOR_JSON_ACCESS_MODE=production
COLLECTOR_JSON_COMMERCIAL_ALLOWED=true
COLLECTOR_JSON_LICENSE=<verified-licence-name>
COLLECTOR_JSON_ATTRIBUTION=<required-attribution>
```

`LIVE_MONITOR_API_KEY` can fall back to `COLLECTOR_JSON_API_KEY`, but a dedicated server-only key is preferred. No key may use a `NEXT_PUBLIC_` prefix or be committed to GitHub.

Without a configured licensed provider, the system remains disabled or unconfigured and does not invent score, clock, xG, possession, player or market information.

## Production activation

Run in Supabase SQL Editor:

```text
scripts/apply-verified-live-monitor-v1.sql
```

Then run the read-only verification:

```text
scripts/verify-verified-live-monitor-v1.sql
```

The expected verification JSON has:

```json
{
  "ok": true,
  "tablesExist": true,
  "rlsEnabled": true,
  "forceRlsEnabled": true,
  "anonBlocked": true,
  "evidenceServiceOnly": true,
  "preferenceUserAccess": true,
  "alertsServerWriteOnly": true,
  "serviceRoleAccess": true
}
```

After the database proof, configure the licensed provider and set `LIVE_MONITOR_ENABLED=true`. The public health endpoint must then show `ready` and fresh snapshot evidence before the feature is marked production-active.

## Privacy and account lifecycle

Account export includes the user's live monitor preferences and alert evidence. Account deletion removes user alerts before preferences. Global normalized provider snapshots and worker runs are operational evidence, not user-owned profile data, and contain no user identifier.

## Alert wording policy

Allowed alerts describe verified event state, delay, staleness, conflict, correction, score, period, final state, price availability or provider-consensus probability movement.

Alerts must never include:

- `bet now`
- `enter now`
- a suggested stake
- instructions to deposit, withdraw or move money
- guaranteed-profit or guaranteed-win language
- unsupported claims about sharp money or inside information
