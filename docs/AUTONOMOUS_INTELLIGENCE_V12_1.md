# Autonomous Intelligence V12.1

Autonomous Intelligence V12.1 extends the reviewed Autonomous Scorecaster V12 Mission Control and Daily Governor. It does not replace them.

V12 remains responsible for:

- real user-specific preflight from settled paper history
- model-drift, drawdown and loss-streak circuit breakers
- Unified Sports Data readiness gates
- persistent UTC daily pick and virtual-exposure limits
- deterministic duplicate-safe paper saves
- database-enforced paper bankroll and exposure limits

V12.1 adds persistent learning, provider-aware control, adaptive scheduling, a model registry and user-specific incident history around that existing system.

Scorecaster remains virtual paper-only. It never logs in to a bookmaker, moves money or places a real-money bet.

## Worker sequence

The protected worker now runs this sequence:

1. Detect whether the V12.1 migration is active.
2. When inactive, run the reviewed V12 Daily Governor unchanged and report a safe fallback version.
3. When active, load 24-hour provider observations and active Unified Data incidents.
4. Load due users, their settings, bankroll, settled history, open paper exposure and previous control state.
5. Load current verified Top Picks for the user's selected sports.
6. Build the existing V12 Mission Control state.
7. Add V12.1 provider, configurable drawdown, loss-streak and recovery gates.
8. Freeze unsafe users before the existing Daily Governor can claim them.
9. Run the existing V12 Daily Governor for remaining users.
10. Store a V12.1 learning snapshot for completed runs.
11. Update the persistent champion–challenger registry.
12. Open or resolve user-specific incidents.
13. Store the next adaptive worker interval.

## Persistent performance

Every settled-paper learning snapshot contains:

- settled sample size
- all-time and recent paper ROI
- average CLV
- positive-CLV rate
- Brier score when probabilities exist
- maximum virtual-paper drawdown
- consecutive-loss streak
- recent-versus-reference ROI, CLV and Brier trends
- provider availability, trust and divergence
- V11 model-lab evidence
- complete V12.1 control-plane audit

The recent window uses the last 20 settled observations. The reference window uses up to the preceding 30 observations.

## Operating modes

V12.1 persists the Mission Control mode in the user state:

- `BOOTSTRAP`
- `ACTIVE`
- `GUARDED`
- `DEGRADED`
- `RECOVERY`
- `FROZEN`

A previous kill switch cannot move directly back to `ACTIVE`. It enters `RECOVERY` first and receives a shorter audited follow-up interval.

## Provider-aware safety

V12.1 calculates provider health from the last 24 hours of Unified Sports Data observations:

- live availability rate
- source trust
- cross-provider divergence
- active provider incidents
- high-severity incidents

A provider outage or high-severity provider incident freezes new autonomous paper exposure. Degraded provider health moves healthy autonomy into a reduced-risk state.

## User-configurable hard gates

Users may configure:

- autonomy profile: conservative, balanced or research
- maximum consecutive paper losses: 3–20
- maximum virtual-paper drawdown: 3–30%
- minimum provider-health score: 30–90
- continuous learning enabled/disabled
- automatic paper-model promotion enabled/disabled

These settings are additional restrictions. They never weaken the existing Daily Governor or database risk limits.

## Champion–challenger promotion

A challenger can become the persistent paper champion only when every condition is true:

1. continuous learning is enabled
2. automatic paper promotion is enabled
3. V11 chronological holdout promotion gate passed
4. at least 300 settled probability observations exist
5. model drift is stable
6. provider health is at least 70 and above the user's configured threshold
7. at least 20 recent settled observations exist
8. recent CLV is non-negative when available
9. recent ROI is no worse than -3%
10. two consecutive learning snapshots are promotion-ready

The database enforces:

```text
probability_applied_to_published_model = false
paper_risk_policy_only = true
```

A promoted model may affect paper-risk policy and audit labels only. It cannot change the published market probability, edge, EV or a market decision.

## Storage and privacy

Apply:

```text
supabase/scorecaster_autonomous_intelligence_v12.sql
```

The migration creates:

- `autonomous_agent_models`
- `autonomous_agent_learning_snapshots`
- `autonomous_agent_incidents`

It also adds V12.1 fields to the existing settings, state and runs tables.

All new tables use forced row-level security:

- users can read only their own rows
- authenticated clients cannot insert, update or delete model, learning or incident rows
- anonymous access is denied
- only the server-side service role can write

V12.1 data is included in account export and account deletion.

## Interfaces

### Mission Control

```text
/mission-control
```

The API now includes:

- `persistentControl`
- `learning`
- `models`
- `incidents`
- V12.1 health, provider and promotion proof

### Autonomous settings

```text
/autonomous-agent
```

The settings page includes a separate V12.1 panel without removing the existing basic autonomous controls.

### Alert Inbox

```text
/alerts
```

User-specific V12.1 incidents appear alongside existing system and watchlist alerts.

### Protected worker

```text
GET /api/internal/autonomous-agent
Authorization: Bearer <CRON_SECRET>
```

Expected active version:

```text
autonomous-intelligence-v12.1
```

Safe pre-migration fallback:

```text
autonomous-intelligence-v12.1-fallback-v12
```

## Production activation

1. Deploy the reviewed code.
2. Apply all 15 migrations in `config/release-readiness.json` order.
3. Run `scripts/verify-production-schema.sql`.
4. Run `scripts/verify-autonomous-v12-schema.sql`.
5. Configure `SUPABASE_SERVICE_ROLE_KEY` in Vercel.
6. Configure the same strong `CRON_SECRET` in Vercel and GitHub Actions.
7. Keep `SCORECASTER_AUTONOMOUS_AGENT_ENABLED=false` until schema verification succeeds.
8. Verify Unified Data capture and closing-line history are active.
9. Enable the autonomous worker.
10. Enable one test user's paper agent and virtual bankroll.
11. Queue one cycle and confirm a run, learning snapshot, state update and incident resolution lifecycle.
12. Trigger controlled provider, drift, drawdown and loss-streak scenarios.
13. Verify every unsafe scenario freezes new paper exposure.
14. Verify recovery enters `RECOVERY` before returning to normal operation.
15. Verify model rows always retain published-probability application as false.
16. Verify account export and deletion contain all V12.1 records.
17. Test Mission Control and the existing native mobile cockpit on physical iOS and Android devices.

Full production autonomy must not be claimed until migration, worker, settlement, Unified Data, controlled kill-switch and physical-device evidence all exist.
