# Model vs Market Skill V1

Version: `scorecaster-model-vs-market-skill-v1`

Market benchmark version: `no-vig-event-market-benchmark-v1`.

## Purpose

Absolute Brier score or log loss is not enough to claim that a Scorecaster challenger adds predictive value. Model vs Market Skill V1 evaluates each advanced shadow model against the no-vig bookmaker consensus captured for the same event at the same pregame snapshot boundary.

## Immutable benchmark capture

`createScorecasterPick` carries the complete event H2H/1X2 no-vig consensus distribution already computed from the current odds response. The Sports Analytics worker stores that distribution in the same immutable pregame snapshot as any advanced shadow prediction.

No additional bookmaker/provider API request is required.

For soccer the benchmark requires all three outcomes: home, draw and away. Missing draw probability fails closed. For binary sports home and away are required.

Small aggregation/rounding drift may be renormalized only when the raw total stays between 0.90 and 1.10. The raw total and `renormalized` flag remain in the audit record. Materially invalid distributions are rejected.

The market benchmark is never treated as an independent predictive model and never receives an Ensemble vote.

## Paired evaluation

Skill metrics use only rows where both the model prediction and the market benchmark were captured before event start.

- `modelBrierOnBenchmarkRows`
- `marketBrier`
- `brierSkillScore = 1 - modelBrier / marketBrier`
- `modelLogLossOnBenchmarkRows`
- `marketLogLoss`
- `logLossImprovement = marketLogLoss - modelLogLoss`

Positive Brier Skill Score means the model's paired Brier score is lower than the market benchmark. Positive log-loss improvement means the model's paired log loss is lower than the market benchmark.

## Skill-claim gate

A formal market-skill review claim requires:

- at least 100 paired chronological pregame rows
- positive Brier Skill Score
- positive log-loss improvement
- the benchmark sample must cover the complete model evaluation sample for `skillClaimAllowed=true`

This is still only review evidence. It does not create an Ensemble weight, production promotion or automatic parameter update.

## Safety

- no reconstructed historical benchmark
- no post-start market benchmark
- no market benchmark as an independent model
- no extra provider request for benchmark capture
- no automatic performance weight
- no automatic promotion
- production probability unchanged
- production decision unchanged
- paper-only unchanged
