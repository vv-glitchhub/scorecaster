# Scorecaster Bankroll Risk Lab V1

Bankroll Risk Lab is a reproducible, paper-only simulation workspace for understanding stake sizing, variance, correlation and downside. It never connects to a bookmaker account, transfers money or places a real bet.

## Product questions

The lab answers:

1. What would full, half, quarter or one-eighth Kelly suggest?
2. Which hard cap reduces the suggested paper stake?
3. How does same-event or uncertain correlation reduce exposure?
4. What range of paper-bankroll outcomes appears under repeated simulation?
5. How do bounded Kelly, flat staking and a zero-bet baseline compare under the same simulated results?
6. What happens when probability estimates are overconfident or the available price deteriorates?

## Kelly formula

For decimal odds `o` and estimated win probability `p`:

```text
b = o - 1
q = 1 - p
full_kelly = max(0, (b*p - q) / b)
selected_kelly = full_kelly * multiplier
```

Multipliers:

- full: `1.0`
- half: `0.5`
- quarter: `0.25`
- conservative: `0.125`

A negative Kelly result always creates zero exposure.

## Non-overridable paper-risk caps

Absolute maximums are:

```text
selection: 1.0% of bankroll
daily:     5.0% of bankroll
league:    2.5% of bankroll
portfolio: 5.0% of bankroll
```

Risk profiles may be stricter. A client request above a profile or absolute cap is recorded as an override attempt and clamped down. Kelly output cannot override a safety cap.

## Correlation

Selections with the same event identity belong to the same default correlation group. Multiple selections in a group receive a conservative stake penalty before hard caps. An explicitly unknown correlation state also reduces stake.

For the simulation, Scorecaster uses a seeded Gaussian latent-factor approximation to generate correlated Bernoulli outcomes. Correlation can reduce a planned stake but never increase it.

Correlation coefficients are assumptions unless backed by separately validated evidence. The UI and API expose that limitation.

## Seeded simulation

Every run includes a visible seed. Repeating the same inputs and seed produces the same simulation distributions. The engine compares:

- bounded fractional Kelly
- capped flat staking
- a zero-bet baseline

Bounded Kelly and flat staking are evaluated against the same generated outcomes inside each scenario.

Reported evidence includes:

- mean, median, P05, P25, P75 and P95 ending bankroll
- return distribution
- probability of finishing below the starting bankroll
- risk of crossing the configured ruin threshold
- probability of bankruptcy
- median, P90 and P95 maximum drawdown
- median, P90 and P95 longest losing streak
- total simulated paper stake

## Stress scenarios

V1 includes:

- baseline
- model-overconfidence shrink toward market probability
- price deterioration
- combined overconfidence, probability shock and price deterioration

Stress tests do not modify Scorecaster's production probability or decision. They are scenario analysis only.

## Public surfaces

- UI: `/risk-lab`
- audit and methodology API: `/api/risk-lab`

The API accepts at most 20 normalized paper selections and keeps request bodies bounded. It does not store a simulation, personal data or provider payload.

## Safety boundary

- paper-only
- no bookmaker credentials
- no account linking
- no deposits or withdrawals
- no real-money execution
- no guaranteed-profit claim
- no automatic increase after losses
- no safety-cap override
- no use of a simulation to promote a model automatically

Simulation quality is limited by probability quality, price quality and correlation assumptions. A favorable simulation is not evidence of guaranteed future profit.
