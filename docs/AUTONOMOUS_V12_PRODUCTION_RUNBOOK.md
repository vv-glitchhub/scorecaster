# Autonomous Scorecaster V12 Production Runbook

This runbook activates and verifies Autonomous Scorecaster V12 without enabling real-money execution.

## Product boundary

V12 is allowed to:

- read verified sports and market data
- make PLAY, WATCH and SKIP decisions
- create user-owned virtual paper positions
- enforce virtual-bankroll limits
- settle paper positions
- collect closing-line, CLV and calibration evidence
- reduce or stop its own paper exposure

V12 is not allowed to:

- sign in to a bookmaker
- place a real-money wager
- handle deposits, cards or payment credentials
- increase a stake above the existing conservative recommendation
- upgrade WATCH, CAUTION or SKIP to PLAY
- promote a challenger model automatically

## Required migrations

Apply the full reviewed migration list from:

```text
config/release-readiness.json
```

The Autonomous Agent depends on at least:

```text
supabase/scorecaster_schema.sql
supabase/scorecaster_auth_cloud.sql
supabase/scorecaster_paper_risk_limits.sql
supabase/scorecaster_unified_data.sql
supabase/scorecaster_settlement_monitor.sql
supabase/scorecaster_autonomous_agent.sql
```

Run the production activation schema verification after migration.

## Required server configuration

Vercel production environment:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
ODDS_API_KEY
CRON_SECRET
SCORECASTER_AUTONOMOUS_AGENT_ENABLED=true
```

GitHub Actions production environment:

```text
SCORECASTER_CRON_SECRET
SCORECASTER_NOTIFICATION_DELIVERY_URL
SCORECASTER_AUTONOMOUS_AGENT_ENABLED=true
```

The cron values in Vercel and GitHub must match. Keep all service-role, provider and cron credentials server-only.

## Optional data providers

Full V12 data readiness improves when Unified Sports Data providers are active:

```text
SPORTSGAMEODDS_API_KEY
SPORTSGAMEODDS_LEAGUE_MAP_JSON
SPORTSDATA_API_KEY
LINEUP_API_URL
LINEUP_API_KEY
SPORTS_CONTEXT_API_URL
SPORTS_CONTEXT_API_KEY
NEWS_API_KEY
NEWS_SOURCE_TRUST_JSON
VENUE_COORDINATES_JSON
```

Missing optional providers must remain visible as missing-data states. They must never be replaced with generated facts.

## Activation order

1. Verify all migrations and RLS policies.
2. Verify the paper-risk database triggers.
3. Verify settlement and Unified Data capture workers.
4. Configure the Autonomous Agent server variables.
5. Keep `SCORECASTER_AUTONOMOUS_AGENT_ENABLED` false initially.
6. Create two isolated production test users.
7. Configure a 1,000 euro virtual bankroll for each test user.
8. Enable Autonomous Agent only for the first test user.
9. Turn on the GitHub Actions production variable.
10. Run one manual Background Workers workflow cycle.
11. Inspect Mission Control, the paper portfolio and the worker run journal.
12. Enable the second user only after isolation is proven.

## Normal-cycle verification

A successful protected cycle should prove:

- the worker identifies itself as `autonomous-scorecaster-v12`
- the user is opted in
- paper mode is active
- current Top Picks are verified
- each candidate has a Unified Sports Data ledger
- V12 returns one of the five documented modes
- the mode stake multiplier never exceeds 1.00
- the mode pick cap is enforced
- only PLAY decisions with positive final paper stake are saved
- one event cannot create multiple open autonomous positions
- database exposure limits remain authoritative
- the run summary contains `Autonomous-Scorecaster-V12`
- the run summary contains `autonomyV12` and `autonomyJournal`
- no probability was changed by V12
- `realMoneyBetting` remains false

## Circuit-breaker drills

Use controlled paper-only test data.

### Critical model drift

Expected:

- mode `FROZEN`
- blocker `critical_model_drift`
- zero new paper stake
- deferred run journal
- next check delayed by six hours

### Five-loss streak

Expected within 24 hours of the latest settled loss:

- mode `FROZEN`
- blocker `loss_streak_cooldown`
- zero new paper stake
- next check delayed by 24 hours

Expected after the cooldown:

- the hard blocker clears
- remaining loss or drawdown warnings keep the system conservative
- no permanent lock remains

### Rolling loss limit

Expected when the latest 30 settled observations reduce the virtual bankroll by at least six percent and the latest settlement is under 24 hours old:

- mode `FROZEN`
- blocker `rolling_loss_limit`
- zero new paper stake

After 24 hours, the hard block becomes a recovery warning and the system is reassessed under guarded controls.

### Missing Unified Data ledger

Expected for a PLAY candidate:

- candidate becomes WATCH
- final stake is zero
- blocker `autonomy:missing_unified_ledger`

### Verified coverage below 40 percent

Expected:

- candidate becomes WATCH
- final stake is zero
- blocker `autonomy:verified_coverage_below_40pct`

### Verified contextual downgrade

Expected:

- candidate becomes WATCH
- final stake is zero
- blocker `autonomy:verified_context_downgrade`

### Mode pick cap

Expected in BOOTSTRAP:

- first qualifying PLAY may remain PLAY with reduced stake
- later qualifying PLAY candidates become WATCH
- blocker `autonomy:mode_pick_cap`

## Mission Control parity

For the same authenticated test account, compare web and native mobile:

- autonomy mode
- reason
- blockers and warnings
- stake multiplier
- pick cap
- settled sample
- ROI and average CLV
- maximum drawdown
- current losing streak
- verified data coverage
- multi-provider rate
- model-lab status and drift
- open paper exposure
- recent worker runs

Values should describe the same underlying account state.

## Rollback

To stop autonomous paper creation immediately:

1. set `SCORECASTER_AUTONOMOUS_AGENT_ENABLED=false` in GitHub Actions
2. disable the Autonomous Agent setting for affected users
3. keep settlement enabled so existing open paper positions can resolve
4. preserve run journals and paper history for audit
5. do not delete evidence needed to diagnose the incident

A code rollback is not required to stop new cycles because the worker is externally opt-in and user opt-in.

## Ongoing monitoring

Review daily:

- active autonomy modes
- FROZEN and DEGRADED counts
- worker failures
- provider incidents
- stale-data incidents
- average CLV
- rolling ROI
- maximum drawdown
- critical or warning model drift
- duplicate and database-risk rejections

Review before any future model promotion:

- at least 120 settled probability observations
- chronological holdout evidence
- Brier and log-loss improvement
- calibration-gap stability
- no critical drift
- provider coverage stability
- positive or non-adverse closing-line evidence
- explicit human approval
