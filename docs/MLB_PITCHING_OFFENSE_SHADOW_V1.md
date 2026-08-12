# MLB Pitching + Offense Shadow V1

## Purpose

`mlb-pitching-offense-shadow-v1` is a deterministic, paper-only MLB H2H research challenger based on pregame advanced performance data. It is separate from market consensus and from historical-results Elo/form models.

It cannot change Scorecaster's production probability, decision, stake or any real-world betting action.

## Required inputs

For both home and away teams:

- standardized lineup strength
- standardized bullpen depth
- confirmed starting pitcher's xwOBA allowed

Optional:

- standardized park context

Lineup, bullpen and park values are accepted only when their unit or metadata scale declares a z-score / standardized scale. Raw incompatible ratings are not silently mixed.

## Starting-pitcher contract

A starting-pitcher observation must identify its home/away team and explicitly establish starter status using `starter=true`, `isStarter=true`, or role `starting-pitcher` / `starter`.

For the generic `xwoba` metric, metadata must also declare an allowed/against/conceded perspective. This prevents hitter xwOBA or ambiguous team xwOBA from masquerading as pitcher xwOBA allowed.

The accepted xwOBA allowed range is 0.15–0.55. Values outside that range fail closed.

## Formula

Starting-pitcher vulnerability:

`starter_vulnerability_z = clamp((starter_xwOBA_allowed - 0.320) / 0.030, -3, 3)`

Team matchup score:

`home_matchup = home_lineup_z + away_starter_vulnerability_z - away_bullpen_z`

`away_matchup = away_lineup_z + home_starter_vulnerability_z - home_bullpen_z`

Home edge research score:

`home_edge = home_matchup - away_matchup + 0.18`

H2H probability:

`P(home) = 1 / (1 + exp(-(home_edge / 1.55)))`

`P(away) = 1 - P(home)`

The 0.320 xwOBA baseline, 0.030 scale, 0.18 home-field score and 1.55 logistic scale are transparent research defaults. They are not claimed calibrated MLB parameters.

## Park context

Optional park context is stored in the input snapshot and exposed in audit UI, but V1 deliberately does **not** use it in H2H probability. A single symmetric park factor would otherwise cancel from the home-versus-away edge and create misleading apparent model complexity.

A future park adjustment may enter the probability only if a directionally auditable team/platoon interaction is available and validated.

## Chronology and provider boundary

Every accepted observation must:

- have `observedAt` and `capturedAt` no later than the prediction horizon
- meet source trust and confidence floors
- come from a non-market, non-mirrored provider

Blocked sources include The Odds API, odds-market, Polymarket, TheSportsDB, Open-Meteo and Scorecaster's unified-data mirror.

## Lineage and Model Factory

The independent model output declares:

- `expected-performance`
- `performance-statistics`

Model Lineage Guard derives the top-level dependence group. For MLB it is expected to resolve to:

`baseball_mlb-expected-performance-family`

The model cannot select its own top-level independence group by name.

## Immutable chronological holdout

Before first pitch, the existing advanced shadow ledger stores:

- model ID/version
- home/away probability distribution
- input snapshot hash
- provider and metric lineage
- capture timestamp and prediction horizon

After settlement, `scorecaster-advanced-model-holdout-v1` may compute:

- Brier score
- log loss
- calibration gap
- sample size
- evaluation window

No performance weight is invented. Even when a model reaches the review sample threshold, automatic promotion remains disabled.

## Safety invariants

- paper-only
- no bookmaker execution or account access
- deterministic
- missing required values remain missing
- no post-first-pitch inputs
- no market-derived model inputs
- both starting pitchers required
- incompatible units rejected
- optional park context does not affect V1 H2H probability
- no automatic model promotion
- no automatic performance weight
- production probability unchanged
- production decision unchanged
