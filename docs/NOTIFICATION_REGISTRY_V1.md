# Notification Preferences & Device Registry V1

Notification Preferences & Device Registry V1 creates explicit opt-in device registration and category controls for native push delivery. Device registration alone does not send notifications; Notification Delivery V1 must also be migrated, configured and scheduled.

## User flow

1. A signed-in user chooses notification categories in the web or native profile.
2. Native registration begins only after the user presses the enable button.
3. Android creates the notification channel when required.
4. The operating system permission prompt is requested.
5. Registration stops if permission is denied or the EAS project ID is not configured.
6. A valid Expo push token is sent through the authenticated Scorecaster API.
7. The server stores the device for the current user and marks push preference enabled.
8. The API reports whether the separately protected delivery worker is active.

No token is fabricated when the application is not linked to a real EAS project.

## Data and ownership

`notification_preferences` stores in-app, severity, kickoff, decision-change and price categories.

`notification_devices` stores the Expo push token, server-computed SHA-256 token hash, platform, optional app/build versions, enabled state and timestamps. The token is a delivery address. It is never returned by the application API or account export.

The `claim_notification_device` function requires `auth.uid()`, validates input, computes the hash inside PostgreSQL, removes the same token from another user and assigns it to the current user. Direct authenticated insert and update access to the device table is revoked.

## Security model

Both notification tables use enabled and forced Row Level Security. Anonymous access is revoked. Protected APIs add authenticated cookie or bearer sessions, exact-origin validation for cookie mutations, database-backed quotas, bounded bodies and explicit user filters.

The client cannot set `push_enabled` directly. Database triggers also prevent push-enabled state without an active device and turn it off after the final device is removed or disabled.

Notification Delivery V1 uses a separate service-role-only queue, a bounded lease claim and a secret-protected internal route. The public Notification Registry API returns only safe device metadata and configuration state.

## Alert Inbox integration

Watchlist refresh loads notification preferences before Alert Inbox synchronization. Disabled severities or event categories are omitted from the active alert set. Existing history becomes resolved instead of being deleted and may reopen if the category is enabled and the condition returns.

The delivery worker considers only active, unread and non-dismissed Alert Inbox rows. Reading or dismissing an alert before the worker claims it prevents a stale notification.

## Privacy controls

- Web and native users can change categories.
- Native users can remove the current device.
- Native sign-out attempts to unregister the current device first.
- Export includes preferences, non-secret device metadata and delivery audit metadata.
- Export excludes raw tokens and token hashes.
- Permanent account deletion removes delivery rows, devices and preferences.

## Activation

Run migrations in order:

```text
supabase/scorecaster_schema.sql
supabase/scorecaster_auth_cloud.sql
supabase/scorecaster_paper_risk_limits.sql
supabase/scorecaster_api_rate_limits.sql
supabase/scorecaster_watchlist_alerts.sql
supabase/scorecaster_alert_inbox.sql
supabase/scorecaster_notification_registry.sql
supabase/scorecaster_notification_delivery.sql
```

Native registration also requires the Expo app to be linked to the correct EAS project and rebuilt with the `expo-notifications` plugin.

Delivery additionally requires the production environment and exactly one protected scheduler described in `docs/NOTIFICATION_DELIVERY_V1.md`.

## Release verification

1. Register a physical device for user A.
2. Confirm responses never include token or token hash.
3. Confirm user B cannot read or remove A's device row.
4. Register the same device for B and confirm ownership moves to B.
5. Confirm partial preference updates preserve other values.
6. Confirm disabled categories resolve matching active inbox rows without deleting history.
7. Remove the final device and confirm push becomes disabled.
8. Sign out natively and confirm device removal runs first.
9. Export the account and confirm only metadata is included.
10. Delete the account and confirm deliveries, devices and preferences are gone.
11. With delivery disabled, confirm the worker returns a safe skipped response.
12. With delivery enabled, confirm ticket and receipt metadata are stored without tokens.
