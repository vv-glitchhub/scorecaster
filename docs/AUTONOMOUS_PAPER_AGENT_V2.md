# Autonomous Paper Agent V2

Autonomous Paper Agent V2 is Scorecaster's governed, opt-in, paper-only portfolio agent. It can continuously review verified selections and save virtual paper picks, but it cannot access bookmaker accounts, move money or place real-money bets.

## Core behavior

Each worker cycle:

1. Claims only users who explicitly enabled the Agent and whose adaptive `next_check_at` is due.
2. Loads the user's virtual bankroll, paper-risk limits, open exposure and resolved paper history.
3. Reads active Decision Diagnostics and Unified Sports Data incidents.
4. Builds the V9/V11 shadow-governed candidate portfolio from verified Top Picks.
5. Evaluates every candidate through the V2 performance, system, data, timing and user-risk gates.
6. Stores an allowed or blocked audit row for every evaluated candidate.
7. Saves only permitted PLAY selections as deterministic paper bets.
8. Writes a daily autonomous brief and schedules the next adaptive check.

## Immutable product boundary

- Paper-only virtual tracking.
- No deposits, withdrawals, cards, bank details or bookmaker credentials.
- No bookmaker account connection or automated real-money execution.
- Published probability remains the no-vig market consensus.
- Context and learning cannot upgrade CAUTION or SKIP to PLAY.
- Verified negative context may only downgrade PLAY to CAUTION.
- Shadow learning cannot automatically change production probability, edge, EV or stake logic.

## Performance guard

The performance guard calculates:

- settled sample size
- paper P/L and ROI
- maximum drawdown
- rolling 24-hour loss as a percentage of virtual bankroll
- consecutive loss streak
- average CLV and positive-CLV rate

Possible states:

- `learning`: small sample; stake multiplier is reduced
- `healthy`: normal bounded paper operation
- `watch`: deteriorating ROI or CLV; stake multiplier is reduced
- `paused`: hard guard reached; no paper selection is saved until cooldown ends

Hard pause conditions include configured maximum drawdown, daily loss, loss streak, persistent negative CLV or persistent negative ROI after sufficient sample size.

## System guard

The Agent can pause automatically when shared operations report:

- provider outage or blocked provider health
- all-SKIP decision flow
- stale data
- weak Unified Data coverage
- high-severity Decision Diagnostics or Unified Data incidents
- critical V11 model drift
- maximum open paper-pick limit

## Candidate data gates

Each candidate must pass:

- final decision is PLAY
- provider-verified fixture
- no Unified Data PLAY-to-CAUTION downgrade
- required Unified Sports Data ledger exists
- verified data-family coverage meets the user's minimum
- independent odds-provider count meets the user's minimum
- provider disagreement stays below the user's maximum
- event is inside the configured pre-start window
- event is not already exposed in the open paper portfolio
- odds, edge, confidence and priority meet user and bankroll limits
- paper-only boundary is present

## Adaptive cadence

GitHub Actions invokes the protected worker on the existing frequent schedule, but the database controls the real per-user cadence:

- about 60 minutes after saved paper selections
- about 120 minutes when candidates exist but none is saved
- about 180 minutes when no candidate exists
- about 60 minutes after a recoverable worker error
- configured cooldown after performance or system pause

This limits provider usage while remaining responsive to changing markets.

## Database migration

Apply after Autonomous Agent V1:

```text
supabase/scorecaster_autonomous_agent_v2.sql
```

New tables:

- `autonomous_agent_decision_audit`
- `autonomous_agent_daily_briefs`

Extended tables:

- `autonomous_agent_settings`
- `autonomous_agent_state`
- `autonomous_agent_runs`

All user data is RLS-isolated. Authenticated users can read only their own audits and briefs. Writes are reserved for the service-role worker. Account export includes the V2 records, and account deletion removes them before deleting the auth user.

## Web console

`/autonomous-agent` includes:

- readiness and active blockers
- health score, ROI, CLV, drawdown and loss streak
- explicit user opt-in
- emergency stop
- data/provider and performance thresholds
- adaptive cadence and shadow-learning controls
- selected sports and leagues
- daily autonomous brief
- candidate-level allowed/blocked audit
- recent worker cycles

## Native mobile console

`More -> Autonomous Paper Agent` includes:

- readiness and health
- opt-in, save, queue-run and emergency-stop controls
- Safe, Standard and Very Strict governance presets
- daily brief
- candidate audit
- recent cycles

## Production activation

1. Apply all migrations in `config/release-readiness.json` in order.
2. Configure `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ODDS_API_KEY` and a strong `CRON_SECRET` in Vercel.
3. Configure the same worker URL and secret in GitHub Actions.
4. Set `SCORECASTER_AUTONOMOUS_AGENT_ENABLED=true` only after schema verification.
5. Run Production Activation `schema` and `probe` actions.
6. Create two isolated paper accounts and verify RLS, settings, state, audits and briefs.
7. Verify a controlled provider incident pauses both accounts without writing a bet.
8. Verify drawdown, daily-loss and loss-streak cooldowns with controlled paper history.
9. Verify emergency stop from web, iOS and Android before the next worker cycle.
10. Confirm all saved rows use `scorecaster-autonomous-v2`, remain paper-only and have a matching allowed audit row.
11. Confirm blocked candidates have explicit reasons and no saved bet ID.
12. Confirm account export and deletion include all V2 records.

## Promotion policy

V2 remains shadow-learning only. A future model candidate may be considered for production only through a separately reviewed champion/challenger release after sufficient chronology-safe holdout data, calibration, Brier score, CLV, ROI, drawdown and league-segment evidence. V2 never promotes itself.
