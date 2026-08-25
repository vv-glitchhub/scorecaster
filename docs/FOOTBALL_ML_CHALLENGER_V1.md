# Football ML Challenger V1

## Purpose

Football ML Challenger V1 is a research-only multiclass machine-learning experiment for 1X2 football probabilities. Its job is to test whether chronology-safe historical xG and team-state information can add measurable predictive value beyond Scorecaster's historical no-vig market benchmark before any paid live-data subscription is justified.

It cannot change production probability, evidence readiness, recommendation decision, stake, or PLAY status.

## Dataset

The first experiment uses Premier League 2015/16 because the season can be paired across:

- StatsBomb Open Data: completed-match event data, shot-level xG and shot counts.
- Football-Data.co.uk: historical 1X2 bookmaker/market odds used as the benchmark.

The loader resolves an immutable StatsBomb repository revision, hashes every event file, hashes the Football-Data CSV and hashes the final paired dataset. Open data remains research-only inside Scorecaster and is not enabled for production/commercial inference.

## Pregame feature construction

Features are frozen before the current match updates team state. The model sees rolling/shrunk historical values only:

- home/away xGF and xGA
- xG differential and matchup advantage
- goals for/against and goal differential
- shots for/against
- xG per shot and shot-quality advantage
- rest days and rest advantage
- prior-match experience
- chronology-safe Poisson 1X2 probabilities derived from prior xG state

The current match's xG, shots, goals and result are used only after its feature row has been frozen. Market probability is never an input feature to the independent ML challenger.

## Model

The model is a serializable multiclass gradient-boosted regression-tree classifier implemented in JavaScript. For each boosting round it fits one residual regression tree per class (home/draw/away) against softmax cross-entropy pseudo-residuals.

Default controls:

- learning rate: 0.06
- max tree depth: 2
- minimum leaf size: 10
- candidate split bins: 12
- maximum boosting rounds: 80
- early stopping patience: 12 rounds

The serialized model contains its feature schema, class priors/base logits, trees, learning rate, validation-selected round count, calibration temperature and split-gain feature importance.

## Chronological evaluation

The paired season is sorted chronologically and split once:

1. 55% training
2. 15% validation
3. 30% untouched holdout

Validation selects the boosting round count through early stopping. Temperature calibration is also fitted only on validation. The holdout is never used for training, stopping, calibration or ensemble-weight selection.

## Models compared

The holdout scorecard evaluates four probability sets:

1. No-vig historical market champion
2. Chronology-safe Poisson baseline
3. Independent ML challenger
4. Market + ML + Poisson ensemble

Ensemble weights are selected only on validation using a deterministic simplex grid and then frozen for holdout.

## Proper scoring and significance

Every holdout model receives:

- multiclass Brier score
- multiclass log loss
- calibration gap

The ML and ensemble challengers are paired against the same market observations with deterministic bootstrap resampling. Human review requires all of:

- at least 100 paired holdout matches
- lower Brier than market
- lower log loss than market
- 95% bootstrap lower bound for Brier improvement above zero
- 95% bootstrap lower bound for log-loss improvement above zero
- calibration no worse than the configured tolerance

Passing these gates only creates a human-review candidate. Automatic promotion is always disabled.

## Paid live-data decision

A paid xG/live-data trial becomes statistically justified only when an xG-dependent challenger clears every holdout significance gate. Otherwise the verdict remains `do-not-buy-yet`.

A positive research verdict still does not activate production ML. Production inference additionally requires a separately entitled live feature pipeline, immutable pregame captures, sufficient new holdout history and explicit human promotion.

## CI and artifacts

`.github/workflows/football-ml-challenger-v1.yml`:

1. runs regression/leakage tests
2. downloads the immutable historical inputs
3. trains and evaluates the model
4. runs security checks
5. builds the production Next.js application
6. uploads the full report and serialized model as a GitHub Actions artifact
7. commits only the compact latest scorecard to `config/football-ml-challenger-v1-latest.json`

The full serialized model is not shipped to the browser and is not connected to production decisioning.

## Safety invariants

- `researchOnly=true`
- `marketFeatureUsedByIndependentMl=false`
- `productionModelPromotionAllowed=false`
- `productionProbabilityChanged=false`
- `productionPlayUpgradeAllowed=false`
- `realMoneyActionAvailable=false`
- `paperOnly=true`
