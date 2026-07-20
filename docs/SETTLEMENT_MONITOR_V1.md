# Settlement Monitor V1

Settlement Monitor V1 resolves supported open H2H paper picks in the background when the configured score provider returns a completed event. It never places a bet, handles money or invents a missing result.

## Product boundary

- Paper tracking only.
- No bookmaker login or redirect.
- No deposits, withdrawals or payment data.
- Only existing `bets` rows with `status = open` are eligible.
- Only the `h2h` market is automatically resolved.
- A selection must match the completed home team, away team or an explicit draw label.
- Missing, incomplete, malformed or unsupported results remain open.
- Manual settlement remains available to the user.

## Processing model

The worker is invoked through:

```text
GET /api/internal/settlement-monitor
Authorization: Bearer <CRON_SECRET>
```

The route fails closed unless all required server settings are present. It uses a Supabase service-role client only on the server.

A database queue claims due users with `FOR UPDATE SKIP LOCKED` and a ten-minute lease. One worker cycle is bounded to:

- 20 users
- 100 open paper picks per user
- 12 sports across the run
- 200 successful update attempts

Score responses are loaded once per sport and shared across every claimed user in the cycle. This prevents one provider call per user.

## Settlement integrity

Both the manual result-check button and Settlement Monitor use:

- `lib/paper-score-provider.js`
- `lib/paper-settlement-engine.mjs`

Each database update includes:

```text
id = expected paper bet
user_id = expected account
status = open
```

This makes repeated and overlapping cycles idempotent. A bet already resolved manually or by another worker is not overwritten.

The stored `raw_pick` audit adds:

- provider event ID
- settlement source
- settlement monitor version
- final score
- provider completion timestamp
- Scorecaster settlement timestamp

## Scheduling

The included GitHub Actions workflow runs every 15 minutes, but the database normally schedules each user for an hourly result check. Errors retry after 15 minutes.

The Settlement Monitor job is independent from Watchlist Monitor and Notification Delivery. A failure in one worker does not block the others.

The workflow is opt-in. It runs only when this repository variable is set:

```text
SCORECASTER_SETTLEMENT_MONITOR_ENABLED=true
```

The server also requires:

```text
SCORECASTER_SETTLEMENT_MONITOR_ENABLED=true
CRON_SECRET=<at least 16 unpredictable characters>
NEXT_PUBLIC_SUPABASE_URL=<production project URL>
SUPABASE_SERVICE_ROLE_KEY=<server-only key>
ODDS_API_KEY=<server-only score provider key>
```

Use exactly one scheduler for this endpoint.

## Database migration

Run:

```text
supabase/scorecaster_settlement_monitor.sql
```

The migration creates:

- `paper_settlement_monitor_state`
- a trigger that schedules users when paper bets change
- an atomic claim function for the service role
- a completion function for status and counters
- forced RLS so authenticated users can read only their own monitor metadata

## User-visible state

Authenticated users can inspect safe metadata through:

```text
GET /api/cloud/settlement-monitor
```

The API and native Paper Tracking screen expose:

- configured versus active state
- latest run status
- last completed time
- open, settled and pending counts
- provider warning count
- bounded error text

No API key, service-role key, cron secret or provider response payload is exposed.

## Export and deletion

Account export includes the user-owned Settlement Monitor metadata. Permanent account deletion removes that metadata before removing the account.

## Validation

`npm run test:settlement-monitor` verifies:

- forced RLS and ownership isolation
- trigger scheduling
- atomic claims and leases
- bounded users, bets, sports and updates
- H2H-only and open-only behavior
- shared score-provider access
- protected internal invocation
- independent scheduling
- native status UI
- account export and deletion coverage
