# Transparent 1X2 V3 — Immutable Evaluation Package

## Purpose

The existing Transparent 1X2 V2 validator measures Brier score, log loss, calibration, class balance, slices and rolling chronological folds. V3 adds the missing evidence boundary around the input dataset.

It does **not** add a new production model and does not change any live probability. It makes offline evaluation reproducible and harder to contaminate with future information.

## Why a package is needed

A metric is not useful evidence if the underlying dataset can change silently or if it contains information that was unavailable when the prediction was made.

Every evaluation package therefore binds together three SHA-256 identities:

1. `datasetFingerprint`
2. `configurationFingerprint`
3. `resultFingerprint`

The final `packageId` fingerprints those three identities plus the package version.

Running the same approved dataset with the same evaluation configuration produces the same identities.

## Dataset manifest

An input JSON contains:

```json
{
  "manifest": {
    "schemaVersion": 1,
    "datasetId": "epl-2025-26-eval-v1",
    "datasetKind": "historical-observations",
    "createdAt": "2026-06-01T12:00:00.000Z",
    "dataCutoff": "2026-06-01T11:00:00.000Z",
    "rightsStatus": "reviewed",
    "marketBenchmarkType": "no-vig-prediction-time",
    "sourceIds": ["approved-source-a"],
    "containsPersonalData": false,
    "containsRestrictedRawPayload": false
  },
  "records": [],
  "options": {
    "minimumSample": 100,
    "minimumTrain": 50,
    "testWindow": 25,
    "binCount": 10
  }
}
```

`sourceIds` are used only when deriving the source fingerprint. They are not emitted in the redacted evaluation package.

Historical evidence requires `rightsStatus: reviewed`. Synthetic CI data must use `datasetKind: synthetic-fixture` and `rightsStatus: synthetic`; it can exercise the code but can never count as real historical validation.

## Strict row schema

Accepted fields are intentionally narrow:

- `id`
- `predictedAt`
- `kickoffAt`
- `trainingCutoff`
- `marketObservedAt`
- `outcomeObservedAt`
- `probabilities`
- `marketProbabilities`
- `outcome`
- `league`
- `season`
- `market`
- `provider`
- `decisionClass`
- `modelVersion`

Unexpected fields fail the package instead of being silently ignored. This deliberately rejects fields such as `closingOdds`, `closingLine`, settlement prices and ad-hoc post-kickoff feature payloads.

Both model and market probability triples must contain finite values strictly between 0 and 1 and sum to approximately 1. They are normalized only inside that small numerical tolerance; malformed triples fail before evaluation.

## Chronology contract

Every row must satisfy all of these independent constraints:

```text
trainingCutoff <= predictedAt
marketObservedAt <= predictedAt
predictedAt < kickoffAt
kickoffAt < outcomeObservedAt
outcomeObservedAt <= dataCutoff
```

The training cutoff and market-snapshot time do not need an artificial ordering relative to each other; each independently has to be information available no later than prediction time.

`marketObservedAt` represents the no-vig market snapshot available at prediction time. It is a separate benchmark, not a hidden model label.

The outcome is allowed only as an offline evaluation label observed after kickoff. It is never a model input.

Duplicate row IDs fail closed.

## Evaluation

After the provenance/chronology gate passes, V3 delegates scoring to the existing V2 evaluator:

- multiclass Brier score
- log loss
- reliability/calibration bins
- home/draw/away class balance
- league slice
- season slice
- market slice
- provider slice
- decision-class slice
- model-version slice
- rolling chronological folds
- separate no-vig market benchmark

All rows must remain eligible after V2 normalization for the package to count as historical validation evidence.

## Generate an evidence package

From the repository root:

```bash
node scripts/build-1x2-evaluation-package.mjs \
  --input path/to/reviewed-evaluation-input.json \
  --output artifacts/transparent-1x2-evaluation-package.json
```

Or through npm:

```bash
npm run model:1x2-evaluate -- --input path/to/reviewed-evaluation-input.json
```

To make the command fail unless the package has real reviewed historical evidence and the configured minimum sample:

```bash
node scripts/build-1x2-evaluation-package.mjs \
  --input path/to/reviewed-evaluation-input.json \
  --require-historical-evidence
```

The generated package contains metrics and fingerprints but not the input rows or source IDs.

## Promotion boundary

Even a valid historical package reports:

```text
automaticPromotionAllowed = false
productionProbabilityChanged = false
```

`historical-offline-evidence-ready-for-manual-review` means only that the evidence package is suitable for a human model review. It is not permission to deploy the challenger.

A real model change still requires the review steps in #96:

- same chronology-safe dataset for baseline and challenger
- same prediction-time no-vig benchmark
- league/season sample review
- Brier + log loss + reliability review
- reviewed challenger training cutoff
- explicit immutable model profile/version if accepted
- no automatic promotion

## Safety and data boundary

- offline evaluation only
- paper-only product
- no bookmaker login
- no deposits, withdrawals, Cash Out or real-money execution
- no closing-line input
- no future market snapshot
- no personal data
- no restricted raw provider payload
- no invented historical evidence
- synthetic CI evidence is always labeled non-historical
