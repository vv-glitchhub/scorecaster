# Advanced Model Holdout V1

Version: `scorecaster-advanced-model-holdout-v1`

## Goal

Evaluate advanced shadow models from immutable pregame predictions instead of reconstructing predictions after outcomes are known.

## Prediction ledger

The existing `sports_analytics_snapshots` capture history is reused. Each capture bucket may store a compact `raw_summary.shadowModels` record containing:

- model ID and version
- full event probability distribution
- generated time and prediction horizon
- input snapshot hash
- home/away teams
- projected goals
- audited providers and metrics
- paper-only and production-unchanged flags

No new database table is required.

The sports analytics worker can build the event-level distribution directly from the fresh external advanced observations in the same capture. This means holdout capture does not depend on which betting market happened to be the visible selection.

## Evaluation rule

For each event + model version:

1. discard snapshots captured after event start
2. require a pregame prediction horizon
3. require an input snapshot hash
4. choose the latest remaining pregame capture
5. join a settled result only after the event
6. compute Brier score, log loss and calibration gap

Soccer uses the full home/draw/away distribution. NHL uses the home H2H probability against the final winner.

## Sample gates

- below 30 settled predictions: `insufficient`
- 30–99: `research`
- 100+: `review-ready`

`review-ready` is not the same as production-ready.

The holdout evaluator deliberately emits no `performanceWeight` and no `weightSource`. A weight must come from a separately reviewed performance-weight policy and then pass `model-performance-evidence-v1`.

## Advanced Model Input Readiness V1

The holdout now separates two questions that must not be conflated:

1. **Can an advanced model produce an immutable pregame prediction?**
2. **If it can, has enough settled holdout evidence accumulated to compare it with the market?**

Every Sports Analytics capture stores a sanitized `raw_summary.advancedModelReadiness` record for the event's applicable advanced model even when `shadowModels` is empty. The readiness record can retain only safe, bounded evidence such as:

- model ID/version and canonical sport
- `ready`, `blocked` or `not-applicable` state
- fixed missing-input blocker codes
- safe external-provider mode, source label and observation count
- sanitized metric/provider lineage
- whether the event can enter immutable holdout collection

It never retains raw provider error messages, credentials, API keys or market pricing as an independent model input.

For NHL, typical readiness blockers include missing team `xGF60` / `xGA60`, missing confirmed starting-goalie `GSAx60`, or an unconfigured/degraded independent Sports Analytics provider. Missing optional post-shot xG remains explicit and is not converted to zero.

The holdout service aggregates the latest readiness state per event + model version. Model Lab therefore shows why holdout collection has not started instead of presenting an unexplained zero sample.

Readiness is observational only. It cannot change the production probability, upgrade a production decision, generate a performance weight, promote a challenger model or place a real-money bet.

## Safety

- post-start prediction accepted: false
- input snapshot hash required: true
- outcomes are used only for evaluation after prediction capture
- no automatic promotion
- no production probability change
- no production decision change
- paper-only

## API

`GET /api/model-holdout?days=90`

The endpoint reads stored shadow snapshots, fetches recent completed results through the existing cached results provider, and returns sanitized aggregate evidence. Supported window: 7–180 days.

The `collection.advancedModelReadiness` section is available even before any ready shadow prediction exists, so missing advanced inputs can be diagnosed without inventing a holdout result.
