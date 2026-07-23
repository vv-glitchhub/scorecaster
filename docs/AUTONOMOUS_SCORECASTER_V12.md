# Autonomous Scorecaster V12

Autonomous Scorecaster V12 is Scorecaster's closed-loop virtual paper agent. It observes verified markets and contextual evidence, makes bounded paper-only decisions, stores a complete audit, waits for settlement, measures performance and tightens risk when evidence deteriorates.

It never logs into a bookmaker, handles deposits, moves money or places a real-money bet.

## Closed loop

V12 repeatedly performs this sequence:

1. **Observe**
   - load verified Top Picks
   - read Unified Sports Data coverage and provider health
   - read Decision Diagnostics freshness and incidents
   - read the user's virtual bankroll, open exposure and settled paper history
2. **Evaluate**
   - calculate ROI, CLV, positive-CLV rate, Brier score, log loss and calibration error
   - calculate maximum drawdown and current loss streak
   - evaluate provider, stale-data, settlement and learning-drift circuit breakers
3. **Decide**
   - accept only an existing verified `PLAY`
   - reject stale, unverified, low-coverage, low-confidence or non-positive-EV candidates
   - preserve one selection per event and user-defined sport/odds limits
4. **Size virtual risk**
   - use bounded fractional Kelly
   - enforce the user's single-pick, daily-exposure and league-exposure caps
   - apply stricter V12 policy when evidence is weak
5. **Paper-save**
   - store the virtual selection in the existing `bets` table
   - let database paper-risk triggers validate the stake again
   - prevent duplicate daily event decisions
6. **Settle**
   - use the existing protected Settlement Monitor
   - record result, closing odds and CLV
7. **Learn in shadow mode**
   - update performance and calibration reports
   - compare the market-consensus champion against a strict-evidence challenger
   - allow only a shadow-champion status after minimum evidence gates
8. **Repeat**
   - choose a bounded next check interval
   - stop or reduce risk whenever a circuit breaker fires

## Permanent safety boundaries

- Published probability remains the no-vig market consensus.
- V12 cannot upgrade `CAUTION` or `SKIP` to `PLAY`.
- Contextual evidence may only downgrade risk.
- Automatic policy changes may only tighten risk.
- Shadow learning cannot automatically change production probability, edge, EV or stake logic.
- Closing odds and outcomes are post-event learning data only.
- The database rechecks paper stake and exposure limits before every save.
- All autonomous actions are virtual paper actions.
- Real-money betting is always false.

## Autonomy levels

### Observe

- calculates learning, calibration and risk state
- produces audit rows
- saves no paper selections

### Conservative

- at most one new paper selection per cycle/day policy
- smaller virtual stake and exposure
- higher evidence and confidence requirements

### Balanced

- uses the full V12 selection pipeline
- remains inside user limits and all circuit breakers
- still cannot relax risk beyond the user's settings

## Circuit breakers

V12 pauses itself when one or more critical conditions are true:

- manual kill switch
- paper mode disabled
- primary odds provider unavailable
- Top Picks unavailable
- provider health critical or unverifiable
- stale or unverifiable market data
- stale or unverifiable Unified Data capture
- critical settlement backlog
- critical learning drift
- daily virtual loss stop
- maximum loss streak
- maximum drawdown

The persisted user values for daily loss, drawdown and loss streak are authoritative inside their reviewed allowed ranges. Default-engine values are removed and rebuilt from the user's controls on every cycle, so a saved control is never merely cosmetic.

Watch conditions place V12 in `CAUTION` and reduce risk instead of fully stopping it.

## Champion–challenger governance

The production champion is always:

```text
market-consensus-safety-champion
probability source: no-vig market consensus
```

The challenger is:

```text
strict-evidence-shadow-challenger
mode: shadow-only
```

Minimum shadow-champion evidence:

- 200 settled paper selections
- 120 CLV observations
- 120 probability/outcome observations
- non-negative average CLV
- Brier score at most 0.25
- expected calibration error at most 0.06

Passing these gates does not promote the challenger into production automatically. It only marks it eligible for reviewed shadow-champion status.

## Storage

Run after the existing Autonomous Agent migration:

```text
supabase/scorecaster_autonomous_v12.sql
```

The migration creates:

- `autonomous_agent_v12_controls`
- `autonomous_agent_v12_state`
- `autonomous_agent_v12_learning_cycles`
- `autonomous_agent_v12_audit`

All tables use forced RLS:

- users manage only their own controls
- users read only their own state, learning and audit
- only `service_role` writes runtime state, learning cycles and audit rows
- anonymous access is revoked

Learning-cycle retention is bounded by the protected `trim_autonomous_v12_learning_cycles` function.

## Verified health contract

V12 consumes stable health fields from `/api/data-layer/health`:

```text
migrationActive
captureFresh
captureAgeMinutes
```

The same values remain available in the detailed `storage` and `worker` objects. Provider score, market stale rate and capture age must all be numeric before a virtual paper selection can be saved. Missing health values are interpreted as unverified and pause V12 instead of being treated as healthy.

## Privacy, export and deletion

V12 stores only virtual-paper operations and model-audit data. It stores no payment credentials, bookmaker passwords or real-money balances.

The authenticated account export includes:

- V12 controls
- runtime state and effective policy
- learning cycles and calibration summaries
- decision audit rows
- ordinary autonomous run history and virtual paper bets

Account deletion removes the four V12 user tables before deleting the profile and authentication account. Operations monitoring exposes only the authenticated user's V12 state and aggregate activity counts.

## Protected worker

Endpoint:

```text
GET /api/internal/autonomous-v12
Authorization: Bearer <CRON_SECRET>
```

The existing background workflow calls the endpoint every 15 minutes when:

```text
SCORECASTER_AUTONOMOUS_AGENT_ENABLED=true
```

The database lease and dynamic `next_check_at` value prevent every user from being processed on every scheduler tick.

## Web and native controls

Web:

```text
/autonomous-agent
```

Native mobile:

```text
More -> Autonomous Scorecaster V12
```

Both surfaces show:

- operating state
- ROI, CLV, Brier and settled sample
- effective risk policy
- circuit-breaker reasons and warnings
- champion–challenger state
- kill switch and autonomy level
- decision audit for every `PLAY`, `SKIP` and `PAUSE`

## Production activation

1. Apply all migrations in `config/release-readiness.json` in order.
2. Configure the production Supabase URL and service-role key in Vercel.
3. Configure the same strong worker secret in Vercel and GitHub Actions.
4. Configure the primary odds provider.
5. Verify `/api/data-layer/health` returns an active migration, fresh capture and numeric capture age.
6. Set the GitHub variable `SCORECASTER_AUTONOMOUS_AGENT_ENABLED=true` only after schema verification.
7. Run Production Activation action `schema`.
8. Run Production Activation action `probe`.
9. Enable V12 for one test user in `observe` mode.
10. Verify multiple worker, settlement and Unified Data capture cycles.
11. Switch the test user to `conservative` mode and verify a virtual paper save.
12. Trigger every circuit breaker with controlled test data.
13. Verify two-user RLS isolation, account export and account deletion on web and mobile.
14. Keep real-money integrations absent.

## Required environment and GitHub configuration

Server-side environment:

```text
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
ODDS_API_KEY
CRON_SECRET
SCORECASTER_AUTONOMOUS_AGENT_ENABLED=true
```

GitHub Actions:

```text
SCORECASTER_NOTIFICATION_DELIVERY_URL
SCORECASTER_CRON_SECRET
SCORECASTER_AUTONOMOUS_AGENT_ENABLED=true
```

Optional Unified Sports Data providers improve evidence coverage but are not replaced with invented data when unavailable.

## Validation gates

Required automated checks include:

- Autonomous V12 learning metrics
- circuit-breaker behavior and user-owned limits
- fail-closed provider, market-freshness and capture health
- tightening-only policy
- no decision upgrades
- event duplicate prevention
- Kelly and exposure caps
- shadow-only champion–challenger governance
- forced RLS and service-role write checks
- account export and deletion coverage
- protected worker authorization
- web and native control centers
- full Scorecaster regression suite
- mobile TypeScript
- Next.js production build
- Polymarket downgrade-only regression
- CodeQL
- Vercel preview and production deployment
