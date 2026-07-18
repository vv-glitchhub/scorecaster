# Alert Inbox V2

Alert Inbox V2 extends Scorecaster's authenticated Watchlist alert history without introducing a second notification-preference system.

## Architecture

1. `notification_preferences` remains the only alert preference authority.
2. `/api/cloud/watchlist` creates server-verified alert conditions and filters them through Notification Registry settings.
3. `lib/alert-inbox-service.js` deduplicates the allowed conditions by `user_id,fingerprint`.
4. `alert_inbox.dismissed_at` provides reversible dismissal without deleting audit history.
5. `/api/cloud/alerts` supports `all`, `unread`, `active`, `resolved` and `dismissed` views plus read, dismiss and restore actions.
6. `/alerts` provides the dedicated Finnish, English and Spanish web interface.
7. The native Watchlist supports read and dismiss actions through the same authenticated API.

## Database rollout

Run `supabase/scorecaster_alert_inbox.sql` after the existing Watchlist migration. The migration is idempotent and adds `dismissed_at` plus a user-visible inbox index.

Before the V2 column is active, normal Alert Inbox reads continue through the V1 fallback. Dismiss and restore actions return a migration-not-active response instead of deleting or fabricating data.

## Data behavior

- Rows are isolated with Row Level Security and `auth.uid() = user_id`.
- Dismissal is reversible and does not remove the row.
- A dismissed active alert stays dismissed while the same condition remains active.
- If the condition resolves and later becomes active again, it reopens as unread and visible.
- Notification Registry settings control which active conditions enter the inbox.
- No background notification delivery or real-money betting is claimed by this feature.

## Export and deletion

`/api/account/alert-inbox-export` returns the authenticated user's Notification Registry preferences and up to 1,000 inbox records. Account deletion already removes notification devices, notification preferences, Alert Inbox rows and Watchlist rows in dependency-safe order.

## Validation

Run:

```bash
npm run test:alert-inbox
npm test
npm run build
```

The mobile CI additionally type-checks the native Watchlist integration.
