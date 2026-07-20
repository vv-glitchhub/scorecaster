# Scorecaster Release Readiness V1

Release Readiness V1 turns the final production checklist into repeatable repository and live-service verification.

It does not claim that external work is complete. Physical device testing, two-user isolation, legal identity, store screenshots and an independent security review still require human evidence.

## Components

### Release manifest

`config/release-readiness.json` is the authoritative source for:

- production origin
- public smoke-test pages
- APIs that must reject unauthenticated requests
- internal worker routes that must fail closed
- required security headers
- ordered Supabase SQL rollout
- Apple and Google Play locales
- manual release blockers

Do not maintain a separate SQL order in another document. Update the manifest and its tests together when a migration is added.

### Repository audit

Run:

```bash
npm run release:audit
```

The audit checks:

- every listed page and API route exists
- every SQL migration exists and the order is stable
- API responses retain no-store headers
- reviewed security headers remain configured
- mobile package identifiers and product boundary remain unchanged
- FI, EN and ES store metadata exists
- store links use the production Scorecaster origin
- the smoke workflow and documentation remain present
- release metadata contains no server-only secret names or push token fields

Manual blockers are printed as warnings and never silently marked complete.

### Production smoke

Run against production:

```bash
npm run release:smoke
```

Override the origin when testing a preview:

```bash
SCORECASTER_SMOKE_BASE_URL=https://preview.example.invalid npm run release:smoke
```

The origin must use HTTPS, except for localhost development.

The smoke verifier checks:

- public pages return HTML successfully
- reviewed security headers are present
- `/api/health` returns Scorecaster JSON and no-store caching
- account and cloud APIs reject unauthenticated requests
- internal worker routes reject missing worker authorization or remain unavailable
- responses do not expose secret names, push token fields or secret-key patterns

A JSON report is written to `artifacts/production-smoke.json` by default.

### Optional authenticated probes

A short-lived test-account access token may be supplied through the environment:

```bash
SCORECASTER_SMOKE_ACCESS_TOKEN=... npm run release:smoke
```

The token is used only in the request header. It is not written to the report or logs. The authenticated smoke currently verifies the Operations and paper-bet read surfaces.

Never commit a token or place it in workflow inputs. Use the optional GitHub Actions secret `SCORECASTER_SMOKE_ACCESS_TOKEN`.

### GitHub Actions

`.github/workflows/production-smoke.yml` runs:

- manually with an optional HTTPS base URL
- once per day against `SCORECASTER_PRODUCTION_URL` or the default production origin

The workflow stores the JSON report for 30 days. It uses read-only repository permissions and does not invoke worker mutations.

## Web console

`/release-readiness` combines:

- live `/api/health`
- authenticated `/api/operations`
- release manifest counts
- production configuration status
- migration and worker activation status
- explicit manual blockers

The page is informational and read-only. It does not expose secrets, start workers or change user data.

## Ordered Supabase rollout

The current manifest order is:

1. `scorecaster_schema.sql`
2. `scorecaster_auth_cloud.sql`
3. `scorecaster_paper_risk_limits.sql`
4. `scorecaster_api_rate_limits.sql`
5. `scorecaster_watchlist_alerts.sql`
6. `scorecaster_market_timeline.sql`
7. `scorecaster_alert_inbox.sql`
8. `scorecaster_notification_registry.sql`
9. `scorecaster_notification_delivery.sql`
10. `scorecaster_watchlist_monitor.sql`
11. `scorecaster_settlement_monitor.sql`

Apply migrations in this order in the production Supabase SQL Editor. Re-running an idempotent migration is preferable to guessing whether an older partial version was applied.

## Remaining human release evidence

Public store submission remains blocked until all of the following are documented:

- web and mobile two-user RLS isolation
- physical iOS and Android push delivery including invalid-token cleanup
- FI, EN and ES authentication, paper save, settlement, export and deletion
- EAS project linkage, final icon, splash and signed builds
- final support contact, legal controller identity and store disclosures
- independent production security review

Release Readiness V1 makes these blockers visible. It does not fabricate completion evidence.
