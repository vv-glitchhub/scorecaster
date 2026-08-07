# Transparent 1X2 V2 — chronology-safe validation and Dixon-Coles challenger

## Status

Transparent 1X2 V2 advances the existing Scorecaster pre-match model without changing the production probability or decision authority.

The production probability remains the documented V1 Elo-Davidson + independent Poisson baseline. V2 adds:

- a Dixon-Coles low-score challenger
- a chronology-safe validation engine
- multiclass Brier score and log loss
- reliability / calibration bins
- league, season, market, provider, decision-class and model-version slices
- rolling chronological folds
- a separate no-vig market benchmark
- explicit sample-size and leakage gates

The challenger is **offline evaluation only**. It cannot promote PLAY, alter stake, connect to a bookmaker or execute a real-money bet.

## Why the production model does not change yet

Adding a mathematically plausible correction is not evidence that it improves forecasts.

Scorecaster therefore does not invent a Dixon-Coles `rho` value and does not silently replace the current baseline. A challenger profile becomes eligible for offline comparison only when it records:

- `status: validated`
- a chronology-safe `trainingCutoff`
- at least 100 eligible validation observations
- a bounded `rho` in `[-0.25, 0.25]`

Even a valid profile still has `canAffectProductionDecision: false` and `automaticPromotionAllowed: false`.

Any later promotion requires a separately reviewed model-version change after empirical chronological evidence.

## Dixon-Coles challenger

The challenger starts from the same expected goals already produced by the transparent baseline.

For scoreline `(x, y)`:

```text
P_base(x,y) = Poisson(lambda_home, x) * Poisson(lambda_away, y)
P_DC(x,y) ∝ tau(x,y,lambda_home,lambda_away,rho) * P_base(x,y)
```

The low-score correction is:

```text
0-0: 1 - lambda_home * lambda_away * rho
0-1: 1 + lambda_home * rho
1-0: 1 + lambda_away * rho
1-1: 1 - rho
other scores: 1
```

The corrected scoreline mass is normalized before producing home/draw/away probabilities.

With `rho = 0`, the challenger reduces to the independent Poisson model.

## Chronology contract

Historical validation records must contain:

- model probabilities for home/draw/away
- actual outcome
- prediction timestamp
- kickoff timestamp
- optional training cutoff
- optional no-vig market probabilities
- optional league, season, provider, decision class and model version labels

A row is excluded when:

- probabilities are malformed
- outcome is not home/draw/away
- prediction time is missing
- kickoff time is missing
- prediction is at or after kickoff
- training cutoff is after the prediction timestamp

Closing-line data is not a model input in this validation contract.

## Brier score

Scorecaster uses the mean multiclass squared error across the three 1X2 classes:

```text
Brier = mean(((p_home-y_home)^2 + (p_draw-y_draw)^2 + (p_away-y_away)^2) / 3)
```

Lower is better.

Every result exposes the numerator, denominator and final average.

## Log loss

For the observed class:

```text
LogLoss = mean(-ln(p_actual_outcome))
```

Probabilities are bounded away from exact zero and one for numerical safety. Lower is better.

## No-vig benchmark

When historical no-vig market probabilities are supplied, Scorecaster scores them separately with the same Brier and log-loss formulas.

They are never relabelled as the model.

`deltaVsMarket` is defined as:

```text
model metric - market benchmark metric
```

A negative delta means the model scored better for that metric over the evaluated sample.

## Reliability bins

Each home, draw and away forecast contributes one probability/outcome pair to a reliability bin.

For each populated bin Scorecaster reports:

- probability interval
- observation count
- mean forecast probability
- empirical outcome frequency
- calibration gap

The calibration gap is:

```text
empirical frequency - mean predicted probability
```

## Rolling chronological evaluation

Validation rows are sorted by kickoff time.

Each test window is evaluated only after an earlier training prefix. A fold is marked chronology-safe only when every training kickoff is strictly before the first test kickoff.

This structure is intended to prevent random train/test mixing from hiding temporal leakage.

## Sample-size boundary

The default descriptive minimum is 100 eligible rows.

Below the configured minimum the validation result is explicitly labelled:

```text
small-sample-do-not-promote
```

No sample size, metric result or challenger profile can automatically promote a model into production.

## API boundary

`GET /api/1x2` now returns V2 audit metadata while keeping the same public request inputs.

Users cannot submit:

- Dixon-Coles `rho`
- a challenger profile
- a training cutoff
- closing-line data
- settlement data

through the public probability request.

The API explicitly reports:

- `closingLineUsed: false`
- `postKickoffDataUsed: false`
- `challengerChangesProductionProbability: false`
- `automaticModelPromotion: false`
- `canPromotePlayByItself: false`
- `realMoneyExecution: false`
- `paperOnly: true`

## Promotion checklist for a future version

A future PR may propose changing the production ensemble only after it includes all of the following:

1. immutable versioned model profile
2. explicit training cutoff
3. rolling chronological evaluation
4. league and season slices
5. multiclass Brier score
6. log loss
7. reliability evidence
8. no-vig market benchmark
9. minimum sample requirement
10. leakage regression tests
11. documented challenger-versus-current comparison
12. manual review and a deliberate production version change

Automatic model promotion remains out of scope.

## Safety boundary

This work remains sports analysis and paper tracking only.

It does not add:

- bookmaker login
- bookmaker credentials
- deposits or withdrawals
- real-money stake placement
- Cash Out
- automatic stake escalation
- closing-line leakage into pre-match predictions
- invented injury, lineup, weather or tactical data
