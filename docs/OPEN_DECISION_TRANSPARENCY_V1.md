# Scorecaster Open Decision Transparency V1

Scorecaster exposes the reasoning chain behind every visible WATCH, CAUTION and SKIP card. The explanation layer does not change the underlying probability or upgrade a decision after the fact.

## Public access

- Web page: `/transparency`
- Public JSON API: `/api/transparency`
- Event detail: `/api/transparency?eventId=EVENT_ID`
- Authentication: not required
- CORS: `*`

The public interface contains Scorecaster formulas, decision thresholds, source identifiers, source licence metadata, normalized calculation inputs that are safe to publish, calculation outputs, missing-input warnings and gate results.

Scorecaster never publishes API keys, server secrets, personal data or raw provider payloads when redistribution rights are absent.

## Decision labels

### WATCH

WATCH requires all of the following:

1. An independent model probability exists.
2. A market probability or valid decimal price exists.
3. Model edge is at least `0.04`.
4. Data quality is at least `0.72`.
5. The result remains paper-only.

### CAUTION

CAUTION means usable publishable evidence exists, but one or more WATCH gates did not pass. A market-only observation can therefore remain visible as CAUTION instead of disappearing from the interface.

### SKIP

SKIP means evidence is missing, stale or below the minimum quality gate. SKIP is a valid transparent answer, not a hidden error state.

## Core formulas

### Implied probability

```text
p_market = 1 / decimal_odds
```

This is a single-price implied probability and does not by itself remove bookmaker margin.

### Model edge

```text
edge = p_model - p_market
```

### Fair odds

```text
fair_odds = 1 / p_model
```

### Expected value per unit stake

```text
EV = p_model × decimal_odds - 1
```

An EV of `0.05` means an estimated five-percent expectation per unit over many comparable trials. It is not a promise for one event.

### Freshness

```text
freshness = max(0, 1 - min(1, age_hours / 24))
```

### Data quality

```text
quality =
  0.30 × average_source_trust
+ 0.25 × average_confidence
+ 0.20 × freshness
+ 0.15 × min(1, record_count / 8)
+ 0.10 × min(1, unique_sources / 2)
```

### Daily ranking score

```text
score = 100 × (
  0.70 × quality
+ 0.30 × min(abs(edge), 0.15) / 0.15
)
```

The score ranks available observations. It is not a probability.

### Kelly fraction

```text
f* = (decimal_odds × p_model - 1) / (decimal_odds - 1)
```

Scorecaster caps full Kelly at five percent and primarily displays fractional Kelly in paper mode.

### Brier score

```text
Brier = mean((p_i - y_i)^2)
```

Lower is better.

### Log loss

```text
LogLoss = mean(-(y × ln(p) + (1-y) × ln(1-p)))
```

Probabilities are clipped to `[0.001, 0.999]` for numerical stability.

### Closing-line value

```text
CLV = opening_odds / closing_odds - 1
```

## Source disclosure

The public source registry contains:

- source ID and name
- source type and access mode
- licence label
- attribution requirement and attribution text
- terms URL when configured
- commercial-use, training and redistribution flags
- supported sports and operator notes

A source can be cited publicly without granting Scorecaster permission to redistribute the source's complete raw payload. Source terms always remain controlling.

## Reproducibility

For a selected event, the public API returns:

- model and market probabilities
- decimal odds
- fair odds
- edge and expected value
- quality components and ranking score
- Kelly outputs
- positive, mixed and negative factors
- gate pass/fail results
- missing inputs
- formulas used
- source summaries
- normalized public records

The explanation declares `inventedData: false` and `probabilityChangedByExplanation: false`.

## Safety boundary

Scorecaster is a decision-support and paper-tracking system. It does not place bets, transfer money or promise profit. Transparency is intended to make uncertainty and limitations visible, not to make a risky decision appear certain.
