# Transparent 1X2 Baseline V1

Transparent 1X2 Baseline V1 estimates pre-match home win, draw and away win probabilities for football from stored Scorecaster team ratings.

It does not reproduce or claim access to Google's proprietary model. It is a documented Scorecaster baseline intended for audit, comparison and chronological validation.

## Public surfaces

- Human-readable laboratory: `/probabilities`
- Public JSON calculation: `/api/1x2?home=HOME&away=AWAY`
- Optional market comparison: add `homeOdds`, `drawOdds` and `awayOdds`
- Optional neutral venue: add `neutral=true`

The public API requires no sign-in and supports read-only CORS.

## Required inputs

Each team must have all four stored inputs:

- chronology-safe rating or Elo value
- attack rating
- defence rating
- form rating

Missing inputs fail closed. The engine does not invent a neutral rating, average attack, average defence or replacement form value.

## Elo–Davidson component

Home strength:

```text
q_home = 10^((R_home + H - R_away) / 400)
```

Away strength:

```text
q_away = 1
```

Draw strength:

```text
q_draw = nu × sqrt(q_home × q_away)
```

The three strengths are normalized to sum to one. Baseline defaults:

- home advantage `H = 55` Elo points
- neutral venue `H = 0`
- Davidson draw parameter `nu = 0.62`

## Poisson component

The engine calculates expected home and away goals from league scoring baselines plus attack, opposing defence, form and venue terms.

```text
lambda_home = league_home_goals × exp(
  0.32 × home_attack_strength
  + 0.26 × away_defence_weakness
  + 0.10 × form_difference
  + venue_goal_boost
)
```

```text
lambda_away = league_away_goals × exp(
  0.32 × away_attack_strength
  + 0.26 × home_defence_weakness
  - 0.10 × form_difference
)
```

Baseline league averages are 1.45 home goals and 1.15 away goals. Expected goals are bounded to 0.2–4.5.

Every score from 0–0 through 10–10 is calculated:

```text
P(X = k) = exp(-lambda) × lambda^k / k!
```

Score probabilities are summed into home, draw and away outcomes. The API exposes the covered probability mass and the eight most likely scorelines.

## Ensemble

```text
p_final = 0.45 × p_Elo-Davidson + 0.55 × p_Poisson
```

The final probabilities are normalized to sum to 100%.

Fair decimal odds are:

```text
fair_odds = 1 / p_final
```

## Market benchmark

Market odds are optional and remain separate from the model.

```text
p_raw_i = 1 / odds_i
p_no_vig_i = p_raw_i / sum(p_raw)
edge_i = p_model_i - p_no_vig_i
```

Adding or changing market odds cannot alter the model probabilities. The regression suite verifies this directly.

## Evidence confidence

The displayed evidence confidence is not a win probability and not a fitted confidence interval.

```text
confidence = 0.65 × input_completeness
           + 0.20 × chronological_sample_score
           + 0.15 × calibration_score
```

V1 has no league-specific chronological sample or calibration evidence activated, so those components remain zero. The displayed probability band is explicitly labelled as a heuristic evidence-quality band.

## Current limitations

- baseline coefficients have not yet passed league-specific rolling calibration
- no verified lineup, injury, suspension, travel, weather or referee layer
- no Dixon–Coles low-score correction in V1
- no trained league or season parameters
- no closing-line or post-kickoff information
- the model cannot independently promote a Scorecaster decision to PLAY

## Validation roadmap

Before the model can become decision-authoritative, Scorecaster must add:

1. chronological training and validation windows
2. league and season slices
3. multiclass Brier score and log loss
4. calibration curves and class-balance checks
5. comparison with no-vig bookmaker consensus
6. minimum sample thresholds
7. champion/challenger review without automatic promotion
8. verified context inputs from the Source Registry

## Safety boundary

The engine is paper-only. It does not connect bookmaker accounts, place bets, move money or claim guaranteed profit. Its first production role is transparent observation and audit.
