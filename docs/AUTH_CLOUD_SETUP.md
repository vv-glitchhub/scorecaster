# Scorecaster Auth + Cloud Sync Setup

This guide enables user accounts, protected paper history, personal paper-risk limits, verified watchlists, deduplicated alert history, optional notification-device registration and paper-result checking.

## 1. Supabase project

Create or open the Supabase project used by Scorecaster and configure the public project connection values in the deployment environment.

## 2. Database schema and security

Open the Supabase SQL editor and run the files in this order:

1. `supabase/scorecaster_schema.sql`
2. `supabase/scorecaster_auth_cloud.sql`
3. `supabase/scorecaster_paper_risk_limits.sql`
4. `supabase/scorecaster_api_rate_limits.sql`
5. `supabase/scorecaster_watchlist_alerts.sql`
6. `supabase/scorecaster_alert_inbox.sql`
7. `supabase/scorecaster_notification_registry.sql`

The migrations add:

- profiles and authenticated paper history
- paper-bankroll settings
- user-specific verified watchlist rows
- user-specific deduplicated alert history with read and resolved state
- user-specific notification preferences
- an RLS-protected native device registry with one-owner token claims
- stable duplicate-safe client references
- indexes and bounded data constraints
- forced Row Level Security and user-specific policies
- paper stake, total exposure, league exposure, edge and confidence enforcement
- user-level transaction locking for concurrent exposure checks
- database-backed per-user API quotas
- unique per-user watchlist selections and bounded alert thresholds
- unique per-user Alert Inbox fingerprints
- server-computed notification token hashes

The paper-risk, watchlist, Alert Inbox and notification-registry migrations are idempotent. Run the paper-risk migration again after a release that changes its trigger definition.

## 3. Supabase Auth settings

Enable Email + Password authentication.

Set the production Site URL to:

```text
https://scorecaster.vercel.app
```

Add the production confirmation redirect:

```text
https://scorecaster.vercel.app/auth/confirm
```

For local development also add:

```text
http://localhost:3000/auth/confirm
```

The native app uses Supabase mobile sessions and must be tested with the `scorecaster://` application scheme before store release.

## 4. Deployment and native configuration

Configure the public Supabase connection and the required server-only integration settings in the deployment platform. Keep server-only values out of browser code, native application configuration and version control. Redeploy after changing deployment settings.

Native notification registration additionally requires the Expo application to be linked to the correct EAS project and rebuilt with the `expo-notifications` config plugin. Do not place a fabricated project ID in source control. Until the EAS project is linked, the app must show registration as unavailable rather than generating a token.

Notification Preferences & Device Registry V1 stores consent and device registration only. A background delivery worker is a separate release gate and is not active in V1.

## 5. Test the full path

1. Open `/production-status` and confirm required integrations are reported correctly.
2. Create account A and confirm its email when required.
3. Confirm `/profile` validates account A on the server.
4. Save account A's virtual bankroll and paper-risk settings.
5. Verify minimum edge, minimum confidence, single-stake, total-exposure and league-exposure rejections.
6. Trigger two simultaneous writes near an exposure boundary and confirm only the valid transaction succeeds.
7. Save a supported paper selection and confirm its event ID and model probability are retained.
8. Settle a completed supported H2H paper row and confirm minimal result metadata, paper profit and analytics.
9. Add optional closing odds and confirm CLV calculation.
10. Add a current verified selection to account A's Watchlist V2.
11. Confirm the stored event, selection, kickoff, odds and decision came from the server-confirmed Top Picks row.
12. Submit a fabricated event ID directly to `POST /api/cloud/watchlist` and confirm rejection.
13. Change watchlist thresholds and confirm invalid ranges are rejected.
14. Pause the item and confirm it emits no alerts.
15. Reactivate it and confirm a verified price, decision or kickoff change produces the expected alert.
16. Refresh repeatedly and confirm the Alert Inbox contains only one row per fingerprint.
17. Mark one alert read and confirm its read timestamp persists on the next refresh.
18. Remove the alert condition and confirm the inbox row becomes resolved rather than disappearing.
19. Recreate the condition and confirm the row becomes active and unread.
20. Change one notification preference and confirm all other values remain unchanged.
21. Disable one severity or event category and confirm matching active inbox rows resolve without deleting history.
22. On a physical native device, press the push opt-in button and confirm the operating-system permission prompt is shown before token registration.
23. Confirm denied permission or a missing EAS project ID creates no device row.
24. Register a device for account A and confirm API responses never contain the raw token or token hash.
25. Create account B and confirm B cannot read, update or delete A's paper rows, bankroll settings, watchlist rows, inbox rows, notification preferences or device rows.
26. Register the same physical device for account B and confirm its token association moves away from account A.
27. Remove the final device and confirm `push_enabled` becomes false.
28. Repeat protected paper, Agent, watchlist, Alert Inbox and notification flows with both web-cookie and mobile-bearer sessions.
29. Exceed protected endpoint quotas and confirm HTTP 429 plus `Retry-After`.
30. Export account A's data and confirm only A's records and non-secret device metadata are included.
31. Delete account A and confirm it can no longer authenticate and its notification, inbox and watchlist rows are removed.

## Routes

- `/login` — sign in and account creation
- `/auth/confirm` — email confirmation callback
- `/profile` — account, notification and privacy controls
- `/cloud-sync` — local-to-cloud paper migration
- `/watchlist` — verified watchlist and Alert Inbox
- `/api/cloud/bets` — authenticated paper-history API
- `/api/cloud/bets/settle` — authenticated paper-result check
- `/api/cloud/bankroll` — authenticated virtual-bankroll settings
- `/api/cloud/watchlist` — authenticated verified watchlist and inbox synchronization API
- `/api/cloud/alerts` — authenticated Alert Inbox read and acknowledgement API
- `/api/cloud/notifications` — authenticated notification-preference and native-device registry API
- `/api/intelligence` — authenticated and rate-limited manual sports-context API
- `/api/agent/portfolio` — authenticated Agent portfolio and Model Lab state
- `/api/agent/explain` — authenticated governed explanation
- `/api/account/export` — authenticated data export
- `/api/account` — account status and deletion
- `/api/health` — deployment and integration status

## Security model

Authorization, risk control and abuse protection are enforced through:

- validated user sessions
- server-side user validation for protected APIs
- forced Row Level Security using `auth.uid()`
- server and database paper-risk validation
- user-level transaction locking
- server re-resolution of watchlist selections from current Top Picks
- unique user/event/market/selection watchlist rows
- server-generated Alert Inbox content and unique user fingerprints
- explicit user filters on alert acknowledgement
- explicit native opt-in before requesting a push token
- database-side token hashing and one-user token ownership
- notification API responses that exclude tokens and token hashes
- atomic per-user request quotas
- exact-origin validation for cookie mutations
- bounded request content, numbers, strings and record counts
- server-only integration settings

The browser paper copy is not deleted automatically after sync during testing. Watchlist V2, Alert Inbox V1 and Notification Registry V1 are separate from the paper slip. Notification Registry V1 does not claim that a background push-delivery worker is active.
