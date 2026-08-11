# Scorecaster Advanced Signal Readiness V1

Advanced Signal Readiness V1 answers one question for each event:

> What is still missing before Scorecaster has a genuinely new independent shadow-model family?

It deliberately separates four stages that must not be conflated:

1. raw advanced analytics source
2. metric / data lineage
3. audited deterministic probability model output
4. chronological holdout and calibration evidence

A provider being configured does not mean a probability model exists. Raw sports analytics never become a Scorecaster probability automatically.

## Tracked independent signal families

V1 tracks three advanced families beyond the existing historical-results family:

- `expected-performance`
- `performance-statistics`
- `tracking`

Model Lineage Guard V1 remains authoritative for dependence-group derivation and model admission.

## Example target metrics

The target metrics are readiness anchors, not a claim that all are required for every future model.

### Ice hockey

Expected performance:
- xG
- post-shot xG
- goals saved above expected

Performance statistics:
- shots
- attempts
- special teams

Tracking:
- puck location
- skater location
- goalie lateral movement

### Soccer

Expected performance:
- xG
- post-shot xG
- xA

Performance statistics:
- shots
- possessions
- pressures

Tracking:
- player locations
- ball location
- team shape

### Basketball

Expected performance:
- expected points per shot
- shot quality
- lineup-adjusted impact

Performance statistics:
- pace
- offensive rating
- defensive rating

Tracking:
- player location
- defender distance
- spacing

### Baseball

Expected performance:
- xwOBA
- expected runs
- run expectancy

Performance statistics:
- lineup strength
- bullpen depth
- platoon profile

Tracking:
- pitch flight
- ball flight
- fielder location

Tennis and golf also have initial anchor profiles so the same readiness contract can expand across sports without inventing probabilities.

## Readiness states

### `provider-not-configured`

No external advanced analytics source is configured and no accepted model output exists.

### `provider-configured-model-missing`

An advanced raw-data acquisition endpoint exists, but there is no accepted deterministic probability model for this family.

This is the critical separation between **data** and **model**.

### `provider-configured-metric-gap`

An accepted model lineage exists but its declared metric lineage covers less than the readiness anchor threshold. V1 does not infer raw provider metric coverage when no accepted model lineage exists.

### `model-output-rejected`

A candidate advanced model reached Model Factory but failed lineage, chronology, determinism or another admission gate.

### `shadow-model-needs-holdout`

An audited deterministic model output exists and can participate in shadow research, but it does not yet have calibration-ready chronological holdout evidence.

### `review-ready-shadow`

At least one accepted model in the family has calibration-ready performance evidence. This is still only review-ready shadow status. It does not activate a production probability or decision.

## Raw analytics source

The existing optional `SPORTS_ANALYTICS_API_URL` configuration is treated only as a potential raw analytics acquisition source.

It is not treated as a model endpoint and cannot create a probability by itself.

The public readiness audit exposes only safe configuration metadata:

- configured yes/no
- source name
- transport mode

It does not expose the configured URL, API keys or authorization headers.

## Metric coverage

Metric coverage in V1 is calculated only from the lineage of an already accepted model output.

If no accepted model exists, metric coverage is `null` / unknown rather than guessed from provider configuration.

This prevents Scorecaster from claiming advanced-data coverage it has not actually audited.

## Event UI

The event data audit now includes an **Independent Signal Readiness** panel showing:

- raw advanced provider configuration
- model-present status per advanced family
- holdout readiness
- audited metric-lineage coverage
- next required action

The panel reuses the existing `/api/data-layer` response and makes no additional fetch or provider request.

## Safety contract

```text
rawAnalyticsAutomaticallyConvertedToProbability = false
providerConfiguredMeansModelReady = false
rawMetricCoverageInferredWithoutModelLineage = false
modelOutputWithoutLineageAccepted = false
modelOutputWithoutChronologyAccepted = false
modelOutputWithoutHoldoutGetsPerformanceWeight = false
automaticPromotionAllowed = false
productionProbabilityChanged = false
productionDecisionChanged = false
paperOnly = true
```

## Recommended next real-data sequence

For any future advanced provider:

```text
provider configured
  -> raw metrics captured with source/timestamps
  -> deterministic model built separately
  -> probability emitted with explicit signal lineage
  -> Model Lineage Guard
  -> Model Factory
  -> shadow Ensemble
  -> chronological holdout
  -> calibration / drift review
  -> human release review
```

Skipping directly from raw data to a production probability is intentionally unsupported.
