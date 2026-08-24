# Auto-Watch Recommendations V1

Auto-Watch Recommendations turns Scorecaster's paper-only Recommendation Center into an opt-in server-monitored Top 1–3 watch flow. It reuses the existing verified watchlist, Watchlist Monitor, Alert Inbox and notification delivery pipeline. It does not create a parallel alert system.

## User flow

1. The user signs in and enables Auto-Watch for Top 1, Top 2 or Top 3.
2. The authenticated API saves bounded preferences through an `auth.uid()`-scoped RPC.
3. The current `/api/recommendations?limit=3` feed is synchronized immediately.
4. PLAY and CAUTION recommendations can be watched. SKIP recommendations are never auto-added.
5. Every 15 minutes the existing protected Watchlist Monitor first reconciles Auto-Watch rows, then runs normal price/decision/evidence alert detection.
6. Material changes are persisted in the existing Alert Inbox and surfaced by the web and native header alert badges.

## Ownership boundary

Auto-Watch owns only `watchlist_items` rows whose `raw_pick.source` equals:

`scorecaster-auto-watch-recommendations-v1`

A manually added watchlist row always wins. If the desired recommendation already exists manually, Auto-Watch records it as `coveredByManual` and does not overwrite, replace or delete that row.

When the recommendation ranking rotates, only stale Auto-Watch-owned rows are removed. Existing retained Auto-Watch rows are not rewritten every cycle, preserving the original `added_odds` and `added_decision` baseline used by the alert engine.

## Fail-closed behavior

- Empty or unavailable recommendation feed: current Auto-Watch rows are retained rather than deleted.
- Background Auto-Watch failure: normal Watchlist Monitor processing still runs.
- Concurrent workers: database claims use `FOR UPDATE SKIP LOCKED` and a bounded lease.
- Disabled Auto-Watch: only Auto-Watch-owned rows are removed.
- Missing database registry: the web API reports the feature unavailable rather than inventing state.
- No verified evidence: a recommendation remains CAUTION when the production decision says CAUTION. Auto-Watch never upgrades it.

## Database and permissions

Table: `public.auto_watch_recommendation_preferences`

Important controls:

- RLS enabled and forced.
- Authenticated users can SELECT only their own row.
- Browser clients do not get direct INSERT/UPDATE/DELETE privileges.
- Preference changes go through `set_auto_watch_recommendation_preferences`, which validates `auth.uid()` and bounded values.
- Worker claim/completion RPCs are executable only by `service_role`.
- Claims are limited to 20 users per worker execution.
- Lease: 10 minutes.
- Normal cadence: 15 minutes.
- Error retry cadence: 5 minutes.

## Safety boundary

Auto-Watch is monitoring automation, not betting automation.

It may:
- add/remove Auto-Watch-owned watchlist rows;
- retain recommendation provenance;
- trigger the existing server-side alert analysis;
- surface CAUTION → PLAY, PLAY revoked, evidence blockers and material price changes when the existing decision engine produces them.

It must not:
- create a stake or paper bet automatically;
- modify model probability, edge or EV;
- upgrade CAUTION to PLAY itself;
- access bookmaker accounts;
- transfer funds;
- execute a real-money bet.

Every Auto-Watch row carries `paperOnly: true` and `realMoneyActionAvailable: false` provenance.

## Surfaces

Web:
- Today: compact Auto-Watch control.
- Recommendation Center: compact Auto-Watch control.
- `/auto-watch`: full settings/status surface.
- Global More menu: Recommendation Center + Auto-Watch.
- Header Alert Bell: unread count and highest-priority active alert.

Native mobile:
- More → Auto-Watch Top 1–3.
- Recommendation Top 3 with score, edge, EV, evidence readiness and next gate.
- Native header unread-alert badge opens the existing watchlist/alerts view.

## Privacy

The preference registry is user-scoped and is included in Scorecaster account export. Auto-Watch provenance is present in exported watchlist `raw_pick`. Account deletion explicitly removes the preference row in addition to the auth-user cascade.

## Regression coverage

- `scripts/auto-watch-recommendations.test.mjs`
- `scripts/auto-watch-privacy-ui.test.mjs`
- `scripts/mobile-auto-watch.test.mjs`
- `scripts/header-alert-bell.test.mjs`

`test:watchlist-monitor` runs the Auto-Watch engine/privacy tests in normal web CI. The mobile CI workflow runs the native Auto-Watch regression test, Expo compatibility audit and TypeScript typecheck.
