# Notification Preferences & Device Registry V1

Notification Preferences & Device Registry V1 creates an explicit opt-in foundation for future native push delivery.

It does not send notifications, run a background worker, place bets or move money.

## User flow

1. A signed-in user chooses notification categories in the web or native profile.
2. Native push registration begins only after the user presses the enable button.
3. The native application creates the Android notification channel when required.
4. The operating system permission prompt is requested.
5. Registration stops if permission is denied or the EAS project ID is not configured.
6. A valid Expo push token is sent through the authenticated Scorecaster API.
7. The server stores the device for the current user and marks push preference enabled.

No token is fabricated when the application is not correctly linked to an EAS project.

## Database model

`notification_preferences` stores user-selected in-app and future push categories:

- in-app inbox
- high, medium and informational alerts
- kickoff alerts
- decision-change alerts
- price alerts

`notification_devices` stores:

- Expo push token
- server-computed SHA-256 token hash
- iOS or Android platform
- optional app and build versions
- enabled state and timestamps

The raw token is required only as a future delivery address. It is never returned by the application API or account export.

## Token ownership

The `claim_notification_device` database function:

- requires `auth.uid()`
- validates the token and platform
- computes the token hash inside PostgreSQL
- removes the same token from another user
- assigns the token to the current user
- re-enables an existing registration safely

This prevents a shared or reinstalled device from remaining associated with an old Scorecaster account.

## Security model

Both notification tables use enabled and forced Row Level Security. Anonymous access is revoked.

The application API adds:

- authenticated cookie or bearer sessions
- exact-origin validation for cookie mutations
- database-backed per-user quotas
- bounded JSON bodies and text lengths
- platform and Expo token validation
- explicit user filters on device deletion
- device metadata responses that exclude the token and token hash

The client cannot set `push_enabled` directly. It becomes true only after a device claim succeeds and becomes false when the final enabled device is removed.

## Alert Inbox integration

Watchlist refresh loads notification preferences before Alert Inbox synchronization.

Disabled severities or event categories are omitted from the active alert set. Existing history is not destroyed; it becomes resolved through normal inbox synchronization and may reopen later if the category is enabled and the condition reappears.

## Privacy controls

- Web and native users can change notification categories.
- Native users can remove the current device registration.
- Native sign-out attempts to unregister the current device before ending the session.
- Account export includes preferences and non-secret device metadata.
- Account export excludes raw delivery tokens and token hashes.
- Permanent account deletion removes devices and preferences before the account.

## Activation

Run the Supabase migrations in this order:

```text
supabase/scorecaster_schema.sql
supabase/scorecaster_auth_cloud.sql
supabase/scorecaster_paper_risk_limits.sql
supabase/scorecaster_api_rate_limits.sql
supabase/scorecaster_watchlist_alerts.sql
supabase/scorecaster_alert_inbox.sql
supabase/scorecaster_notification_registry.sql
```

For native registration, the Expo application must also be linked to the correct EAS project and rebuilt with the `expo-notifications` config plugin.

## Release verification

Before enabling any delivery worker:

1. Register a physical iOS device for user A.
2. Confirm the API response never includes the raw token or token hash.
3. Confirm user B cannot read or remove user A's device row.
4. Register the same device for user B and confirm ownership moves to B.
5. Confirm changing one preference preserves all other preferences.
6. Confirm a disabled Alert Inbox category resolves matching active alerts without deleting history.
7. Remove the final device and confirm `push_enabled` becomes false.
8. Sign out on native and confirm the current device registration is removed first.
9. Export the account and confirm only device metadata is included.
10. Delete the account and confirm all devices and preferences are removed.

## Delivery worker remains blocked

Background delivery must be a separate reviewed release. It requires at minimum:

- a server-only scheduled worker
- Alert Inbox delivery deduplication
- provider ticket and receipt tracking
- retry limits and rate control
- removal or disabling of invalid device tokens
- monitoring without notification content in sensitive logs
- consent and store-metadata review

Until those controls are implemented and tested, `/api/health` must report delivery as disabled and the user interface must say that token registration is ready but background delivery is not active.
