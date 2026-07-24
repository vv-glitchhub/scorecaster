# Scorecaster Shadow Learning V1

Shadow Learning V1 turns settled Autonomous Scorecaster V13 virtual paper decisions into an auditable research dataset. It never changes the production probability, upgrades CAUTION or SKIP to PLAY, promotes a model automatically or executes a real-money bet.

## Decision-time storage

For each governed paper PLAY, a database trigger stores an immutable snapshot containing:

- original and selected model probabilities
- market probability, edge, EV, odds and virtual stake
- decision and reasons
- used and missing data sources
- lineup, injury, rest, travel, weather and other context signals when present
- provider quality, counterarguments, blockers and risk-governor evidence
- model and agent versions
- the V13 hard-cap and daily-governor context that allowed the paper action

After settlement, only result fields are appended:

- result
- closing odds
- CLV
- virtual profit
- settlement timestamp

Decision-time provenance is not rewritten after the event. This prevents closing-line and outcome leakage into the original observation.

V13 keeps SKIP and CAUTION candidates in its run audit. The learning evaluator uses only settled PLAY observations because those have an unambiguous virtual stake, closing line and result label. No synthetic win/loss labels are created for skipped candidates.

## Learning cycle

The protected worker is:

```text
GET /api/internal/shadow-learning
Authorization: Bearer <CRON_SECRET>
```

It claims due users with a bounded lease, loads chronological settled samples, trains a challenger on the earlier period and evaluates it on an untouched chronological holdout. The cycle stores Brier score, log loss, calibration, drift, ROI, CLV, drawdown and sport, market and model segments.

The repository workflow starts Shadow Learning only after the settlement job. The workflow can wake every 15 minutes, while database state limits each user to a bounded daily evaluation.

## Promotion gates

A challenger cannot become review-ready until it has:

- at least 300 settled win/loss observations
- at least 100 closing-odds observations
- positive average CLV
- at least 52% positive CLV observations
- a successful chronological calibration holdout
- no warning or critical drift
- drawdown within the research limit

Review-ready is only a research recommendation. Automatic promotion remains disabled in code and constrained to `false` in the database.

## Production activation

Apply the reviewed migrations in order, ending with:

```text
supabase/scorecaster_settlement_monitor.sql
supabase/scorecaster_autonomous_agent.sql
supabase/scorecaster_autonomous_agent_v2.sql
supabase/scorecaster_autonomous_v13_hard_caps.sql
supabase/scorecaster_shadow_learning_v1.sql
```

Configure server-only values:

```text
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
CRON_SECRET
SCORECASTER_SHADOW_LEARNING_ENABLED=true
```

Keep the enable flag false until migration and backfill succeed, V13 hard-cap verification passes, two-user RLS isolation passes, settlement updates preserve the immutable snapshot and the protected worker probe completes successfully.

## User data controls

Samples, state and cycles are user-isolated through forced RLS, included in the authenticated account export and deleted with the Scorecaster account.

## Safety boundary

- virtual paper tracking only
- V13 database hard caps remain active before any sample is created
- no bookmaker login or bet execution
- no deposits, withdrawals or payment data
- context remains downgrade-only
- production probability remains unchanged
- automatic model promotion is disabled
- real-money execution columns are constrained to `false`
