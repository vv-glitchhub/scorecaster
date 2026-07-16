# Scorecaster model transparency

## What the default Top Picks engine does

Scorecaster's default production Top Picks engine is a market-consensus and price-comparison model.

1. It collects the available decimal odds for the same market from multiple bookmakers.
2. It converts each bookmaker's prices into implied probabilities.
3. It removes that bookmaker's margin by normalizing the probabilities inside the market.
4. It takes a robust consensus across the available no-vig probabilities.
5. It compares the best available price with the consensus fair probability.

The resulting edge is:

```text
consensus fair probability - implied probability of the best available odds
```

Expected value is:

```text
best decimal odds × consensus fair probability - 1
```

This identifies price differences and line-shopping value. It is not proof that the selected team will win and it is not a guarantee of profit.

## What changed from the prototype

The prototype added a fixed positive adjustment to the market probability. That could create artificial edge even when no independent evidence existed. The production consensus engine removes that adjustment.

The fallback probability is now exactly the implied probability when a multi-bookmaker consensus is unavailable. Scorecaster does not invent a home-team or away-team advantage.

## Confidence

Confidence is numeric from 0 to 1 and is based on:

- number of bookmakers in the consensus
- agreement between their no-vig probabilities
- age of the latest market update

Confidence does not mean probability of winning. It means confidence in the quality of the market data used by the analysis.

## Decision gate

A pick cannot receive PLAY unless the data gate passes. The current production gate requires:

- at least four bookmakers
- market-data confidence of at least 0.55
- non-stale data
- positive expected value
- a meaningful best-price gap versus consensus

Lower-quality positive prices remain CAUTION. Missing, stale or non-positive data becomes SKIP.

## Personal paper thresholds

Each authenticated user can set a personal minimum edge and minimum confidence. These limits apply to Scorecaster-generated paper picks in addition to the global PLAY / CAUTION / SKIP gate.

The limits are enforced in three places:

- the native user interface
- the authenticated paper-bet API
- a PostgreSQL trigger

The database also enforces maximum single paper stake, total open paper exposure and single-league open exposure. Manual paper entries remain possible for education and comparison, but they are still subject to stake and exposure limits.

## Trust score

Trust combines:

- pick-quality score
- market-data confidence
- source trust
- bookmaker coverage

Trust is an explainability and data-quality indicator. It is not a win probability.

## Result settlement

Open H2H paper picks can be checked against the configured server-side scores provider. Automatic settlement:

- is explicitly started by the authenticated user
- is limited to a small number of requests per hour
- checks only sports represented by that user's open paper picks
- has bounded sport, bet and update counts
- uses the stored odds event ID when available
- falls back to normalized home/away team matching for older rows
- updates only the authenticated user's still-open rows
- leaves incomplete, unsupported or ambiguous markets open

Manual settlement remains available. Automatic settlement never places, modifies or settles a real-money bet.

## Probability calibration

When a Scorecaster pick is saved, its consensus probability is stored in the protected paper history. Won and lost Scorecaster picks can then be used to measure:

- expected win rate
- actual win rate
- calibration gap
- Brier score

The Brier score is the mean squared difference between the stored probability and the binary result. Lower is better, but a small sample is highly unstable. Manual rows without a stored model probability are excluded instead of being assigned an invented probability.

Calibration evaluates whether probability estimates are honest over time. It does not guarantee future profit and must be interpreted together with sample size, CLV and out-of-sample performance.

## Paper-only boundary

Scorecaster does not:

- accept deposits or withdrawals
- store payment-card or bank data
- connect to bookmaker credentials
- place real-money bets
- guarantee profit

All stakes and bankroll values are virtual paper-tracking values.

## Known limitations

- A bookmaker consensus can be wrong.
- Multiple bookmakers may copy the same underlying market-making source.
- Odds can move after the analysis is generated.
- News, injuries and lineups may be missing, delayed or incorrect.
- Automatic settlement currently targets supported H2H markets; other markets require manual review.
- Team-name fallback matching is conservative and can leave valid older bets unresolved.
- Short-term ROI and calibration are noisy and do not validate a model by themselves.
- Positive CLV is useful process evidence but does not guarantee future returns.

## Validation

The repository includes regression tests for:

- no-vig probability normalization
- best-price selection
- removal of the fixed probability boost
- confidence behavior
- freshness classification
- rejection of incomplete one-sided markets
- event-ID and team-name score matching
- home, away and draw settlement
- rejection of incomplete and unsupported settlement cases

Public release should additionally include long-running calibration, CLV and out-of-sample tracking before any stronger predictive claims are made.
