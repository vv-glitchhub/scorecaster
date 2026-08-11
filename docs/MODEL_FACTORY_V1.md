# Scorecaster Model Factory V1

Model Factory V1 is the canonical boundary between Scorecaster's verified data/features and Ensemble Engine V1.

It does not invent predictions. It adapts existing deterministic shadow models and explicitly audited external model outputs into one common contract, validates chronology and performance evidence, and rejects unsafe candidates before they reach the ensemble.

## Architecture

```text
Unified Data
  -> Intelligence Fusion / Data Trust
  -> Feature Engine V1
  -> Model Factory V1
       -> deterministic model adapters
       -> model audit gate
       -> performance evidence gate
       -> rejected-model ledger
  -> Ensemble Engine V1
  -> Calibration / Risk review
  -> deterministic product decision
  -> AI explanation
```

Production probability and production decision remain unchanged in V1.

## Initial adapters

### Form + rest binary shadow

The existing NHL and NBA `form-rest-shadow-v1` binary models can become Model Factory outputs when:

- the snapshot status is `ready`
- mode is `binary-shadow`
- a real shadow probability exists
- chronology guard passed
- the model is deterministic

The adapter declares a dependence group so variants of the same family cannot double-vote in Ensemble V1.

### Feature-only form/rest profiles

WNBA, MLB and supported soccer form/rest feature-only profiles remain Feature Engine inputs only.

They are inventoried by Model Factory but cannot emit an ensemble probability.

### Transparent 1X2

Transparent 1X2 remains owned by Ensemble V1's existing canonical adapter. Model Factory inventories the family but deliberately does not duplicate the probability vote.

### External model outputs

`independentModelOutputs`, `modelOutputsV1` and the legacy explicit independent-model fields are canonicalized through Model Factory before Ensemble V1.

An external model must provide a valid probability and explicitly prove:

- independent predictive model
- deterministic implementation
- chronology-safe prediction
- model identity/version
- model family/dependence group

Known random legacy implementations such as `model-engine-v3` remain blocked.

## Performance Evidence V1

`lib/model-performance-evidence-v1.mjs` defines the canonical performance record used before an ensemble performance weight can exist.

A model is calibration-ready only when all of the following are true:

- sample size >= 100
- status is review-ready/validated/usable/promotion-ready
- evaluation is chronological holdout, walk-forward or rolling-origin
- weight source is allowlisted
- Brier score, log loss and calibration gap are present
- explicit positive performance weight is supplied
- evaluation chronology is valid
- training does not overlap holdout
- pre-event-only contract is explicit
- no closing-line leakage
- no post-event data in pre-event evaluation

Allowlisted weight sources:

- `validated-calibration-slice`
- `shadow-learning-holdout`
- `chronological-holdout`

Small or incomplete samples may remain visible as research evidence but cannot supply an ensemble weight.

## Fail-closed behavior

Model Factory rejects:

- invalid probabilities
- unaudited external models
- non-deterministic models
- future-dated predictions
- banned random legacy implementations
- model outputs whose attached performance evidence violates chronology/leakage boundaries

Missing probability is never imputed.

## Public audit

`/api/data-layer` exposes Model Factory V1 alongside Feature Engine and Ensemble Engine.

The audit contains accepted outputs, rejected outputs, non-voting adapters, performance-evidence readiness and explicit safety contracts.

## Promotion boundary

Model Factory V1 is shadow-first:

```text
automaticPromotionAllowed = false
productionProbabilityChanged = false
productionDecisionChanged = false
paperOnly = true
```

A future production model may be promoted only after chronological holdout evidence, calibration, drift review and explicit release approval.
