# Scorecaster Production Activation V1

Production Activation V1 turns the reviewed Scorecaster release manifest into one guarded, repeatable production rollout. It is intentionally manual and paper-only.

## Product boundary

The workflow applies database schema, verifies account isolation controls and probes protected background workers. It does not place real-money bets, connect bookmaker accounts, move money, accept deposits or access payment credentials.

## Safety model

- GitHub `workflow_dispatch` only; there is no schedule.
- The job uses the protected GitHub `production` environment.
- Configure a required reviewer for that environment before adding production credentials.
- Every action requires an exact confirmation phrase.
- Repository permissions remain `contents: read`.
- Database and worker credentials are read from GitHub secrets and never written to the report.
- SQL uses `ON_ERROR_STOP=1`.
- Every migration is applied in its own transaction and remains idempotent.
- Schema verification is read-only.
- Worker probes call only the existing protected internal routes.
- Recurring worker variables are not changed by the activation workflow.

## Required GitHub environment secrets

Add these to the repository's `production` environment, not to source code:

- `SCORECASTER_PRODUCTION_DB_URL`: the production Supabase PostgreSQL connection string.
- `SCORECASTER_CRON_SECRET`: the same minimum-16-character server secret used by protected worker routes.

The existing recurring worker workflow also uses:

- `SCORECASTER_NOTIFICATION_DELIVERY_URL`: the HTTPS production application origin.
- `SCORECASTER_CRON_SECRET`.

## Required Vercel production environment

The activation workflow cannot write Vercel settings. Configure these in the production deployment before worker probing:

- public Supabase URL and publishable key
- server-only Supabase service-role key
- server-only odds provider key
- server-only cron secret
- `SCORECASTER_WATCHLIST_MONITOR_ENABLED=true`
- `SCORECASTER_SETTLEMENT_MONITOR_ENABLED=true`
- `SCORECASTER_AUTONOMOUS_AGENT_ENABLED=true`
- `SCORECASTER_NOTIFICATION_DELIVERY_ENABLED=true` only after physical push validation

Optional grounded explanation and sports-intelligence providers remain separate from activation.

## GitHub recurring worker variables

Enable these repository variables only after the matching Vercel flag is active and the protected probe succeeds:

- `SCORECASTER_WATCHLIST_MONITOR_ENABLED=true`
- `SCORECASTER_SETTLEMENT_MONITOR_ENABLED=true`
- `SCORECASTER_AUTONOMOUS_AGENT_ENABLED=true`
- `SCORECASTER_NOTIFICATION_DELIVERY_ENABLED=true` only after real-device push testing

The recurring workflow runs every 15 minutes, while each database state table controls the actual per-user cadence.

## Action 1: schema

Purpose: verify the already-applied production schema without changing data.

Run `Scorecaster Production Activation` with:

- action: `schema`
- confirmation: `VERIFY SCORECASTER PRODUCTION`

The verifier checks:

- all manifest tables exist
- RLS and FORCE RLS are enabled
- each protected table has at least one policy
- anonymous reads are denied
- monitor claim functions exist and are executable only through the intended roles
- authenticated users can request their own Autonomous Agent run
- authenticated users cannot directly delete the Autonomous Agent settings row
- database paper-risk and Autonomous Agent scheduling triggers exist

## Action 2: migrate

Purpose: apply all SQL files in the exact order defined by `config/release-readiness.json`, then run the complete schema verification.

Run with:

- action: `migrate`
- confirmation: `APPLY SCORECASTER PRODUCTION MIGRATIONS`

The current rollout contains 12 idempotent migrations from the base schema through Autonomous Paper Agent V1. The JSON evidence report includes only file paths and SHA-256 digests, never the database connection string.

If a migration fails, the job stops immediately. Correct the reviewed SQL or production prerequisite and run the same action again; the migrations are designed to be safely repeatable.

## Action 3: probe

Purpose: verify that the deployed server accepts the protected worker credential and that each worker completes one bounded production cycle.

Run with:

- action: `probe`
- confirmation: `PROBE SCORECASTER PRODUCTION WORKERS`
- base URL: the reviewed HTTPS production origin

The probe checks:

- `/api/health`
- Watchlist Monitor
- Settlement Monitor
- Autonomous Paper Agent
- Notification Delivery

A disabled or incompletely configured worker returns a non-success response and fails the probe. No recurring worker variable is enabled automatically.

## Evidence

Every run uploads `production-activation.json` for 90 days. It contains:

- action and timestamps
- migration file digests
- schema verification result
- worker route status and safe version/error summaries
- deployed commit and environment when provided by `/api/health`

It excludes database URLs, cron secrets, service-role keys, provider keys and push tokens.

## Final human verification

Production Activation proves schema shape and protected worker execution. Public launch still requires evidence that cannot be generated honestly by repository automation:

- two-user web and mobile RLS isolation
- Autonomous Agent opt-in, duplicate prevention and paper-risk behavior with two users
- physical iOS and Android push delivery
- full FI/EN/ES device flow
- signed TestFlight and Google Play builds
- final legal, support and store disclosures
- independent production security review
