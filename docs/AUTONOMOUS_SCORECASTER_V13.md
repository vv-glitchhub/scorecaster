# Autonomous Scorecaster V13 — Integrated Governance

Autonomous Scorecaster V13 adds database-enforced governance around the existing V12 Mission Control and persistent daily risk governor. It remains a virtual paper-tracking system. It cannot connect to bookmaker accounts, accept deposits or place real-money bets.

## Authoritative decision chain

Every protected cycle follows one ordered chain:

1. V12 user preflight
   - virtual bankroll and paper mode
   - critical model drift
   - recent rolling losses
   - loss-streak cooldown
2. V13 system guard
   - provider outages
   - stale-data incidents
   - all-SKIP incidents
   - weak Unified Data coverage
   - high-severity Decision Diagnostics incidents
3. V13 performance guard
   - maximum drawdown
   - 24-hour virtual loss
   - consecutive losses
   - persistent negative ROI
   - persistent negative CLV
4. V11/V12 candidate model governance
   - chronological champion/challenger lab
   - untouched holdout
   - no automatic model promotion
5. V13 candidate audit
   - verified fixture
   - event-time window
   - Unified Sports Data ledger
   - minimum verified coverage
   - provider count
   - provider disagreement
   - contextual downgrade
   - odds, edge, confidence and priority
6. Persistent UTC daily governor
   - daily selection quota across every worker cycle
   - same-event daily block
   - daily virtual-stake budget
7. Hard system caps
   - at most 1 percent of bankroll per PLAY
   - at most 5 percent total daily/open exposure
   - at most 2.5 percent exposure per league
8. Database risk triggers
   - user isolation
   - stake and exposure enforcement
   - one open paper position per event

No later layer can bypass an earlier blocker.

## V13 storage

Migration:

```text
supabase/scorecaster_autonomous_agent_v2.sql
```

Run it immediately after:

```text
supabase/scorecaster_autonomous_agent.sql
```

It creates:

### `autonomous_agent_decision_audit`

One RLS-isolated row for every evaluated candidate:

- allowed or blocked
- exact blocking reasons and warnings
- event, selection, sport and league
- quality and priority scores
- odds, edge and confidence
- data coverage and provider count
- provider disagreement
- context impact
- minutes before event start
- proposed virtual stake
- saved paper-bet reference when applicable

Authenticated users can read only their own audit. Only the service-role worker can write.

### `autonomous_agent_daily_briefs`

One RLS-isolated brief per user and UTC day:

- system and performance health
- candidate, allowed, blocked and saved counts
- total virtual stake
- common blocking reasons
- ROI and CLV learning summary
- explicit shadow-only and paper-only boundaries

## Database cooldown

V13 extends `autonomous_agent_state` with:

- `paused_until`
- `pause_reason`
- `health_status`
- `health_score`
- resolved sample
- loss streak
- drawdown
- ROI
- average CLV
- latest daily brief

The database claim function refuses users whose `paused_until` is still in the future. Manual run requests are also denied while paused.

## Adaptive cadence

The next protected check is persisted by the database:

- saved paper selection: normally 60 minutes
- candidates but no save: normally 120 minutes
- no candidates: normally 180 minutes
- source error: normally 60 minutes
- system or performance pause: configured cooldown, at least 60 minutes

The external GitHub scheduler may call the protected endpoint every 15 minutes, but the database decides whether each user is due.

## Emergency stop

Authenticated API:

```text
DELETE /api/cloud/autonomous-agent
```

The emergency stop:

- disables the user's autonomous settings
- clears the active lease
- applies a seven-day database pause
- blocks new autonomous paper exposure
- preserves paper history, candidate audits and daily briefs
- preserves existing open paper positions for normal settlement

It does not delete evidence and does not affect another user.

## Mission Control

Web:

```text
/mission-control
```

Native:

```text
More -> Autonomous V13 Governance
```

V13 displays:

- enabled or stopped state
- health status and score
- database pause and reason
- adaptive next-check interval
- resolved sample, ROI and CLV
- consecutive losses
- latest daily brief
- allowed and blocked candidate counts
- common blocking reasons
- latest candidate audit rows
- emergency stop

## Learning boundary

V13 can collect and summarize:

- resolved paper outcomes
- ROI and drawdown
- closing-line and CLV evidence
- Brier score and calibration gap
- provider availability and disagreement
- candidate blocking reasons

Learning remains shadow-only. V13 does not:

- replace the no-vig market probability
- change edge or EV using post-event data
- promote a challenger automatically
- upgrade WATCH, CAUTION or SKIP to PLAY
- increase the original conservative paper stake

## Production activation

1. Apply all 15 migrations from `config/release-readiness.json`.
2. Run `scripts/verify-production-schema.sql`.
3. Run `scripts/verify-autonomous-v13-schema.sql`.
4. Verify two-user RLS isolation for audit and briefs.
5. Verify authenticated users cannot write audit or brief rows.
6. Verify service role can run `complete_autonomous_agent_user_v2`.
7. Verify active cooldown prevents database claim and manual request.
8. Trigger controlled provider and all-SKIP incidents and confirm no new paper exposure.
9. Trigger a controlled drawdown/loss-streak pause.
10. Verify a healthy candidate passes every layer and respects the 1% / 5% / 2.5% caps.
11. Compare V13 values on web and native mobile for the same account.
12. Verify emergency stop preserves history and open-position settlement.

## Production requirements

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
ODDS_API_KEY
CRON_SECRET
SCORECASTER_AUTONOMOUS_AGENT_ENABLED=true
```

Full candidate quality also depends on the reviewed Unified Sports Data provider configuration.

## Rollback

To stop all new autonomous paper cycles immediately:

1. set `SCORECASTER_AUTONOMOUS_AGENT_ENABLED=false` in GitHub Actions
2. use the per-user emergency stop
3. keep settlement and evidence storage enabled
4. preserve run summaries, audits and briefs
5. diagnose the incident before re-enabling the worker
