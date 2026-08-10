# Scorecaster Current Intelligence Surfaces V1

## Goal

Keep public paper-analysis surfaces aligned with the current Unified Data pipeline instead of legacy snapshots.

## Value observations

`/api/value-bets` is now a compatibility surface over `unified_data_snapshots`.

It:

- accepts only future events;
- requires the newest capture batch to be at most 30 minutes old;
- uses a coherent 15-minute capture window around the freshest batch;
- keeps only the latest row per event + selection;
- derives the compatibility value multiple as `decimal_odds × market_probability`;
- returns only positive-value observations (`value_multiple > 1`);
- exposes paper-only metadata and never falls back to the legacy `value_bets` table.

If current capture data is stale, the endpoint returns an empty list with `freshness: "stale"`. Showing no observation is preferred to showing an old one.

## Product boundary

This change does not create a new model, alter Unified Data probabilities, loosen any decision gate, change stakes, or add real-money execution. It only makes a legacy read surface use the same current evidence store as the rest of Scorecaster.
