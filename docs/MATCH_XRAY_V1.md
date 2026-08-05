# Scorecaster Match X-Ray V1

Match X-Ray V1 is a public, reproducible pre-match evidence layer. It explains how timestamped team strength data affects the existing transparent Elo–Davidson and Poisson 1X2 baseline.

## Inputs

The production API reads normalized team evidence through the server-side Supabase service-role client. Each team record must provide:

- team identity
- power rating
- attack strength
- defence strength
- recent form
- source identifier
- observation timestamp

Sample size and the following tactical metrics are optional:

- xG for and against
- shots for and against
- possession
- press intensity
- transition threat
- set-piece threat

Optional values are displayed only when present. Missing values remain explicitly missing and are never replaced with generated prose or AI estimates.

## Chronology and leakage controls

Evidence observed after the analysis generation time is rejected. When kickoff is supplied, evidence observed at or after kickoff is rejected. Closing prices, settlement data and post-kickoff event information are excluded from Match X-Ray V1.

## Sparse-sample treatment

Recent form is normalized to a 0–100 scale and shrunk toward neutral 50 before entering the probability model:

```text
sample_weight = clamp(sample_size / 20, 0.25, 1.00)
adjusted_form = 50 + (raw_form - 50) × sample_weight
```

When sample size is unknown, the documented weight is 0.50. The raw value, adjusted value, sample size and weight are all included in the audit output.

## Matchup evidence

V1 calculates deterministic evidence rows from actual inputs:

- power-rating gap
- home attack versus away defence
- away attack versus home defence
- sample-adjusted form gap
- observed xG matchup gap when all required xG values exist
- press-versus-transition indices when both required values exist

These evidence rows are explanations of supplied values. They do not independently create a PLAY decision.

## Probability and scorelines

Match X-Ray calls `scorecaster-transparent-1x2-baseline-v1`. It exposes:

- home, draw and away probabilities
- fair decimal odds
- expected goals
- most likely scorelines
- a public 0–5 by 0–5 Poisson scoreline matrix
- probability mass outside the displayed grid

The underlying baseline is not yet league-calibrated.

## Sensitivity scenarios

The observed baseline is accompanied by clearly labelled hypothetical tests:

- neutral-venue sensitivity, when applicable
- form-neutralized sensitivity

Sensitivity scenarios are never represented as observed evidence and cannot change the stored production decision.

## Evidence-quality score

The X-Ray score combines the baseline evidence confidence, sample quality, source recency and optional tactical coverage. It is a documented evidence score, not a fitted statistical confidence interval.

## Public surfaces

- Human-readable UI: `/xray`
- Public CORS audit API: `/api/xray?home=...&away=...`
- Source governance: `/sources` and `/api/sources`

## Safety boundary

Match X-Ray is paper-only. It does not connect to a bookmaker account, transfer money, place a bet, use closing-line information or promote a selection to PLAY by itself. Lineups, injuries, travel, weather and officials remain outside V1 until the separately governed Context Engine is activated.
