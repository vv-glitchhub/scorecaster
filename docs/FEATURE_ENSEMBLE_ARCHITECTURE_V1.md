# Scorecaster Feature Engine + Ensemble Engine V1

This layer turns Scorecaster's existing data, trust, calibration and model components into a single auditable model architecture without changing the current production probability.

## Position in the final architecture

```text
Data sources
  -> Unified Data Layer
  -> Data Trust / Intelligence Fusion
  -> Feature Engine V1
  -> independent model outputs
  -> Ensemble Engine V1
  -> calibration / risk review
  -> deterministic product decision
  -> AI explanation
  -> immutable audit / learning
```

V1 is intentionally shadow-first. It creates the contracts required for a future performance-weighted production ensemble, but it does not promote itself into the production decision path.

## Feature Engine V1

`lib/feature-engine-v1.mjs` creates one deterministic snapshot per evaluated selection.

Every numeric feature records:

- feature ID
- value or explicit null
- family and role
- source and source type
- source status
- observation time
- trust
- confidence
- chronology result
- model eligibility
- rejection reasons

Core feature families include:

- market benchmark and price coverage
- data trust and verified coverage
- injury impact
- lineup / starter impact
- recent form
- rest and congestion
- travel
- weather
- market movement risk
- chronology-safe form/rest shadow features
- explicitly audited custom model inputs

### Missing-data contract

Missing data remains null. Feature Engine never turns a missing value into zero, an average or a guessed value.

### Chronology contract

Contextual and custom model features are rejected when their observation timestamp is later than the decision horizon. A rejected future feature is retained in the audit with `rejected-future` status and is not model-eligible.

### Market boundary

Selected odds and no-vig market probability are stored as `market-benchmark` features. They are not relabeled as independent predictive features.

### Custom feature boundary

A custom feature is model-eligible only when the caller explicitly supplies `audited: true` together with source, observation time, trust and confidence metadata. This prevents arbitrary JSON from silently becoming a model input.

### Snapshot hash

Feature Engine hashes the canonical event/market/feature snapshot with SHA-256. The same decision-time inputs and timestamp produce the same feature snapshot hash.

## Ensemble Engine V1

`lib/ensemble-engine-v1.mjs` consumes explicitly independent model outputs.

A model is research-eligible only when:

1. it provides a valid probability
2. it is explicitly marked `independentPredictiveModel: true`
3. it is explicitly deterministic
4. its prediction chronology is valid
5. it is not a known legacy random model
6. any attached performance evidence is chronology-safe

The old `lib/model-engine-v3.js` random-metric implementation is therefore not eligible for Ensemble V1.

## Model sources

V1 supports:

- `independentModelOutputs[]`
- `modelOutputsV1[]`
- explicitly audited `independentModelProbability`
- a valid attached Transparent 1X2 output

Context-only engines are not accepted as independent models.

The market benchmark is always kept outside the independent-model list.

## Weighting

V1 does not invent model-performance weights.

Research shadow probability uses equal weights unless a model carries an explicit validated performance weight from an allowlisted evidence source:

- `validated-calibration-slice`
- `shadow-learning-holdout`
- `chronological-holdout`

A model becomes calibration-ready for decision-weight research only when:

- sample size is at least 100
- sample/performance status is usable, validated, promotion-ready or review-ready
- the weight source is allowlisted
- an explicit positive performance weight is present
- performance and training chronology are valid

This creates the future `sport x league x market x model version` performance-weighting contract without guessing weights before the evidence exists.

## Ensemble uncertainty

V1 calculates weighted model disagreement around the shadow ensemble probability.

Disagreement is classified as:

- low
- medium
- high

High disagreement becomes an explicit research `NO_BET` reason.

## Research Risk Gate

The V1 gate recommends `NO_BET` when any of these are true:

- Data Trust / Fusion says the evidence is unsafe
- fusion trust is below the minimum boundary
- verified data coverage is too low
- Feature Engine rejected future-dated evidence
- fewer than two independent models are available
- model disagreement is high
- fewer than two calibration-ready models are available

This gate is research evidence only in V1. It cannot change the current production decision.

## Promotion boundary

Even when the ensemble has enough validated models and low disagreement, V1 can only mark the result `eligibleForHumanReview`.

```text
automaticPromotionAllowed = false
productionProbabilityChanged = false
productionDecisionChanged = false
```

A future production ensemble must pass chronological calibration, model-slice performance, drift and release review before these boundaries may change.

## AI boundary

The LLM does not create features, model weights or probabilities. It may later explain the audited Feature/Ensemble output, but deterministic model and risk layers remain authoritative.

## Public audit

`/api/data-layer` exposes:

- Feature Engine snapshot
- Ensemble Engine snapshot
- decision architecture summary
- explicit safety flags

No API keys, credentials or restricted raw provider payloads are added by this layer.

## Safety

- paper-only
- no bookmaker login
- no deposits or withdrawals
- no real-money execution
- no future-data leakage
- no missing-data imputation
- no random legacy model in the ensemble
- no market benchmark masquerading as an independent model
- no invented performance weights
- no automatic model promotion
