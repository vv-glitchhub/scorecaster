# Scorecaster Model Lineage Guard V1

Model Lineage Guard V1 prevents model-count inflation and false independence claims before a shadow probability reaches Ensemble Engine V1.

## Why it exists

A model identifier or a self-declared `dependenceGroup` is not evidence that two models are independent. Two differently named models can still reuse the same underlying information. Scorecaster therefore derives the top-level dependence group from the model's declared signal lineage instead of trusting the model's own group label.

The guard is fail-closed and paper-only.

## Required external model lineage

An external independent model output must declare signal families. Provider and metric lineage are strongly encouraged and become part of the lineage fingerprint.

Example research challenger:

```json
{
  "modelId": "nhl-xg-shadow-v1",
  "modelVersion": "nhl-xg-shadow-v1",
  "probability": 0.62,
  "generatedAt": "2026-08-11T08:50:00.000Z",
  "signalFamilies": ["xg", "shot-quality"],
  "dataLineage": {
    "providers": ["advanced-hockey-provider"],
    "metrics": ["xg", "shot-quality", "goals-saved-above-expected"]
  },
  "audit": {
    "independentPredictiveModel": true,
    "deterministic": true,
    "chronologySafe": true,
    "source": "advanced-hockey-provider"
  }
}
```

Model Factory does not accept the model's own dependence group as authoritative. The example above is assigned to:

```text
icehockey_nhl-expected-performance-family
```

## Canonical signal families

### historical-results

Examples: completed results, form, rating/Elo, rest and schedule history.

Conservative group:

```text
<sportKey>-historical-results-family
```

Historical Rating and form/rest intentionally share this group.

### expected-performance

Examples: xG, shot quality, EPA, xwOBA, efficiency models, strokes gained and expected points.

Group:

```text
<sportKey>-expected-performance-family
```

This is the preferred next independent challenger family once a real advanced provider/model is available.

### performance-statistics

Examples: box-score data, team/player statistics, shots, attempts, pace and offensive/defensive ratings.

Group:

```text
<sportKey>-performance-statistics-family
```

### tracking

Examples: player/puck/ball location, trajectory, spacing, speed and movement data.

Group:

```text
<sportKey>-tracking-family
```

### context

Examples: injuries, availability, lineups, weather, travel and workload.

Context-only models cannot become an independent ensemble probability vote in V1. These signals belong in risk/context handling unless combined with a legitimate predictive core and validated separately.

### market

Examples: odds, bookmaker prices and market consensus.

Any model containing market-derived signal is rejected as an independent model. The no-vig market consensus remains the benchmark and cannot be repackaged as an independent Scorecaster prediction.

## Mixed lineage

Mixed models use conservative precedence to avoid double counting:

1. any historical-results input -> historical-results family
2. otherwise expected-performance -> expected-performance family
3. otherwise tracking -> tracking family
4. otherwise performance-statistics -> performance-statistics family
5. context-only -> rejected as independent

This intentionally understates independence rather than overstating it.

## Lineage fingerprint

The guard produces a SHA-256 fingerprint over:

- sport key
- canonical signal families
- providers
- metrics
- derived dependence group

The fingerprint is audit metadata, not a secret and not a model-quality score.

## Safety contract

```text
dependenceGroupSelfDeclared = false
marketDerivedIndependentModelAllowed = false
contextOnlyIndependentModelAllowed = false
missingSignalLineageAccepted = false
automaticPromotionAllowed = false
productionProbabilityChanged = false
productionDecisionChanged = false
paperOnly = true
```

A correct lineage declaration is only an admission prerequisite. It does not make a model calibration-ready. Performance weighting still requires chronological holdout evidence through Model Performance Evidence V1.
