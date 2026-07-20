# Autonomous Paper Agent V1

Autonomous Paper Agent V1 is Scorecaster's opt-in daily virtual paper decision worker.

It does not place real-money bets, connect to bookmaker accounts, move money, accept deposits or process payment credentials.

## Decision chain

1. Claim only users who explicitly enabled the agent.
2. Load the user's virtual bankroll and existing open paper exposure.
3. Load current server-verified Top Picks.
4. Build the existing Agent V11 governed portfolio.
5. Keep only decisions that remain `PLAY` after stress tests and model-lab governance.
6. Apply the user's priority and odds limits.
7. Prevent a second open selection for the same event.
8. Reduce stake to the remaining single-pick, league and total exposure capacity.
9. Insert a deterministic daily paper row.
10. Let the database risk trigger recheck stake, exposure, edge and confidence.
11. Persist a bounded audit run and schedule the next daily cycle.

## Hard limits

Per worker cycle:

- 10 users
- 6 sports per user
- 6 unique source groups
- 3 selections per user
- 30 saved paper selections in total
- 200 existing open paper rows loaded per user
- 500 settled history rows used for learning per user

## Database objects

Migration:

```text
supabase/scorecaster_autonomous_agent.sql
```

Tables:

- `autonomous_agent_settings`
- `autonomous_agent_state`
- `autonomous_agent_runs`

RPC functions:

- `claim_autonomous_agent_users`
- `complete_autonomous_agent_user`
- `request_autonomous_agent_run`

Authenticated users may manage only their own settings and read only their own state and runs. Worker claims and completion are service-role only.

## User settings

The user can configure:

- enabled / disabled
- up to six sports or leagues
- one to three daily paper picks
- minimum Agent priority score
- minimum and maximum odds

The existing `bankroll_settings` table remains authoritative for:

- virtual bankroll
- maximum single stake
- total open exposure
- league exposure
- minimum edge
- minimum confidence

## Routes

Authenticated user route:

```text
GET  /api/cloud/autonomous-agent
PUT  /api/cloud/autonomous-agent
POST /api/cloud/autonomous-agent
```

The POST route queues a run for the next protected worker cycle. It does not invoke the service-role worker directly.

Internal worker route:

```text
GET /api/internal/autonomous-agent
Authorization: Bearer <shared cron secret>
```

The internal route fails closed when the feature flag, protected scheduler secret, admin database access or market provider is missing.

## Scheduler

The existing `Scorecaster Background Workers` workflow includes an independent `autonomous` job.

Required repository variable:

```text
SCORECASTER_AUTONOMOUS_AGENT_ENABLED=true
```

Required server feature flag:

```text
SCORECASTER_AUTONOMOUS_AGENT_ENABLED=true
```

The job uses the same protected application URL and scheduler secret as the other workers. The workflow may run every 15 minutes, but the database state normally makes an enabled user due only once every 24 hours.

## Idempotency

Each paper decision receives a deterministic reference derived from:

- user ID
- UTC date
- event identity
- selection

The unique `(user_id, client_ref)` constraint prevents repeated worker cycles from creating the same daily selection twice.

## Audit trail

Each run records:

- candidate count
- selected count
- saved count
- skipped count
- total virtual stake
- source and fixture source
- open exposure before the run
- bounded decision summaries
- duplicate and database-risk rejection counts
- completion status and bounded error

The user's settings, state and runs are included in account export and removed during account deletion.

## Production activation

1. Run all previous Scorecaster migrations.
2. Run `supabase/scorecaster_autonomous_agent.sql`.
3. Deploy the new application code.
4. Configure the protected scheduler, service-role database access and market provider.
5. Set the server feature flag.
6. Set the GitHub repository variable.
7. Keep the user's personal agent setting disabled by default.
8. Test with two accounts and a virtual bankroll.
9. Confirm duplicate prevention and all database paper-risk limits.
10. Enable the user setting only after the production verification.

## Manual verification that remains mandatory

- two-user RLS isolation
- enabled user versus disabled user worker behavior
- duplicate daily run behavior
- existing manual open exposure reducing autonomous capacity
- database rejection below edge or confidence limits
- one-event correlation prevention
- settlement of autonomous H2H paper rows
- export and deletion coverage
- FI / EN / ES web behavior

Passing repository CI does not prove these production database and identity checks.
