# Scorecaster Auth + Cloud Sync Setup

This guide enables user accounts, protected paper history, personal paper-risk limits, verified watchlists, deduplicated Alert Inbox history and preferences, and optional paper-result checking.

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
7. `supabase/scorecaster_alert_inbox_v2.sql`

The migrations add:

- profiles and authenticated paper history
- paper-bankroll settings
- user-specific verified watchlist rows
- user-specific deduplicated alert history with read, resolved and dismissed state
- user-specific Alert Inbox severity and category preferences
- stable duplicate-safe client references
- indexes and bounded data constraints
- forced Row Level Security and user-specific policies
- paper stake, total exposure, league exposure, edge and confidence enforcement
- user-level transaction locking for concurrent exposure checks
- database-backed per-user API quotas
- unique per-user watchlist selections and bounded alert thresholds
- unique per-user Alert Inbox fingerprints

The paper-risk, watchlist and Alert Inbox migrations are idempotent. Run the paper-risk migration again after a release that changes its trigger definition.

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

Allow the native callback pattern and test it on signed devices before store release:

```text
scorecaster://**
```

## 4. Deployment configuration

Configure the public Supabase connection and the required server-only integration settings in the deployment platform. Keep server-only values out of browser code, native application configuration and version control. Redeploy after changing deployment settings.

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
17. Mark one alert read, unread and read again across web and native clients.
18. Remove the alert condition and confirm the inbox row becomes resolved rather than disappearing.
19. Recreate the condition and confirm the row becomes active and unread.
20. Set minimum severity to high and confirm lower-severity conditions are filtered on the next refresh.
21. Disable one alert category and confirm only that category is filtered.
22. Dismiss a continuing condition and confirm the same fingerprint remains hidden after refresh.
23. Resolve and recreate the dismissed condition and confirm it reopens visible and unread.
24. Create account B.
25. Confirm B cannot read, update or delete A's paper rows, bankroll settings, watchlist rows, inbox rows or inbox settings.
26. Repeat protected paper, Agent, watchlist and Alert Inbox flows with both web-cookie and mobile-bearer sessions.
27. Exceed protected endpoint quotas and confirm HTTP 429 plus `Retry-After`.
28. Export account A's data and confirm only A's records, settings and dismissal state are included.
29. Delete account A and confirm it can no longer authenticate and its settings and inbox rows are removed.

## Routes

- `/login` — sign in and account creation
- `/auth/confirm` — email confirmation callback
- `/profile` — account and privacy controls
- `/cloud-sync` — local-to-cloud paper migration
- `/watchlist` — verified watchlist and compact inbox history
- `/alerts` — Alert Inbox V2 history, filters and preferences
- `/api/cloud/bets` — authenticated paper-history API
- `/api/cloud/bets/settle` — authenticated paper-result check
- `/api/cloud/bankroll` — authenticated virtual-bankroll settings
- `/api/cloud/watchlist` — authenticated verified watchlist and inbox synchronization API
- `/api/cloud/alerts` — authenticated Alert Inbox read, preferences, read-state and dismissal API
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
- user-specific inbox settings and dismissal state
- explicit authenticated-user filters on every inbox mutation
- atomic per-user request quotas
- exact-origin validation for cookie mutations
- bounded request content, numbers, strings and record counts
- server-only integration settings

The browser paper copy is not deleted automatically after sync during testing. Watchlist V2 and Alert Inbox V2 are separate from the paper slip and store only server-verified comparison and alert data. Alert Inbox V2 remains in-app and user-refreshed; it does not claim background delivery.
