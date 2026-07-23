# Scorecaster Shadow Learning V1

Shadow Learning V1 turns settled virtual paper decisions into an auditable research dataset. It never changes the production probability, upgrades a decision to PLAY or executes a real-money bet.

## What is stored

For each governed paper PLAY, the database trigger stores an immutable decision-time snapshot containing:

- original model probability and market probability
- decision, reasons, edge, EV, odds and virtual stake
- used and unused Unified Sports Data factors
- lineup, injury, form, rest, travel, weather and market-movement context when available
- provider coverage, quality and disagreement evidence
- model and agent versions

After settlement, the same row is updated only with:

- result
- closing odds
- CLV
- virtual profit
- settlement timestamp

Decision-time provenance is not replaced after the event. This prevents closing-line or outcome leakage into the original observation.

## Learning cycle

The protected worker is:

```text
GET /api/internal/shadow-learning
Authorization: Bearer <CRON_SECRET>
```

The worker:

1. claims due users with a bounded database lease
2. loads chronological settled paper samples
3. trains a challenger on the earlier sample
4. evaluates it on an untouched chronological holdout
5. measures Brier score, log loss, calibration, drift, ROI, CLV and drawdown
6. stores the cycle and marks a challenger as review-ready only when every gate passes

## Promotion gates

A challenger cannot even become review-ready until it has:

- at least 300 settled win/loss observations
- at least 100 closing-odds observations
- positive average CLV
- at least 52% positive CLV observations
- a successful chronological calibration holdout
- no warning or critical drift
- drawdown within the configured research limit

Review-ready is not production approval. Automatic model promotion is permanently disabled in this layer.

## Production activation

Apply migrations in order, including:

```text
supabase/scorecaster_autonomous_agent.sql
supabase/scorecaster_autonomous_agent_v2.sql
supabase/scorecaster_shadow_learning_v1.sql
```

Configure server-only values:

```text
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
CRON_SECRET
SCORECASTER_SHADOW_LEARNING_ENABLED=true
```

Keep `SCORECASTER_SHADOW_LEARNING_ENABLED=false` until:

- the migration and backfill complete successfully
- two-user RLS isolation is verified
- settlement updates preserve the original decision snapshot
- the protected endpoint returns a successful empty or collecting-evidence cycle
- external scheduling uses the same strong `CRON_SECRET`

## Safety boundary

- virtual paper tracking only
- no bookmaker login or API execution
- no deposits, withdrawals or payment data
- context can only preserve or downgrade a production decision
- shadow calibration is never applied automatically
- real-money execution columns are constrained to `false`
