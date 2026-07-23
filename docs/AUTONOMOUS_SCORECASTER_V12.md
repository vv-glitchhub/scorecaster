# Autonomous Scorecaster V12

Autonomous Scorecaster V12 upgrades the existing opt-in paper agent into an auditable autonomy control system. It remains a sports-analysis and virtual paper-tracking product. It does not connect to bookmaker accounts, handle deposits or place real-money bets.

## What V12 adds

- five explicit autonomy modes: `ACTIVE`, `GUARDED`, `BOOTSTRAP`, `DEGRADED` and `FROZEN`
- user-level preflight circuit breakers before the database claim phase
- candidate-level unified-data gates before any paper stake is saved
- rolling loss, drawdown, losing-streak and model-drift protection
- evidence-aware stake multipliers and daily pick caps
- Mission Control on web and native mobile
- a daily autonomy brief with proof metrics and resume conditions
- audited worker-run journals stored in the existing `autonomous_agent_runs.summary`
- champion/challenger and chronological holdout visibility
- current-candidate inspection with verified coverage, provider count and safety action

## Autonomy modes

### `ACTIVE`

Requirements include a mature settled sample, stable model lab, healthy current data readiness and no active risk warnings.

- stake multiplier: `1.00x`
- maximum new selections per cycle: 3

### `GUARDED`

Used when the system is operational but the settled sample, CLV, drawdown, drift or provider evidence still requires caution.

- stake multiplier: `0.50x`
- maximum new selections per cycle: 2

### `BOOTSTRAP`

Used while collecting the first 30 settled observations.

- stake multiplier: `0.25x`
- maximum new selections per cycle: 1

### `DEGRADED`

Used when unified-data availability is incomplete but not yet a hard failure.

- stake multiplier: `0.20x`
- maximum new selections per cycle: 1
- multi-provider odds evidence is required

### `FROZEN`

No new paper exposure is allowed. Examples:

- critical model drift
- inactive virtual bankroll or paper mode
- critical verified-data coverage failure
- rolling losses beyond the hard bankroll threshold
- a five-loss streak still inside the 24-hour cooldown

- stake multiplier: `0.00x`
- maximum new selections: 0

## Two-stage safety

### 1. User preflight

`lib/autonomous-scorecaster-v12-runner.js` evaluates due users before `claim_autonomous_agent_users` is called.

It loads:

- virtual bankroll and database risk settings
- settled paper history
- open paper exposure
- model-lab report
- rolling profit, ROI, CLV, drawdown and losing streak

A frozen user is deferred before the original worker can claim the row. The reason, cooldown and V12 journal are recorded in `autonomous_agent_runs` and `autonomous_agent_state`.

### 2. Candidate governance

`lib/agent-model-governance.mjs` applies V12 to every portfolio decision before the existing user thresholds and database risk limits.

A PLAY can be blocked or reduced when:

- the unified-data ledger is missing
- verified coverage is below 40 percent
- verified contextual evidence requests a downgrade
- the current mode requires a second odds provider and only one is available
- many data families are missing

Context and autonomy never upgrade WATCH, CAUTION or SKIP into PLAY.

## Stake sizing

The final V12 multiplier combines:

1. autonomy-mode multiplier
2. independent odds-provider multiplier
3. verified-coverage multiplier

The result only reduces the existing conservative suggested stake. It cannot increase the original stake, bypass the user's risk settings or bypass database triggers.

The existing limits still apply afterward:

- per-pick percentage cap
- total open paper exposure cap
- single-league cap
- one selection per event
- user daily pick limit
- database stake and exposure constraints

## Learning and model governance

V12 uses the existing V11 model lab:

- chronological train/holdout split
- challenger selected on training data only
- untouched holdout evaluation
- Brier score, log loss and calibration gap
- drift detection
- no automatic production probability changes

Mission Control shows:

- model-lab status
- sample size and minimum sample
- challenger identifier
- drift status
- promotion reasons

A `promotion-ready` challenger still remains shadow-only. V12 does not automatically approve or deploy a new calibrator.

## Mission Control API

Authenticated endpoint:

```text
GET /api/cloud/autonomy-mission-control
```

It returns:

- current autonomy mode and reason
- blockers, warnings and resume conditions
- settled performance, ROI, CLV and drawdown
- current unified-data readiness
- current Top Picks candidates
- open paper positions
- model-lab report
- worker state and recent runs
- a concise daily brief

The endpoint is rate-limited and user-isolated through the existing authenticated Supabase client. It does not return service-role credentials, provider keys or another user's rows.

## User interfaces

### Web

```text
/mission-control
```

The existing `/autonomous-agent` page links directly to Mission Control.

### Native mobile

```text
More -> Autonomous Mission Control
```

The native screen contains the same core state:

- autonomy mode
- new-exposure permission
- stake multiplier and pick cap
- ROI, CLV, drawdown and losing streak
- provider readiness
- circuit breakers
- model lab
- current candidates
- recent worker cycles

## Worker flow

The existing protected worker remains:

```text
GET /api/internal/autonomous-agent
Authorization: Bearer <CRON_SECRET>
```

The route now executes `runAutonomousScorecasterV12`.

Flow:

1. inspect due users with V12 preflight
2. defer frozen users before claim
3. run the original bounded autonomous paper agent for eligible users
4. apply candidate-level V12 governance through the model-governance layer
5. save only decisions that still pass all user and database limits
6. enrich recent run summaries with the V12 autonomy journal

The shared background workflow calls this protected endpoint every 15 minutes when `SCORECASTER_AUTONOMOUS_AGENT_ENABLED` is `true`. User rows normally schedule the next full decision check after 24 hours. Manual user requests can queue an earlier protected cycle.

## Required production configuration

The agent remains inactive unless all existing protected-worker requirements are configured:

```text
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
ODDS_API_KEY
CRON_SECRET / SCORECASTER_CRON_SECRET
SCORECASTER_AUTONOMOUS_AGENT_ENABLED=true
```

Unified-data quality improves when the optional V1/V2 provider keys and mappings are active.

## Production verification

Before treating V12 as active:

1. apply all reviewed Supabase migrations
2. verify two-user RLS isolation
3. enable the Autonomous Agent variable only in the reviewed production environment
4. run a manual protected worker cycle
5. verify a normal user completes successfully
6. verify a controlled critical-drift user is deferred
7. verify a controlled loss-streak user is deferred for 24 hours
8. verify low-coverage PLAY candidates are changed to WATCH with zero stake
9. verify healthy candidates retain paper-only decisions with reduced or normal sizing
10. compare Mission Control web and native values for the same account
11. verify run summaries contain `Autonomous-Scorecaster-V12` and `autonomyJournal`
12. verify no probability, edge, EV or real-money action was changed by autonomy

## Non-goals

V12 does not:

- promise profitable betting
- connect to bookmaker accounts
- place real-money bets
- accept deposits or payment data
- promote a model automatically
- manufacture missing provider evidence
- use post-event closing data in a pregame decision
