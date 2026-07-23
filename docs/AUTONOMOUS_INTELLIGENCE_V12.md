# Scorecaster Autonomous Intelligence V12

Autonomous Intelligence V12 is Scorecaster's governed, paper-only autonomous decision and learning system. It can collect verified sports data, build a portfolio, create virtual paper selections, wait for settlement, evaluate performance, compare model challengers and change its own paper-risk posture.

It cannot log in to a bookmaker, move money, process deposits or place real-money bets.

## Autonomous loop

Each protected worker cycle performs the following sequence:

1. Claims only users who explicitly enabled autonomous paper mode.
2. Loads the user's virtual bankroll and database-enforced exposure limits.
3. Loads settled paper history, open exposure and the current V12 control state.
4. Loads recent Unified Sports Data provider observations and active provider incidents.
5. Builds the existing no-vig market-consensus portfolio.
6. Runs V11 chronological champion-challenger calibration in shadow mode.
7. Calculates the V12 health score, operating mode and kill-switch state.
8. Applies the V12 stake multiplier and maximum-pick limit.
9. Saves only deterministic, duplicate-safe virtual paper selections.
10. Stores the learning snapshot, model registry evidence, incidents and complete run audit.
11. Schedules the next protected cycle using the selected operating mode.
12. Settlement workers later resolve open paper selections and add closing odds, CLV and outcomes to the learning history.

## Operating modes

### `learning`

Used when the agent has fewer than 30 settled observations.

- one paper selection at most
- small paper stake multiplier
- no model promotion
- slower follow-up interval

### `active`

Used when data, provider quality, performance and drift are healthy.

- profile-controlled stake multiplier
- up to the configured paper-pick limit
- normal protected follow-up interval

### `cautious`

Used when warning conditions exist without a hard safety failure.

Examples:

- provider health below the user's preferred threshold
- model-drift warning
- recent weak ROI or CLV
- limited learning evidence

The agent reduces paper stake and selection count automatically.

### `recovery`

Used after a previous kill switch has cleared.

- only one reduced paper selection
- faster re-evaluation
- no immediate return to full paper exposure

### `frozen`

Used when any hard safety condition is active.

- zero new paper exposure
- all new PLAY decisions are converted to WATCH
- an explicit incident is stored
- the agent continues monitoring for automatic recovery

## Automatic kill switch

The kill switch activates when at least one hard blocker is present:

- critical model drift
- provider outage or high-severity provider incident
- configured consecutive-loss limit reached
- configured virtual-paper drawdown limit reached
- protected worker processing failure
- verified source-loading failure

A frozen agent never creates new paper exposure. Existing open paper selections remain available to the settlement worker.

## Health score

V12 calculates a 0–100 health score from:

- model drift
- provider availability and trust
- provider disagreement
- active provider incidents
- settled sample size
- recent ROI
- recent CLV
- virtual-paper drawdown
- current loss streak

The health score is descriptive and controls paper-risk posture. It is not a predicted win probability.

## Rolling performance

The V12 performance snapshot includes:

- settled sample count
- wins, losses and pushes
- paper profit
- paper ROI
- average CLV
- positive-CLV rate
- Brier score when probabilities exist
- maximum virtual-paper drawdown
- current consecutive-loss streak
- recent-versus-reference trends

The latest 20 settled samples are the recent window. A longer 50-sample window is used as a comparison when available.

## Champion-challenger governance

The published Scorecaster probability remains the no-vig market consensus.

A V12 model promotion is allowed only for paper-risk policy and requires all of the following:

1. Continuous learning enabled.
2. Automatic paper-model promotion enabled.
3. V11 chronological holdout gate passed.
4. At least 300 settled probability observations.
5. Stable model drift.
6. Provider health at least 70 and above the user's configured gate.
7. At least 20 recent settled observations.
8. Non-negative recent CLV when CLV is available.
9. Recent ROI no worse than -3%.
10. Two consecutive promotion-ready learning snapshots.

The model registry database constraint requires:

```text
probability_applied_to_published_model = false
paper_risk_policy_only = true
```

A promoted paper champion may alter only autonomous stake scaling and paper-risk governance. It cannot change the displayed probability, edge, EV or a market decision.

## Autonomy profiles

### Conservative

- lower active paper stake
- fewer simultaneous paper selections
- recommended default

### Balanced

- moderately higher paper stake
- up to three paper selections when all gates are healthy

### Research

- deliberately small paper exposure
- emphasizes evidence collection and comparison rather than paper profit

All profiles remain inside the user's database bankroll and exposure limits.

## Data storage

Apply:

```text
supabase/scorecaster_autonomous_intelligence_v12.sql
```

The migration adds V12 settings and state fields and creates:

- `autonomous_agent_models`
- `autonomous_agent_learning_snapshots`
- `autonomous_agent_incidents`

All three tables use forced row-level security.

- authenticated users may read only their own rows
- authenticated users cannot write model, learning or incident rows
- only the server-side service role can write
- anonymous access is denied

## APIs and interfaces

### Protected worker

```text
GET /api/internal/autonomous-agent
Authorization: Bearer <CRON_SECRET>
```

The route executes V12 when the migration is active. Before activation it safely executes the previous V1 paper worker and reports `autonomous-intelligence-v12-fallback-v1`.

### Authenticated control API

```text
GET  /api/cloud/autonomous-agent
PUT  /api/cloud/autonomous-agent
POST /api/cloud/autonomous-agent
```

GET returns settings, state, runs, learning snapshots, model registry and incidents.

PUT updates the user's bounded autonomy settings.

POST queues an enabled user for the next protected worker cycle.

### Web

```text
/autonomous-agent
```

The cockpit displays:

- operating mode
- health score
- kill switch
- next adaptive cycle
- recent ROI and CLV
- drawdown and loss streak
- provider health
- champion and challenger
- promotion action
- active incidents
- recent autonomous cycles

### Native mobile

```text
More -> Autonomous Intelligence V12
```

The native view exposes the same operational status without opening a browser.

### Alert Inbox

`/alerts` includes user-isolated V12 kill-switch, drift, provider, drawdown and loss-streak incidents alongside existing system and watchlist alerts.

## Production activation

1. Deploy the reviewed code.
2. Apply all migrations in `config/release-readiness.json` order.
3. Run `scripts/verify-production-schema.sql`.
4. Run `scripts/verify-autonomous-v12-schema.sql`.
5. Configure `SUPABASE_SERVICE_ROLE_KEY` in Vercel.
6. Configure the same strong `CRON_SECRET` in Vercel and GitHub Actions.
7. Configure `SCORECASTER_AUTONOMOUS_AGENT_ENABLED=true` only after migration verification.
8. Ensure the existing protected scheduler calls `/api/internal/autonomous-agent`.
9. Enable autonomous mode for a test user with a virtual bankroll.
10. Queue one cycle and confirm a learning snapshot, run and state update appear.
11. Verify duplicate prevention by requesting the same daily event-selection twice.
12. Verify a controlled provider outage activates the kill switch.
13. Verify a controlled recovery clears the incident and uses recovery mode before active mode.
14. Verify model rows always keep published-probability application false.
15. Verify account export and deletion include all V12 user data.
16. Test the web and physical iOS/Android native views.

## Required production evidence before claiming full autonomy

- V12 migration active
- service-role and RLS verification successful
- protected scheduler completing cycles
- settlement worker resolving paper selections
- Unified Data history and closing lines active
- at least one controlled kill-switch test
- at least one controlled recovery test
- account export/deletion test
- physical-device mobile test

Without this evidence, the code remains deployable and the V1 fallback remains safe, but Scorecaster must not claim that full V12 autonomy is active in production.
