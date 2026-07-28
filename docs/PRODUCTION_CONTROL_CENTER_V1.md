# Scorecaster Production Control Center V1

Production Control Center combines the production checks that previously lived across Collector, Intelligence, Sports Analytics and release documentation.

## Included capabilities

- publishable-only Collector readiness
- Daily Top 3 paper analysis
- Brier score, log loss and calibration error
- calibration buckets
- opening-to-closing odds history and price CLV
- market, Scorecaster-model and simulation coverage grades
- explicit production blockers

## Ready gate

The control center remains `blocked` until all of the following are true:

- publishable Collector observations exist
- the newest observation is no more than two hours old
- at least three events are represented
- at least one approved source is active
- at least 300 settled calibration samples are available
- closing-line history exists
- Collector health is healthy

This gate is intentionally conservative. It is not a promise of profitability.

## Daily Top 3

Daily Top 3 ranks up to three events using:

- source trust
- observation confidence
- freshness
- record coverage
- source diversity
- model-versus-market edge

Allowed decisions are only `WATCH`, `CAUTION` and `SKIP`. Production Control Center never emits `PLAY`.

## Calibration

Settled event observations are grouped into probability buckets. The API reports:

- Brier score
- logarithmic loss
- weighted calibration error
- sample count
- A–D grade

A grade cannot be better than D below 100 settled samples. Production readiness still requires at least 300 settled samples.

## Closing line

For each event with two or more `best_odds` observations, the first chronological price is treated as opening odds and the last chronological price as the latest closing-line candidate. The report does not use future information to alter a pregame decision.

## Endpoints

- `/production-control-center`
- `/api/production-control-center?hours=720`

Optional query parameters:

- `hours`: 24–8760
- `sport`: normalized sport key
- `limit`: 100–10000

## Safety

- only rows with `publishable = true` are queried
- research data is excluded
- no automatic betting
- no money movement
- no production probability mutation
- no automatic PLAY upgrade
- paper-only analysis

## Activation

No new database migration is required. Collector V1 must be activated and collecting publishable observations. The control center exposes missing activation as a blocker instead of inventing fallback data.
