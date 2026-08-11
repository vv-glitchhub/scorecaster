# Scorecaster Historical Rating Shadow V1

Historical Rating Shadow V1 adds a deterministic recent Elo-style research model using Scorecaster's existing completed-results feed.

It is intentionally shadow-only. It does not change the current production probability, edge, EV, stake or product decision.

## Data source

The model consumes the normalized recent league results already returned by `lib/results-provider.js`.

The provider currently caps the recent league sample at 120 events. Historical Rating does not make an additional provider request: it reuses the same result payload already fetched for form/rest intelligence.

## Chronology

Only events that satisfy all of these conditions are eligible for training:

- event is marked finished
- event has both final scores
- event has both team names
- event timestamp is valid
- event timestamp is strictly before the target fixture

Events at or after the fixture are excluded before any rating update.

## Formula

Each supported league starts from a common research rating of 1500.

Expected home result:

```text
P_home = 1 / (1 + 10^(-((R_home + H - R_away) / 400)))
```

Rating update:

```text
R_home_new = R_home + K * (actual_home - P_home)
R_away_new = R_away - K * (actual_home - P_home)
```

`actual_home` is 1 for a home win, 0 for a home loss and 0.5 for a tie.

## Research profiles

V1 has research profiles for:

- NHL
- NBA
- WNBA
- MLB

Each profile defines a K-factor, research home-advantage Elo term and minimum sample gates.

These parameters are documented defaults. They are not claimed to be calibrated production parameters.

## Sample gate

The model emits a probability only when:

- the result provider is live
- the target sport is supported
- fixture time is valid
- the selected side is home or away
- the league sample meets the profile minimum
- both target teams meet the minimum historical game count

If any gate fails, `shadowProbability` remains null.

## Dependence policy

Historical Rating and form/rest are both transformations of completed historical results.

They therefore share one sport-specific dependence group:

```text
<sport key>-historical-results-family
```

They may both be visible inside Model Factory and may refine the internal group probability, but Ensemble V1 counts the group as only one top-level model vote.

This is deliberate: two different formulas using much of the same underlying history must not create fake ensemble independence.

## Limitations

The free recent-results feed does not provide a complete historical preseason rating state. V1 therefore starts all teams at the same research baseline inside the available recent sample.

Because of this, and because K-factor/home advantage have not yet passed chronological league-specific calibration, Historical Rating V1 is a challenger/shadow model only.

## Promotion requirements

Before any Historical Rating variant could influence a production probability, it would need at minimum:

- chronological holdout or walk-forward evaluation
- sample size >= 100 for the relevant performance slice
- Brier score
- log loss
- calibration gap
- no closing-line leakage
- pre-event-only evidence
- explicit Model Performance Evidence V1 record
- dependence-aware ensemble review
- human release approval

Automatic promotion remains disabled.

## Safety

```text
probabilityAppliedToProduction = false
edgeAdjusted = false
evAdjusted = false
usedForDecision = false
paperOnly = true
```
