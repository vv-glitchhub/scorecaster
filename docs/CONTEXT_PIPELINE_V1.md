# Scorecaster Context Pipeline V1

Context Pipeline V1 completes the operational path from governed pre-match evidence to the event page.

## Included surfaces

- automatic worker: `/api/internal/context-ingestion`
- public health: `/api/context/health`
- operator import API: `/api/cloud/context-evidence`
- operator console: `/context-operations`
- event integration: every `/event/[eventId]` page renders a Context Engine panel
- scheduled workflow: `.github/workflows/context-ingestion.yml`

The pipeline stores evidence only. Ingestion does not change a production probability, edge, EV, decision or paper stake. Context Engine separately produces a bounded before/after sensitivity preview and cannot independently promote PLAY.

## Licensed provider configuration

The context adapter reuses Scorecaster's governed configurable JSON source. Production collection stays blocked until all required rights flags are explicit.

Required Vercel environment variables:

```text
COLLECTOR_JSON_API_URL=https://licensed-provider.example/context
COLLECTOR_JSON_SOURCE_ID=configured_json_api
COLLECTOR_JSON_SOURCE_NAME=Licensed context provider
COLLECTOR_JSON_ENABLED=true
COLLECTOR_JSON_ACCESS_MODE=production
COLLECTOR_JSON_COMMERCIAL_ALLOWED=true
COLLECTOR_JSON_REDISTRIBUTION_ALLOWED=false
COLLECTOR_JSON_TRAINING_ALLOWED=false
COLLECTOR_JSON_ATTRIBUTION_REQUIRED=true
COLLECTOR_JSON_ATTRIBUTION=Context data: Provider name
COLLECTOR_JSON_LICENSE=operator-verified-commercial-contract
COLLECTOR_JSON_TERMS_URL=https://licensed-provider.example/terms
COLLECTOR_JSON_FRESHNESS_MINUTES=180
COLLECTOR_JSON_API_KEY=<server-only secret>
```

The endpoint must use HTTPS. Secrets, headers, request URLs and raw provider payloads are never returned by public APIs or stored in `context_evidence_v1`.

## Provider request contract

Scorecaster sends a server-to-server POST body:

```json
{
  "version": "scorecaster-context-provider-contract-v1",
  "requestedAt": "2026-08-05T08:00:00.000Z",
  "paperOnly": true,
  "context": {
    "events": [
      {
        "eventId": "provider:event-id",
        "sport": "soccer_epl",
        "league": "Premier League",
        "homeTeam": "Home team",
        "awayTeam": "Away team",
        "kickoffAt": "2026-08-05T18:00:00.000Z"
      }
    ],
    "categories": ["lineup", "injury", "suspension", "availability", "rest", "travel", "weather", "surface", "official"],
    "confirmationStates": ["confirmed", "probable", "unconfirmed", "rumor"],
    "rawPayloadRequested": false
  }
}
```

The provider may return `contextRecords`, `records` or `data` as an array. Each record uses the Context Engine evidence contract.

```json
{
  "eventId": "provider:event-id",
  "teamRole": "home",
  "team": "Home team",
  "category": "injury",
  "subject": "Player name",
  "status": "out",
  "confirmation": "confirmed",
  "expectedMinutesDelta": -75,
  "minutesBaseline": 90,
  "roleImportance": 0.8,
  "highImpactRole": "starting goalkeeper",
  "confidence": 0.95,
  "sourceTrust": 0.9,
  "observedAt": "2026-08-05T15:45:00.000Z",
  "effectiveAt": "2026-08-05T18:00:00.000Z",
  "sourceReference": "provider-record-123",
  "publicNote": "Confirmed unavailable."
}
```

An explicit normalized `impact` from -1 to 1 may be supplied. When it is absent, the adapter derives a bounded impact from expected participation or expected minutes and role importance.

## Validation and fail-closed rules

A record is rejected when it has:

- an unknown event
- an unsupported category, team role or confirmation state
- no production-approved source
- future or post-kickoff observation time
- an effective time after kickoff
- invalid expiry order
- a missing subject or status
- a duplicate source reference within the batch

Provider records are deduplicated against existing `source_id + source_reference` pairs before insertion. Corrections may reference `supersedesSourceReference`; the worker resolves it to the earlier append-only row.

## Automatic operation

The GitHub Actions worker runs at minutes 22 and 52 each hour. It:

1. loads current upcoming Scorecaster events
2. sends only normalized public event identity to the configured provider
3. validates licensing, timestamps and fields
4. rejects duplicates and invalid records
5. appends eligible records through `service_role`
6. verifies public health

The worker requires the existing `CRON_SECRET` GitHub and Vercel secret.

## Manual operator import

Set at least one allowlist:

```text
SCORECASTER_OPERATOR_EMAILS=operator@example.com
SCORECASTER_OPERATOR_USER_IDS=<supabase-user-uuid>
```

The signed-in allowlisted operator may use `/context-operations`. The server forces `manual_licensed_import`, validates origin and rate limits, and writes through the admin client. Browser roles still have no direct table access.

## Production checklist

- `context_evidence_v1` exists and its RLS verification returns `ok: true`
- `CRON_SECRET` exists in Vercel and GitHub Actions
- provider rights and attribution are recorded before enabling the source
- the configured URL is HTTPS
- operator allowlist is configured only when manual import is required
- `/api/context/health` returns database availability without exposing secrets
- a controlled test record appears on the matching event page

## Remaining external dependency

Scorecaster now contains the full ingestion, validation, storage, monitoring and UI pipeline. Actual automatic lineup, injury, travel, weather and official data begins only after a licensed provider endpoint and credentials are supplied. Missing provider data remains visibly missing; Scorecaster does not scrape or invent it.
