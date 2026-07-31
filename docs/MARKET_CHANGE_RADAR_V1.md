# Market Change Radar V1

Market Change Radar V1 gives Scorecaster users a deterministic answer to one practical question: what changed since the previous check?

## User value

The radar compares the current governed `/api/top-picks` response with a baseline saved in the user's browser. It reports:

- PLAY, WATCH, CAUTION and SKIP decision-class changes
- decimal-odds movements
- edge movements
- expected-value movements
- confidence movements
- bookmaker-count changes
- new picks entering the current feed
- picks leaving the current feed

The route is available at `/changes` and is linked from the normal More tools menu.

## Safety boundary

The comparison layer is informational only.

It cannot:

- change market probability
- change model probability
- alter edge or EV
- promote WATCH, CAUTION or SKIP to PLAY
- change paper stakes
- execute bookmaker actions
- deposit or withdraw funds

A removed pick means only that the pick is not present in the current Top Picks response. It does not by itself prove that an event was cancelled or a market was closed.

## Meaningful-change thresholds

The default deterministic thresholds are:

```text
absolute decimal-odds movement >= 0.02
absolute edge movement >= 0.005
absolute EV movement >= 0.005
absolute confidence movement >= 0.03
```

Decision-class and bookmaker-count changes are always reported.

## Severity

- `critical`: a decision changes to or from PLAY, or a new PLAY enters the feed
- `high`: another decision-class change, a removed PLAY, or a large numerical movement
- `medium`: another meaningful numerical movement or a new non-PLAY pick
- `low`: a removed non-PLAY pick or a small source-count-only change

Severity changes display priority only. It does not override the governed decision.

## Storage

Snapshots are stored only in browser local storage under:

```text
scorecaster_market_change_snapshots_v1
```

The newest ten snapshots are retained. No Supabase migration or server-side account table is required.

## Implementation

- `lib/market-change-engine.js` normalizes picks, creates snapshots and performs deterministic comparison.
- `lib/market-snapshot-storage.js` manages local snapshot history.
- `app/changes/MarketChangesClient.jsx` renders the radar, filters and copyable report.
- `scripts/market-change-radar.test.mjs` validates identity stability, thresholds, decision changes, new and removed picks, route discoverability and safety language.
