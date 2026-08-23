# Autonomous Scorecaster V13

Autonomous Scorecaster V13 combines the broad V12 Mission Control and circuit-breaker layer with the candidate-level governance introduced by Autonomous Paper Agent V2.

## Layered autonomy

### V12 Mission Control

V12 remains responsible for the highest-level autonomy state:

- `BOOTSTRAP`
- `GUARDED`
- `ACTIVE`
- `DEGRADED`
- `FROZEN`

It monitors chronology-safe settled history, CLV, drawdown, rolling losses, losing streaks, model drift, provider readiness and open portfolio exposure. Critical drift or circuit-breaker conditions can freeze a user before the normal worker claim.

### V13 candidate governance

After V12 preflight, V13 evaluates every candidate with:

- active Decision Diagnostics incidents
- active Unified Sports Data incidents
- provider availability and disagreement
- verified Unified Data coverage
- provider-verified fixture identity
- data-driven PLAY-to-CAUTION downgrades
- user odds and priority limits
- bankroll edge and confidence limits
- pre-start timing window
- duplicate event exposure
- open portfolio and league exposure
- user-specific drawdown, daily loss, ROI, CLV and loss-streak limits

Only a PLAY that passes both layers may be stored as a virtual paper selection.

## Audit and explainability

Each candidate creates an `autonomous_agent_decision_audit` row containing:

- allowed or blocked state
- explicit reason codes and warnings
- quality and priority scores
- odds, edge and confidence
- verified data coverage
- provider count and disagreement
- bounded context impact
- minutes before event start
- proposed virtual stake
- saved paper-bet reference when accepted

The Agent also writes one daily brief per user with cycle totals, health, performance evidence, common blocking reasons and shadow-learning status.

## Safety cooldown

V13 can pause a user after:

- maximum drawdown
- maximum rolling 24-hour virtual loss
- configured consecutive-loss streak
- persistent negative CLV after sufficient sample
- persistent negative ROI after sufficient sample
- critical model drift
- high-severity provider or data incidents
- excessive open paper exposure

The database claim function excludes users whose `paused_until` is still active. Manual run requests cannot bypass the cooldown.

## Emergency stop

Web and native mobile governance consoles provide an emergency stop. It disables the user's opt-in, which prevents the next worker claim from creating new paper exposure.

## Adaptive cadence

The protected scheduler remains frequent, but the database controls the actual per-user cadence:

- approximately 60 minutes after a saved selection
- approximately 120 minutes when candidates exist but none pass
- approximately 180 minutes when no candidates exist
- approximately 60 minutes after a recoverable worker error
- the configured cooldown after a safety pause

## Product boundary

V13 is permanently paper-only:

- no deposits or withdrawals
- no payment data
- no bookmaker credentials
- no bookmaker account connection
- no automated real-money execution

Published probability remains the no-vig market consensus. Context and learning cannot upgrade CAUTION or SKIP to PLAY. Shadow learning cannot automatically change production probability, edge or EV.

## Production activation

1. Apply all 28 migrations from `config/release-readiness.json` in order.
2. Verify `scorecaster_autonomous_agent_v2.sql` precedes V13 hard caps, risk profile, Shadow Learning and the Shadow Candidate chain; the function-ACL hardening migration must remain final.
3. Configure the existing Supabase admin, odds-provider and protected worker secrets.
4. Run production schema verification.
5. Run protected worker probes.
6. Verify two-user RLS isolation for settings, state, runs, audits and briefs.
7. Verify V12 freeze and V13 cooldown scenarios with controlled paper accounts.
8. Verify provider, all-SKIP, stale-data and weak-coverage incident pauses.
9. Verify web, iOS and Android emergency stop before the next worker claim.
10. Confirm every saved V13 paper bet has a matching allowed audit row.
11. Confirm blocked audits never have a saved bet reference.
12. Confirm account export and deletion cover all V13 records.

V13 does not self-promote a learned model. Any future champion/challenger promotion requires a separately reviewed release based on untouched chronology-safe holdout evidence.
