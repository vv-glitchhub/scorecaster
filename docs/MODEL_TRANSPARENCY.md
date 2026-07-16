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

## Trust score

Trust combines:

- pick-quality score
- market-data confidence
- source trust
- bookmaker coverage

Trust is an explainability and data-quality indicator. It is not a win probability.

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
- Short-term ROI is noisy and does not validate a model by itself.
- Positive CLV is useful process evidence but does not guarantee future returns.

## Validation

The repository includes regression tests for:

- no-vig probability normalization
- best-price selection
- removal of the fixed probability boost
- confidence behavior
- freshness classification
- rejection of incomplete one-sided markets

Public release should additionally include long-running calibration, CLV and out-of-sample tracking before any stronger predictive claims are made.
