# Operations Dashboard V1

Operations Dashboard V1 is the authenticated operating console for Scorecaster's background services.

## Scope

The console combines the signed-in user's:

- Watchlist Monitor state
- Settlement Monitor state
- notification delivery queue state
- active Watchlist item count
- open paper-pick count
- unread active Alert Inbox count
- active push-device count
- Market Timeline activity from the last 24 hours
- migration and safe server-configuration readiness

It does not expose global user data or provide a privileged mutation surface.

## Routes

```text
GET /api/operations
/operations
```

`GET /api/operations` requires the normal Scorecaster browser-cookie or mobile-bearer session. It is rate limited and explicitly filters every user-owned table with the authenticated user ID in addition to Supabase Row Level Security.

## Worker states

Scheduled workers can report:

- `migration_required`
- `disabled`
- `waiting`
- `running`
- `healthy`
- `stale`
- `error`

Notification Delivery can additionally report:

- `working`
- `attention`

A scheduled worker becomes stale after four expected intervals without a completed run. This is a diagnostic signal, not proof that the upstream data provider is unavailable.

## Security boundary

The API returns only safe configuration booleans such as:

- worker enable flag present
- service-role integration configured
- score provider configured
- cron secret meets the minimum length requirement
- optional Expo access token configured

The response never includes:

- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- `ODDS_API_KEY`
- Expo push tokens
- push-token hashes
- rows belonging to another user

The endpoint uses the authenticated Supabase client rather than the service-role client.

## Delivery semantics

`provider_accepted` means the push provider accepted the receipt. It does not prove the person saw the notification.

Failed and retrying deliveries remain visible as counts for the signed-in user. The dashboard does not retry or delete them; worker mutations stay behind the existing secret-protected internal endpoints.

## Launch checklist

The console checks:

- Watchlist Monitor migration
- Settlement Monitor migration
- Notification Registry migration
- Notification Delivery migration
- Watchlist worker server configuration and enable flag
- Settlement worker server configuration and enable flag
- Notification Delivery server configuration and enable flag
- at least one physical push device registration

A missing physical device does not block web analysis or in-app alerts. It blocks only real-device push validation.

## Product boundary

Scorecaster remains a sports-analysis, alerting and virtual paper-tracking product. Operations Dashboard V1 cannot place bets, move money, access bookmaker accounts or change model probabilities.

## Validation

Run:

```bash
npm run test:operations
npm test
npm run build
```

CI also runs CodeQL and the existing mobile checks when mobile paths change.
