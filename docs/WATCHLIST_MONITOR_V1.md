# Watchlist Monitor V1

Watchlist Monitor V1 turns the existing user-triggered Watchlist refresh into a bounded, server-scheduled monitoring path. It evaluates only selections that were previously saved from Scorecaster's verified Top Picks surface.

It does not place bets, move money, invent replacement markets or guarantee that a provider will continue to publish a watched selection.

## Processing order

Every protected monitor cycle:

1. Atomically claims at most 20 due users with `FOR UPDATE SKIP LOCKED`.
2. Gives each claimed user a ten-minute lease.
3. Loads at most 50 stored Watchlist rows for that user.
4. Loads verified Top Picks once per bounded group of up to six sports.
5. Applies the existing Watchlist Alert Engine without changing its decision rules.
6. Applies the user's Notification Registry category preferences.
7. Synchronizes deduplicated Alert Inbox history.
8. Stores descriptive Market Timeline snapshots when the verified price, decision, bookmaker or consensus materially changes, or at least 15 minutes have elapsed.
9. Stores success/error metadata for the user and releases the lease.

The run processes at most 12 unique sports. A user deferred by that budget receives an error-state retry after five minutes instead of a partial evaluation. This prevents missing sports from incorrectly resolving existing alerts.

## Background worker chain

The opt-in GitHub Actions scheduler calls the workers in this order:

```text
/api/internal/watchlist-monitor
/api/internal/notification-delivery
```

The monitor creates or resolves Alert Inbox rows first. Notification Delivery may then queue and send newly created unread rows. Either worker can be enabled independently.

## Security model

- The internal route requires `Authorization: Bearer <CRON_SECRET>`.
- `CRON_SECRET` must contain at least 16 characters.
- The monitor requires the server-only Supabase service-role key.
- Browser cookies and mobile bearer sessions cannot invoke the internal worker.
- `watchlist_monitor_state` uses enabled and forced Row Level Security.
- Authenticated users may read only their own monitor metadata.
- Only `service_role` may claim or complete monitor leases.
- Provider and Supabase secrets are never returned by the status API or account export.

## User-visible metadata

`GET /api/cloud/watchlist-monitor` returns:

- whether the migration is available
- whether the server worker is configured and active
- the planned 15-minute interval
- last start and completion timestamps
- last status and bounded error text
- item, alert and snapshot counts from the last cycle

The account export includes the same non-secret metadata. Permanent account deletion removes the state row before the account is deleted.

## Activation

Run migrations in the documented order, including:

```text
supabase/scorecaster_watchlist_alerts.sql
supabase/scorecaster_alert_inbox.sql
supabase/scorecaster_market_timeline.sql
supabase/scorecaster_notification_registry.sql
supabase/scorecaster_watchlist_monitor.sql
supabase/scorecaster_notification_delivery.sql
```

Set these server values:

```text
SCORECASTER_WATCHLIST_MONITOR_ENABLED=true
CRON_SECRET=<random value with at least 16 characters>
NEXT_PUBLIC_SUPABASE_URL=<production Supabase URL>
SUPABASE_SERVICE_ROLE_KEY=<server-only service role key>
```

For the included GitHub Actions schedule, also set:

```text
Repository variable:
SCORECASTER_WATCHLIST_MONITOR_ENABLED=true

Repository secrets:
SCORECASTER_NOTIFICATION_DELIVERY_URL=https://<production-host>
SCORECASTER_CRON_SECRET=<same CRON_SECRET>
```

The existing URL secret keeps its historical name but is used as the common Scorecaster application URL for both workers.

## Verification checklist

1. Apply the migration twice and confirm it remains idempotent.
2. Add Watchlist items for two separate users.
3. Confirm each user can read only their own monitor state.
4. Invoke the internal route without the secret and confirm rejection.
5. Invoke it with monitoring disabled and confirm fail-closed behavior.
6. Enable monitoring and confirm each user is leased once.
7. Confirm concurrent calls do not process the same user simultaneously.
8. Confirm current verified prices create bounded timeline snapshots.
9. Confirm Alert Inbox fingerprints remain deduplicated.
10. Confirm disabled notification categories are not left active.
11. Confirm the notification-delivery worker runs only after monitor completion.
12. Confirm account export contains metadata but no service key, provider key or push token.

## Limitations

- The monitor uses the same verified Top Picks analysis surface as the interactive Watchlist.
- A selection absent from the current verified analysis is treated as unavailable; no alternate market is substituted.
- Market Timeline history is descriptive. It is not proof of sharp money, inside information or the event outcome.
- The scheduler interval is approximate and depends on the selected external scheduler.
- Push delivery remains separately fail-closed and requires real-device testing.