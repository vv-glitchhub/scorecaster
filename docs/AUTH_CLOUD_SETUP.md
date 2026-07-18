# Scorecaster Auth + Cloud Sync Setup

This guide enables user accounts, protected paper history, personal paper-risk limits, verified watchlists, deduplicated Alert Inbox history and preferences, and optional paper-result checking.

## Database schema and security

Run the Supabase SQL files in this order:

1. `supabase/scorecaster_schema.sql`
2. `supabase/scorecaster_auth_cloud.sql`
3. `supabase/scorecaster_paper_risk_limits.sql`
4. `supabase/scorecaster_api_rate_limits.sql`
5. `supabase/scorecaster_watchlist_alerts.sql`
6. `supabase/scorecaster_alert_inbox.sql`
7. `supabase/scorecaster_alert_inbox_v2.sql`

The migrations add forced Row Level Security, user-specific paper data, verified Watchlist rows, deduplicated Alert Inbox history, read and resolved state, soft dismissal, severity and category preferences, paper-risk enforcement and database-backed per-user quotas.

## Authentication redirects

Configure the production website callback and allow the native Scorecaster callback pattern:

```text
https://scorecaster.vercel.app/auth/confirm
scorecaster://**
```

Test the native callback on signed devices before store release.

## Required verification

1. Create account A and verify its email.
2. Save A's virtual bankroll and paper-risk settings.
3. Confirm invalid stake, total exposure, league exposure, minimum edge and minimum confidence writes are rejected.
4. Add a current server-verified selection to A's Watchlist.
5. Submit a fabricated event ID directly to the Watchlist API and confirm rejection.
6. Refresh repeatedly and confirm one Alert Inbox row per fingerprint.
7. Mark an alert read, unread and read again across web and native clients.
8. Remove the current condition and confirm the inbox row becomes resolved.
9. Recreate the condition and confirm it becomes active and unread.
10. Set minimum severity to high and verify lower-severity conditions are filtered on the next refresh.
11. Disable one category and verify only that category is filtered.
12. Dismiss a continuing condition and verify it stays hidden after refresh.
13. Resolve and recreate the dismissed condition and verify it reopens visible and unread.
14. Create account B.
15. Confirm B cannot read, update, dismiss or configure A's paper, Watchlist or Alert Inbox rows.
16. Repeat protected flows with web-cookie and mobile-bearer sessions.
17. Exceed quotas and confirm HTTP 429 plus `Retry-After`.
18. Export the main account package and the Alert Inbox V2 package, confirming only A's rows are included.
19. Delete A and confirm settings, inbox, Watchlist and authentication rows are removed.

## Routes

- `/watchlist` — verified Watchlist and compact current alert view
- `/alerts` — Alert Inbox V2 history, filters and preferences
- `/api/cloud/watchlist` — authenticated Watchlist and inbox synchronization
- `/api/cloud/alerts` — authenticated inbox read, preferences, read state and dismissal
- `/api/account/export` — main authenticated account export
- `/api/account/alert-inbox-export` — authenticated Alert Inbox V2 settings and history export
- `/api/account` — account status and permanent deletion

## Security model

- validated cookie or mobile bearer session
- exact-origin validation for cookie mutations
- forced RLS using `auth.uid()`
- explicit authenticated-user filters on every inbox mutation
- server-generated inbox content only
- unique `(user_id, fingerprint)` deduplication
- bounded preferences and request bodies
- database-backed per-user quotas
- server-only integration settings

Alert Inbox V2 remains in-app and user-refreshed. It does not register a device push token, request operating-system notification permission or claim background delivery.
