# Transparent 1X2 V4 — Paired Baseline vs Challenger Evidence

## Purpose

V4 makes baseline-vs-challenger evaluation auditable on the **same historical cohort** without conflating the shared dataset with each model's own predictions.

This is an offline model-review tool. It does not change production probabilities and cannot promote a model automatically.

## Three evidence identities

Each V3 evaluation package now exposes separate identities:

### `cohortFingerprint`

Identifies the shared evaluation cohort and excludes model-specific prediction fields.

It includes the reviewed dataset identity plus, per event:

- event row ID
- prediction timestamp
- kickoff timestamp
- prediction-time market snapshot timestamp
- outcome observation timestamp
- no-vig prediction-time market probabilities
- realized outcome label
- league
- season
- market
- benchmark provider label

It deliberately excludes:

- model probability vector
- model version
- decision class
- model training cutoff

Therefore a baseline and challenger can have the same cohort fingerprint even though their predictions differ.

### `predictionFingerprint`

Identifies model-specific prediction evidence:

- row ID
- prediction timestamp
- training cutoff
- home/draw/away model probabilities
- decision class
- model version

### `datasetFingerprint`

The original full-row fingerprint remains in place for backward auditability and immutability. It naturally differs when model-specific prediction fields differ.

## Paired comparator gate

`compareTransparent1X2EvaluationPackages()` accepts two already-built evaluation packages and fails closed unless they share:

- valid packages and package IDs
- identical cohort fingerprint
- identical evaluation configuration fingerprint
- identical row count
- identical source-provenance fingerprint
- identical market benchmark type
- identical aggregate prediction-time market benchmark results
- identical rolling chronological fold structure and fold-level market benchmark

Model prediction fingerprints are allowed to differ. They are also allowed to be identical: an identical challenger is a valid directional tie, not an error.

## Metrics

For comparable packages the report exposes:

```text
challenger Brier - baseline Brier
challenger log loss - baseline log loss
```

Negative means the challenger scored better for that metric.

The comparator labels each metric:

- `challenger-better`
- `baseline-better`
- `tie`
- `unavailable`

Overall directional labels are:

- `challenger-directionally-better`
- `baseline-directionally-better`
- `directional-tie`
- `mixed-directional-evidence`
- `not-comparable`

These are descriptive metric directions only. The report explicitly states:

```text
statisticalSignificanceClaimed = false
automaticPromotionAllowed = false
productionProbabilityChanged = false
```

No p-value, confidence interval or significance claim is invented from aggregate metrics.

## Rolling-fold comparison

When the chronological fold identities match, V4 produces per-fold Brier and log-loss deltas. This helps reviewers see whether an aggregate improvement is broadly repeated or driven by a small number of windows.

The fold comparison itself does not establish statistical significance.

## Historical evidence boundary

A paired comparison can be labeled:

```text
paired-historical-evidence-ready-for-manual-review
```

only when both underlying packages are:

- real reviewed historical evidence
- chronology eligible
- above their configured minimum sample
- comparable on the exact same cohort/configuration/market benchmark/fold structure

Synthetic fixtures and insufficient historical samples can still exercise the comparator, but receive:

```text
paired-synthetic-or-insufficient-evidence-do-not-promote
```

A mismatch receives:

```text
paired-evidence-invalid
```

## CLI

After producing two V3 packages:

```bash
npm run model:1x2-compare -- \
  --baseline artifacts/baseline-evaluation.json \
  --challenger artifacts/challenger-evaluation.json \
  --output artifacts/transparent-1x2-paired-evidence.json
```

For a release/model-review workflow that must fail unless the pair qualifies as reviewed historical evidence:

```bash
npm run model:1x2-compare -- \
  --baseline artifacts/baseline-evaluation.json \
  --challenger artifacts/challenger-evaluation.json \
  --require-historical-pair
```

The comparator consumes redacted evaluation packages. It does not require or emit the original event rows.

## Review rule for #96

A challenger should not even be considered for a production profile unless reviewers can show:

1. identical cohort fingerprint
2. identical evaluation configuration
3. both packages independently chronology-safe
4. sufficient reviewed historical sample
5. no-vig market benchmark unchanged between packages
6. Brier/log-loss/reliability reviewed overall and by league/season
7. rolling-fold behavior reviewed
8. challenger training cutoffs remain pre-prediction
9. any fitted Dixon-Coles `rho` came only from earlier training data
10. explicit human approval of an immutable profile/version

Even then, existing Scorecaster PLAY safety gates remain separate.

## Safety boundary

- offline evaluation only
- paper-only product
- no bookmaker login
- no deposits, withdrawals, Cash Out or real-money execution
- no closing-line model input
- no future market snapshot
- no invented historical evidence
- no automatic model promotion
- no statistical significance claim unless a future reviewed method explicitly computes one
