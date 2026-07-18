# Notification Delivery V1

Notification Delivery V1 sends opted-in Alert Inbox events to registered native Expo devices. The implementation is fail-closed and remains inactive until database, server and scheduler configuration are all completed.

## Safety boundary

Delivery requires all of the following server-side values:

```text
SCORECASTER_NOTIFICATION_DELIVERY_ENABLED=true
CRON_SECRET=<random value, at least 16 characters>
NEXT_PUBLIC_SUPABASE_URL=<project URL>
SUPABASE_SERVICE_ROLE_KEY=<server-only service role key>
```

`EXPO_ACCESS_TOKEN` is optional and is sent only as a server-side Authorization header when configured. None of these values are returned by application APIs.

The internal route is:

```text
GET /api/internal/notification-delivery
Authorization: Bearer <CRON_SECRET>
```

The route returns 401 for a mismatched secret, 503 when the secret or admin database access is missing, and a safe skipped response when the enable flag is false.

## Queue and deduplication

Run `supabase/scorecaster_notification_delivery.sql` after Notification Registry and Alert Inbox migrations.

The migration adds:

- one delivery row per `alert_id,device_id`
- user-isolated delivery metadata
- bounded statuses and five maximum attempts
- a five-minute worker lease
- an atomic `FOR UPDATE SKIP LOCKED` claim function
- user read-only RLS access; only the service role can claim or modify delivery work

Raw Expo tokens remain only in `notification_devices`. Delivery rows store device IDs, ticket IDs, receipt state and bounded errors, never the token or token hash.

## Delivery cycle

Each cycle performs three bounded operations:

1. Checks eligible Expo receipts that are at least 15 minutes old.
2. Queues active, unread and non-dismissed Alert Inbox rows for users whose push preference and category are enabled.
3. Claims and sends at most 100 device messages.

The worker requests at most 1,000 receipts per cycle. Temporary HTTP, network and `MessageRateExceeded` failures use bounded exponential retry. `DeviceNotRegistered` disables the device, which also turns off the user's push preference when it was the final enabled device.

A successful Expo receipt means the underlying Apple or Google push service accepted the notification. It is not presented as proof that the person saw it.

## Scheduler options

Scorecaster does not add a high-frequency Vercel cron entry because Vercel Hobby deployments reject schedules that run more than once per day.

The repository includes `.github/workflows/notification-delivery.yml`, which runs every 15 minutes only after all of these GitHub settings are created:

```text
Repository variable:
SCORECASTER_NOTIFICATION_DELIVERY_ENABLED=true

Repository secrets:
SCORECASTER_NOTIFICATION_DELIVERY_URL=https://<production-host>
SCORECASTER_CRON_SECRET=<same value as production CRON_SECRET>
```

The production deployment must separately set `SCORECASTER_NOTIFICATION_DELIVERY_ENABLED=true`. Leaving either side disabled keeps delivery off.

A Vercel Pro cron or another HTTPS scheduler may call the same route instead. Do not enable two schedulers at the same time unless operational monitoring confirms the extra invocation load is desired; database claims prevent duplicate sends, but unnecessary calls still consume resources.

## Release procedure

1. Apply `scorecaster_notification_delivery.sql`.
2. Confirm Notification Registry and Alert Inbox migrations are active.
3. Configure a physical iOS or Android device and verify its Expo token registration.
4. Set the production server variables, initially leaving the delivery enable flag false.
5. Configure exactly one scheduler and run a manual workflow dispatch.
6. Inspect safe result counts and database delivery metadata.
7. Enable delivery on both the production server and scheduler.
8. Verify a ticket is stored, then verify its receipt on a later cycle.
9. Test device removal and `DeviceNotRegistered` cleanup.
10. Review App Store and Play Store notification disclosures before public release.

## Validation

```bash
npm run test:notification-registry
npm run test:notification-delivery
npm test
npm run build
```
