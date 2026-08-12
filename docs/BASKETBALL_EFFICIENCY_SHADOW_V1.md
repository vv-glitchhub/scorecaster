# Basketball Efficiency Shadow V1

## Purpose

`basketball-efficiency-shadow-v1` adds an independent NBA/WNBA research challenger based on team efficiency statistics rather than bookmaker prices or completed-result Elo/form inputs.

The model is shadow-only and paper-only. It cannot change Scorecaster's production probability, decision, stake, or real-world action.

## Model identities

- NBA: `nba-efficiency-pace-v1` / `nba-efficiency-pace-shadow-v1`
- WNBA: `wnba-efficiency-pace-v1` / `wnba-efficiency-pace-shadow-v1`

NBA and WNBA intentionally use different model versions so chronological holdout samples cannot be silently mixed.

## Required pregame inputs

For both home and away teams:

- pace
- offensive rating (points per 100 possessions)
- defensive rating (opponent points per 100 possessions)

Optional:

- lineup-adjusted impact in points per 100 possessions

All observations must be captured and observed no later than the prediction horizon. Missing required values remain missing and make the model unavailable.

## Formula

Research pace:

`possessions = clamp(sqrt(home_pace * away_pace), profile_min, profile_max)`

Matchup rating:

`home_rating = mean(home_ORtg, away_DRtg) + bounded_home_lineup_impact`

`away_rating = mean(away_ORtg, home_DRtg) + bounded_away_lineup_impact`

Neutral projected points:

`points = possessions * matchup_rating / 100`

A published research home-court adjustment is then split across home and away projections. The projected margin is converted to H2H probability with a logistic curve:

`P(home) = 1 / (1 + exp(-projected_margin / logistic_scale))`

`P(away) = 1 - P(home)`

## Research defaults

NBA:

- pace bound: 85–115
- home-court adjustment: 2.5 points
- logistic scale: 6.5

WNBA:

- pace bound: 75–110
- home-court adjustment: 2.0 points
- logistic scale: 6.0

Lineup impact is bounded to ±5 points per 100 possessions.

These are transparent research defaults, not claimed league-calibrated parameters. They require chronological holdout evidence before any human-reviewed calibration proposal.

## Lineage and dependence

The model declares:

- `performance-statistics`
- `context` when optional lineup impact is part of the input family

Model Lineage Guard derives the top-level group from this lineage. For NBA the expected group is `basketball_nba-performance-statistics-family`; WNBA receives its corresponding sport-key group.

Market pricing, Polymarket, The Odds API, TheSportsDB result data, Open-Meteo, and Scorecaster's unified-data mirror are blocked from advanced model inputs.

## Chronological holdout

The existing `advanced-shadow-prediction-ledger-v1` stores before tipoff:

- model ID and version
- home/away probability distribution
- input snapshot hash
- providers
- metrics
- capture timestamp and prediction horizon

After settlement, `scorecaster-advanced-model-holdout-v1` may compute Brier score, log loss, calibration gap, and sample size.

NBA and WNBA remain separate holdout groups because their model versions are distinct.

Even at 100+ settled predictions, the holdout produces no automatic ensemble weight. Promotion remains manual and evidence-gated.

## Safety invariants

- no real betting execution
- no bookmaker account access
- paper-only
- deterministic
- missing values are not imputed
- no post-tipoff model inputs
- no market-derived model inputs
- no automatic promotion
- no automatic performance weight
- production probability unchanged
- production decision unchanged
