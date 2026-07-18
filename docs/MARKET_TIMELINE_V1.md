# Market Timeline V1

## Purpose

Market Timeline V1 stores a descriptive history of the verified available price for a selection that the authenticated user already owns in the Scorecaster watchlist.

It can show:

- initial and current decimal odds
- minimum and maximum observed odds
- implied-probability change
- PLAY / WATCH / CAUTION / SKIP changes
- bookmaker-label changes
- capture timestamps

It does not:

- create a paper stake
- place a wager
- open a bookmaker
- infer sharp money or inside information
- predict the event outcome
- change the market probability, edge, EV or Agent decision
- capture prices in the background

## Database activation

Run after the existing auth, paper-risk, quota, watchlist and Alert Inbox migrations:

```text
supabase/scorecaster_schema.sql
supabase/scorecaster_auth_cloud.sql
supabase/scorecaster_paper_risk_limits.sql
supabase/scorecaster_api_rate_limits.sql
supabase/scorecaster_watchlist_alerts.sql
supabase/scorecaster_alert_inbox.sql
supabase/scorecaster_market_timeline.sql
```

The migration creates `market_timeline_snapshots` with:

- a required user ID
- a required owned watchlist reference
- bounded event, sport, market and selection identifiers
- decimal odds and decision constraints
- optional bounded market metrics
- capture and creation timestamps
- indexes for user/event/selection and watchlist/time
- enabled and forced Row Level Security
- an `auth.uid() = user_id` policy
- no anonymous table access

Deleting a watchlist item cascades its timeline points. Account deletion also explicitly removes the table when present.

## API

### Read timeline

```text
GET /api/cloud/market-timeline?eventId=<id>&selection=<selection>
```

The route:

1. authenticates the caller
2. applies a per-user read quota
3. requires an owned watchlist row with the same event and selection
4. reads only rows where `user_id` equals the authenticated user
5. returns at most 200 chronological points

When the migration is not active, the route can still show the original watchlist price as a single non-persisted point and returns `available: false`.

### Capture current price

```text
POST /api/cloud/market-timeline
Content-Type: application/json

{
  "eventId": "...",
  "selection": "...",
  "sport": "..."
}
```

The client does not submit odds, probability, edge, EV, decision or bookmaker data.

The server:

1. validates mutation origin
2. authenticates and rate-limits the user
3. verifies the sport against Scorecaster's allowlist
4. requires the matching owned watchlist row
5. reloads current Top Picks on the server
6. matches the same event and selection
7. derives the new point from that server response
8. creates the original watchlist point on first capture
9. suppresses unchanged duplicates unless the last point is at least 15 minutes old

## Descriptive engine

`lib/market-timeline.mjs` sorts and bounds points, then calculates descriptive statistics.

Every timeline response includes:

```text
outcomeInference: false
sharpMoneyInference: false
```

A shortened price means only that the recorded decimal odds decreased. A lengthened price means only that the odds increased. The application must not label either movement as professional money, an injury leak, certain value or an outcome signal without a separate verified source.

## Web and mobile

Web:

```text
/market-timeline
```

The page loads the user's watchlist, selects a watched item, reads its timeline and provides an explicit capture button.

Native mobile displays the same timeline inside Event Detail. Opening a selection that is not on the watchlist may show no timeline. The user must add it to the watchlist before capture.

## Privacy, export and deletion

Timeline points are account data and are:

- isolated by forced RLS
- included in `/api/account/export`
- deleted when the watchlist row is deleted
- deleted during full account deletion

The snapshots contain public sports-market observations and technical timestamps. They do not contain payment data, bank details, bookmaker credentials, contacts or precise location.

## Required verification

Run:

```bash
npm run test:market-timeline
npm test
npm run build
cd mobile && npm run release:audit
npx expo install --check
npm run typecheck
```

Manual two-user test:

1. Create accounts A and B.
2. Add separate watchlist items.
3. Capture timeline points for A.
4. Confirm B cannot read, create or delete A's points through SQL, REST or modified client requests.
5. Delete A's watchlist item and confirm its points are removed.
6. Export A and confirm only A's points are present.
7. Delete A's account and confirm no A rows remain.

Market Timeline is not operational in production until the migration and these isolation checks pass.
