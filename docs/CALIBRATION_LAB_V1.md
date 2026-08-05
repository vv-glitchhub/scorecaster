# Scorecaster CLV and Calibration Lab V1

Calibration Lab measures paper-decision quality independently of short-term wins and losses. It uses only final eligible market evidence captured before kickoff.

## Removed legacy behavior

The former `/api/clv-tracker` estimated a closing price from the current pick, edge and quality fields. That behavior is retired. The endpoint now returns HTTP 410 and never produces a simulated closing line.

The legacy `clv-engine.js` compatibility wrapper now requires `closingEvidenceVerified=true`, never substitutes current odds and never changes model weights.

## Evidence sequence

A trusted observation requires this chronology:

1. A paper decision is saved before kickoff.
2. The server stores the event, selection, entry odds, entry market probability, model probability, decision and model version.
3. Market Microstructure V2 records normalized provider prices before kickoff.
4. The paper decision settles as won or lost.
5. The settlement worker selects the final eligible pre-start provider consensus.
6. CLV, Brier and log loss are written to an immutable server-only observation.

User-entered `closing_odds`, current odds, simulated prices and post-start market rows are not accepted by Calibration Lab.

## CLV formulas

### Price CLV

```text
closing_fair_odds = 1 / closing_no_vig_probability
price_clv = entry_decimal_odds / closing_fair_odds - 1
          = entry_decimal_odds × closing_no_vig_probability - 1
```

Positive price CLV means the entry price was higher than the fair no-vig closing price.

### Probability CLV

```text
probability_clv = closing_no_vig_probability - entry_market_probability
```

Positive probability CLV means the closing market moved toward the selected outcome after the entry decision.

## Probability metrics

### Binary Brier score

```text
(model_probability - outcome)^2
```

The settled selected outcome is binary: win = 1, loss = 0.

### Multiclass Brier score

```text
sum((p_i - y_i)^2)
```

The engine supports multiclass benchmark records even though current stored paper selections use binary evaluation.

### Log loss

```text
binary:    -[y ln(p) + (1-y) ln(1-p)]
multiclass: -ln(p_observed_class)
```

Probabilities are bounded by epsilon before the logarithm.

## Reliability bins and intervals

The default report uses ten equal-width probability bins. Every populated bin exposes:

- sample count
- average predicted probability
- observed hit rate
- absolute calibration gap
- 95% Wilson interval for the observed hit rate

## Sample policy

Default sample states:

- below 30: `insufficient`
- 30–99: `provisional`
- 100 or more: `usable`

A usable sample still does not permit automatic promotion. Champion/challenger comparison is human-reviewed only.

## Exclusions

Every excluded settled paper decision receives a specific reason, including:

- missing event identity
- unverified entry source
- entry at or after kickoff
- void or push settlement
- missing model probability
- missing entry market probability
- missing closing selection
- missing eligible closing consensus
- insufficient closing provider coverage
- incomplete closing consensus

Exclusions remain visible in totals and exports.

## Outcome metrics

ROI-related metrics are secondary and include:

- hit rate with Wilson interval
- total paper stake
- paper profit
- yield
- maximum drawdown

They are displayed separately from CLV and calibration metrics.

## Slices

The API and UI report evidence by:

- sport
- league
- market
- bookmaker used at entry
- odds range
- decision class
- model version

Small slices are visibly marked and cannot promote a model.

## Storage and security

Production patch:

```text
scripts/apply-calibration-lab-v1.sql
```

Verification:

```text
scripts/verify-calibration-lab-v1.sql
```

Tables:

- `calibration_observations_v1`
- `calibration_settlement_runs_v1`

Both use RLS and FORCE RLS. Browser roles receive no direct privileges. Server routes access records with `service_role` and always filter user evidence by authenticated `user_id`.

## Worker

Protected endpoint:

```text
GET /api/internal/calibration-settlement
Authorization: Bearer <CRON_SECRET>
```

Enable only after both Market Microstructure and Calibration Lab storage patches are verified:

```text
MARKET_MICROSTRUCTURE_ENABLED=true
CALIBRATION_SETTLEMENT_ENABLED=true
```

The scheduled GitHub workflow runs hourly at minute 42.

## Product surfaces

```text
/calibration
/api/calibration
/api/calibration?days=365&format=csv
/api/calibration/health
```

`/api/calibration` requires authentication. CSV and JSON exports exclude user identifiers, API keys and raw provider payloads.

## Safety boundary

- paper-only
- no bookmaker account connection
- no real-money execution
- no closing data in a pre-match decision
- no current-price or simulated-closing fallback
- no CLV-driven automatic weight change
- no automatic champion/challenger promotion
