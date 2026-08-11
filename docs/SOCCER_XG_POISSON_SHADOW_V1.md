# Soccer xG Poisson Shadow V1

Version: `soccer-xg-poisson-shadow-v1`

Model ID: `soccer-xg-poisson-v1`

## Purpose

Provide Scorecaster with a genuinely different expected-performance challenger for soccer. The model is shadow-only and cannot change production probability or decisions.

## Inputs

Required pregame team metrics:

- xG for per 90
- xG against per 90

Optional:

- post-shot xG for per 90

All observations must be from an independent advanced-data provider, have explicit trust/confidence, and satisfy both observed-at and captured-at chronology before the prediction horizon.

Blocked inputs include bookmaker odds, Polymarket, Open-Meteo, TheSportsDB and Scorecaster mirror observations.

## Formula

When post-shot xG exists:

`attack = 0.8 * xGF90 + 0.2 * postShotXGF90`

Otherwise:

`attack = xGF90`

Expected goals:

`lambda_home = sqrt(home_attack * away_xGA90)`

`lambda_away = sqrt(away_attack * home_xGA90)`

The independent Poisson score matrix is converted to home/draw/away probabilities.

## Safety

- no missing-value imputation
- no market-derived inputs
- no future observations
- deterministic formula
- explicit input snapshot hash
- lineage-derived `expected-performance` dependence group
- no automatic promotion
- no performance weight until reviewed chronological holdout evidence exists
- paper-only
