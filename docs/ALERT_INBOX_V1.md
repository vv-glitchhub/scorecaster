# Alert Inbox V1

Alert Inbox V1 stores verified Watchlist changes as a deduplicated, user-specific history.

It does not create paper stakes, place bets, send money or claim that background push delivery is active.

## Data flow

1. The authenticated Watchlist API loads only the user's `watchlist_items` rows.
2. Current selections are resolved again from server Top Picks.
3. `buildWatchlistState` creates deterministic alerts from verified price, decision and kickoff changes.
4. `syncAlertInbox` stores those server-generated alerts in `alert_inbox`.
5. Web and native clients read the same inbox and may mark one or all unread rows as read.

Clients cannot submit arbitrary alert titles, messages or fingerprints to the inbox API.

## Deduplication and lifecycle

The database has a unique `(user_id, fingerprint)` index.

- a condition seen again updates `last_seen_at`
- a still-active alert preserves its read state
- a condition that disappears becomes resolved
- a resolved condition that later reappears becomes active and unread
- deleting the parent Watchlist item deletes its inbox history through the foreign key cascade

## Security model

`alert_inbox` uses enabled and forced Row Level Security.

All normal reads and writes require `auth.uid() = user_id`. Anonymous access is revoked. The application API also enforces:

- authenticated cookie or bearer sessions
- same-origin validation for cookie mutations
- database-backed per-user request quotas
- bounded body and query parameters
- explicit user filters on updates

No service-role key is used by Watchlist or Alert Inbox operations.

## Privacy controls

The account export includes Alert Inbox rows. Permanent account deletion removes Alert Inbox rows before deleting Watchlist rows and the user account.

Stored inbox details are limited to the verified alert, match, selection, timestamps and bounded numeric comparison fields. No payment data, bookmaker credentials or real-money balance is stored.

## Activation

Run the Supabase migrations in this order:

```text
supabase/scorecaster_schema.sql
supabase/scorecaster_auth_cloud.sql
supabase/scorecaster_paper_risk_limits.sql
supabase/scorecaster_api_rate_limits.sql
supabase/scorecaster_watchlist_alerts.sql
supabase/scorecaster_alert_inbox.sql
```

Until the last migration is active, Watchlist V2 remains usable and returns an explicit Alert Inbox unavailable warning. This prevents a partial database rollout from breaking the existing Watchlist.

## Release verification

Before public release:

1. Create users A and B.
2. Add a different Watchlist item for each user.
3. Refresh both Watchlists and confirm each inbox contains only its own rows.
4. Confirm repeated refreshes do not create duplicate fingerprints.
5. Mark one alert read and confirm the other user's rows do not change.
6. Resolve a condition and confirm history remains with `active = false`.
7. Recreate the condition and confirm it becomes active and unread.
8. Export each account and confirm only that user's inbox is included.
9. Delete one account and confirm its inbox and Watchlist rows are removed.

## Future push delivery

A future push-notification worker may use Alert Inbox as its source of truth. Push delivery must be implemented separately with device-token consent, token revocation, delivery deduplication and store-policy review. Alert Inbox V1 alone does not claim background monitoring or push delivery.
