# Watchlist & Alerts V2

Watchlist V2 tracks changes in verified near-term Scorecaster selections. It is separate from paper-bet tracking and never creates a stake, opens a bookmaker or places a wager.

## Trusted input flow

1. The client displays selections returned by the public Top Picks API.
2. When a signed-in user adds one, the client sends only the event ID, selection and supported sport.
3. The protected server endpoint loads current Top Picks again.
4. The server saves the row only when the event and selection still match current verified live-provider analysis.
5. Later refreshes compare the saved state with the current server-verified state.

The client cannot create an arbitrary watchlist fixture by submitting its own teams, odds, decision or kickoff.

## Stored data

Each user row stores only the information needed for comparison:

- event ID
- sport, league and market
- selection and match labels
- teams and scheduled kickoff
- odds and Scorecaster decision when added
- alert thresholds and active state
- a bounded technical snapshot with consensus probability, edge, confidence and trust score

No payment data, bookmaker credentials, location, contacts or unrestricted notes are stored.

## Alert types

Watchlist V2 can report:

- kickoff approaching the configured window
- Scorecaster decision changed
- price moved beyond the configured threshold
- current odds fell below the calculated PLAY price floor
- current matching market is unavailable
- the scheduled watch window has passed

Unavailable data remains unavailable. The engine does not substitute another fixture, bookmaker market, news claim or invented price.

## Pause behavior

A paused item remains in the user's watchlist but emits no alerts. The current comparison may still be displayed after a manual refresh so the user can inspect it before reactivating the item.

## Security

- Supabase RLS is enabled and forced on `watchlist_items`.
- Every policy compares `auth.uid()` with `user_id`.
- Anonymous access is revoked.
- API reads and writes require a validated user session.
- Cookie mutations require exact-origin validation.
- Mobile bearer sessions are supported through the shared authenticated API layer.
- Reads and writes use atomic per-user database quotas.
- Request bodies, strings, numbers and row counts are bounded.
- The server does not use a service-role key for normal watchlist operations.

## Current delivery mode

V2 refresh is user-triggered in web and mobile. The app does not claim background push delivery yet. A future push layer must use a separate device-token design, explicit opt-in, minimal payloads and platform permission testing.

## Activation

Run after the existing Scorecaster migrations:

```text
supabase/scorecaster_watchlist_alerts.sql
```

Then test with accounts A and B:

1. Add a verified selection as A.
2. Confirm A can read, pause, update and remove it.
3. Confirm B cannot read, update or remove A's row.
4. Attempt to submit a fabricated event ID and confirm rejection.
5. Change thresholds and confirm database constraints reject out-of-range direct writes.
6. Confirm a paused row emits no alerts.
7. Confirm missing provider data produces only an unavailable-data notice.
8. Repeat the flow through a native mobile bearer session.

## Product boundary

Watchlist V2 is sports information and paper-process support. It does not guarantee an outcome or profit and does not facilitate a real-money transaction.
