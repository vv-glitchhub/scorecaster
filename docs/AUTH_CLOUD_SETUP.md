# Scorecaster Auth + Cloud Sync Setup

This guide enables user accounts, protected paper history, personal paper-risk limits, verified watchlists, the in-app Notification Center and optional paper-result checking.

## 1. Supabase project

Create or open the Supabase project used by Scorecaster and configure the public project connection values in the deployment environment.

## 2. Database schema and security

Open the Supabase SQL editor and run the files in this order:

1. `supabase/scorecaster_schema.sql`
2. `supabase/scorecaster_auth_cloud.sql`
3. `supabase/scorecaster_paper_risk_limits.sql`
4. `supabase/scorecaster_api_rate_limits.sql`
5. `supabase/scorecaster_watchlist_alerts.sql`
6. `supabase/scorecaster_notification_center.sql`

The migrations add:

- profiles and authenticated paper history
- paper-bankroll settings
- user-specific verified watchlist rows
- user-specific Notification Center settings and structured notification rows
- stable duplicate-safe client references
- indexes and bounded data constraints
- forced Row Level Security and user-specific policies
- paper stake, total exposure, league exposure, edge and confidence enforcement
- user-level transaction locking for concurrent exposure checks
- database-backed per-user API quotas
- unique per-user watchlist selections and bounded alert thresholds
- unique per-user notification source keys, read state and dismissal state

The paper-risk, watchlist and Notification Center migrations are idempotent. Run the paper-risk migration again after a release that changes its trigger definition.

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

For the native app allow the Scorecaster callback pattern and test it on signed devices before store release:

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
16. Open `/notifications` and run user-triggered synchronization.
17. Confirm only structured notifications derived from current server alerts are stored; clients cannot supply titles or messages.
18. Repeat the same sync without a material alert-state change and confirm no duplicate notification row is created.
19. Change minimum severity and category preferences and confirm filtered alert types are not inserted.
20. Mark one notification read, mark all read, dismiss one and confirm the state persists across web and mobile sessions.
21. Create account B.
22. Confirm B cannot read, update or dismiss A's notifications, notification settings, paper rows, bankroll settings or watchlist rows.
23. Repeat protected paper, Agent, watchlist and Notification Center flows with both web-cookie and mobile-bearer sessions.
24. Exceed protected endpoint quotas and confirm HTTP 429 plus `Retry-After`.
25. Export account A's data and confirm only A's paper, watchlist, Notification Center and settings records are included.
26. Delete account A and confirm the notification rows, settings and authentication account are removed.

## Routes

- `/login` — sign in and account creation
- `/auth/confirm` — email confirmation callback
- `/profile` — account and privacy controls
- `/cloud-sync` — local-to-cloud paper migration
- `/watchlist` — verified watchlist and current alerts
- `/notifications` — persisted user-specific in-app notification inbox
- `/api/cloud/bets` — authenticated paper-history API
- `/api/cloud/bets/settle` — authenticated paper-result check
- `/api/cloud/bankroll` — authenticated virtual-bankroll settings
- `/api/cloud/watchlist` — authenticated verified watchlist API
- `/api/cloud/notifications` — authenticated Notification Center read, sync, preferences, read state and dismissal API
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
- Notification Center generation from server-owned structured alert objects only
- unique per-user notification source keys with bounded state buckets
- notification settings, reads and dismissals scoped to the authenticated user
- atomic per-user request quotas
- exact-origin validation for cookie mutations
- bounded request content, numbers, strings and record counts
- server-only integration settings

The browser paper copy is not deleted automatically after sync during testing. Watchlist V2 is separate from the paper slip. Notification Center V1 is an in-app, user-triggered inbox and does not register push tokens or claim background delivery.
