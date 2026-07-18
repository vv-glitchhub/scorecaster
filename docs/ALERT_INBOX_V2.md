# Alert Inbox V2

Alert Inbox V2 extends the existing deduplicated Watchlist inbox without replacing the V1 table, fingerprints or API route.

## Added capabilities

- personal enable/disable setting
- minimum severity: info, medium or high
- category switches for kickoff, price, decision and availability events
- mark one alert read or unread
- mark all visible unread alerts read
- dismiss an alert from the visible inbox without deleting its deduplication key
- localized Finnish, English and Spanish copy generated from structured alert type and details
- visible, unread, active and resolved filters
- account export of settings and dismissal state
- account deletion of settings before alert history

## Data model

Run after V1:

```text
supabase/scorecaster_alert_inbox_v2.sql
```

The migration adds `dismissed_at` to `alert_inbox` and creates `alert_inbox_settings` with forced Row Level Security. Existing V1 rows remain valid.

Normal access requires `auth.uid() = user_id`. Anonymous access to the settings table is revoked.

## Backward-compatible rollout

The service first attempts the V2 column and settings table. Before the V2 migration is active:

- V1 rows remain readable
- Watchlist synchronization continues with conservative default settings
- the API reports that V2 controls are unavailable
- settings and dismissal writes return an explicit unavailable response
- no replacement rows or parallel inbox table are created

Apply the V2 migration before enabling V2 controls in production.

## Preference behavior

Preferences affect the next Watchlist synchronization.

- disabled inbox: current server alerts are not upserted and existing active conditions become resolved
- minimum severity: lower-severity current conditions are excluded
- category switches: matching current conditions are excluded
- existing visible history remains until dismissed or the account is deleted

Preferences cannot promote a betting decision, create a paper stake or change market probability.

## Dismissal behavior

Dismissal sets `dismissed_at` rather than deleting the row.

- the same continuing fingerprint stays hidden on the next refresh
- if the condition genuinely resolves and later reappears, it becomes visible and unread again
- export retains dismissal history
- permanent account deletion removes the row

## Localization

The database keeps server-generated English fallback title and message for auditing. Supported clients render known alert types from `alert_type` and bounded `details`:

- `kickoff_soon`
- `decision_changed`
- `price_moved`
- `below_play_price`
- `market_unavailable`
- `fixture_passed`

This allows the same stored event to appear in Finnish, English or Spanish without storing three message copies.

## API

`/api/cloud/alerts` supports:

- `GET` with `status=all|unread|active|resolved|dismissed`
- `PUT` for bounded settings
- `PATCH` for one read/unread state or mark-all-read
- `DELETE` for soft dismissal

Every mutation validates origin, authentication and a database-backed per-user quota. Every row operation also filters by the authenticated user ID.

Clients cannot submit an alert title, message, fingerprint, severity or calculated event state.

## No background delivery claim

V2 remains an in-app, user-refreshed inbox.

- no operating-system notification permission
- no device notification token
- no background worker claim
- no `expo-notifications` dependency

A later delivery phase requires separate privacy, token-lifecycle, scheduling, duplicate-delivery, credential and store-review work.

## Release verification

1. Apply V1 and V2 migrations.
2. Create users A and B with different Watchlist items.
3. Confirm each user sees only their own inbox and settings.
4. Change A's minimum severity and verify B is unchanged.
5. Disable one category and verify the next synchronization filters only that category.
6. Mark an alert read, unread and read again across web and native clients.
7. Dismiss a continuing condition and confirm it stays hidden after refresh.
8. Resolve and recreate that condition and confirm it reopens unread.
9. Export both accounts and verify settings plus dismissal state remain isolated.
10. Delete one account and verify settings, inbox and Watchlist rows are removed.
