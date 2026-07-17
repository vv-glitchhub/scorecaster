# Scorecaster Agent V9 transparency

## Purpose

Agent V9 is a decision-support and virtual paper-portfolio layer on top of Scorecaster's no-vig bookmaker consensus. It does not place bets, connect to bookmaker accounts or guarantee profit.

The agent is deliberately allowed to return `WATCH` or `SKIP`. Producing fewer recommendations is preferable to manufacturing confidence.

## Inputs

The decision engine can use only structured fields already present in the Scorecaster pick and local paper history:

- no-vig consensus probability
- best available decimal odds
- edge and expected value
- bookmaker count and probability dispersion
- market-data confidence and freshness
- trust score
- league, sport, market and event identifiers
- optional verified lineup, injury or news fields when actually supplied
- settled local paper history with stake, result, closing odds and stored model probability

Missing fields remain missing. Agent V9 does not create a lineup, injury, motivation, form, weather or news claim.

## Probability immutability

The consensus probability is never changed by:

- local win or loss streaks
- ROI
- CLV
- Brier score
- an AI narrative
- portfolio limits

Learning can only alter priority or downgrade a decision. Every tracked Agent V9 row records `probabilityAdjustedByLearning: false`.

## Adversarial stress test

Agent V9 creates a conservative stress range around the consensus probability. The range widens when:

- bookmaker coverage is low
- bookmakers disagree more
- market-data confidence is low
- freshness is unknown or weak through the confidence input

This is a heuristic decision stress range, not a formal frequentist 95% confidence interval and not a guarantee that the true probability lies inside it.

The agent calculates:

- base expected value at the consensus probability
- downside expected value at the lower stress probability
- upside expected value at the upper stress probability
- consensus break-even odds
- minimum odds required for a 3% target expected value
- conservative break-even odds at the stress lower bound

A candidate cannot receive `PLAY` when the downside expected value is not positive.

## Counterargument

Every decision includes an adversarial case describing why it can fail. The counterargument includes, when applicable:

- downside EV
- the price at which the target edge disappears
- shared-source or consensus-model risk
- stale market data
- missing lineup, injury or independent-news confirmation

The counterargument is generated from structured fields and fixed rules. It does not claim access to facts that are not present in the input.

## Learning policy

Agent learning requires:

- at least 30 settled observations in the selected sport or market segment
- and either at least 15 CLV observations or at least 20 probability observations

The selected segment is the eligible sport or market segment with the larger sample. The agent does not add sport and market counts together, which would double-count the same paper bets.

Learning metrics are:

- ROI
- average CLV
- Brier score
- probability calibration gap

A sufficiently weak segment can downgrade `PLAY` to `WATCH`. A sufficiently strong segment receives only a small priority increase. Learning never creates positive edge or converts a base `SKIP` into `PLAY`.

## Conservative stake sizing

The stake uses quarter Kelly calculated from the lower stress probability, not the central consensus probability. It is then capped by the user's single-pick percentage.

A paper stake is zero for `WATCH` and `SKIP`.

## Portfolio policy

Agent V9 allocates candidates as one virtual paper portfolio:

- one `PLAY` selection per event
- total portfolio exposure cap
- per-league exposure cap
- single-pick exposure cap
- best-priority candidates allocated first

A candidate can be reduced or downgraded to `WATCH` when the portfolio or league budget is full. This changes allocation, not probability.

## Decision meanings

### PLAY

The base Scorecaster gate, data-quality gate, trust gate, downside-EV stress test and portfolio limits all pass.

### WATCH

The candidate has some positive price evidence but fails one or more conservative tests, requires more evidence or cannot fit safely into the virtual portfolio.

### SKIP

The candidate has non-positive EV, negligible edge, stale or unusable data, invalid odds or a base Scorecaster `SKIP` result.

## AI narrative boundary

A future language-model explanation may summarize the already calculated evidence. It must not:

- change probability, edge, EV, stake or decision
- invent current news, injuries or lineups
- hide missing evidence
- remove the adversarial case
- promise profit
- receive a bookmaker credential, payment detail or private service key

The deterministic decision object remains the source of truth.

## Validation

The repository regression suite checks that:

- weaker data widens the stress range
- non-positive downside EV blocks `PLAY`
- lower-bound probability is used for stake sizing
- insufficient learning data has no effect
- weak CLV, ROI or calibration can downgrade priority
- learning never changes probability
- only one `PLAY` is allowed per event
- total and league exposure caps are respected
- ROI, CLV, Brier score and calibration are calculated from paper history

## Known limitations

- The stress range is heuristic rather than a complete probabilistic posterior.
- Bookmaker feeds may share upstream sources and therefore be less independent than their count suggests.
- Local paper history may be selected, incomplete or too small.
- CLV depends on the quality and timing of the entered closing price.
- Portfolio correlation is approximated through event and league caps; it does not yet model team, player or cross-market covariance.
- Missing news and lineup data can materially change real-world outcomes.
- Positive expected value and good calibration do not guarantee future profit.
