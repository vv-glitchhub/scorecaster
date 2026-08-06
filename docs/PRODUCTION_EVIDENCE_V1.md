# Scorecaster Production Evidence V1

## Purpose

Production Evidence turns operational sports data into one reproducible release scorecard. It answers a narrower question than the model and pick views:

> Is the evidence for this sport and league trustworthy enough to enable it in a controlled paper-only beta?

The report does not predict matches. It does not change a model probability, decision class or stake. It cannot upgrade a selection to PLAY.

## Surfaces

- `GET /api/production-evidence`
- `GET /api/production-evidence?days=90`
- `GET /api/production-evidence?sport=soccer_epl`
- `GET /api/production-evidence?days=30&format=csv`
- `/production-evidence`

The JSON and CSV outputs contain aggregated operational evidence only. They contain no user identifiers, raw provider payloads, API keys, access tokens or bookmaker credentials.

## Data sources

V1 reads the existing service-role-only production tables:

- `unified_data_snapshots`
- `unified_data_provider_observations`
- `unified_data_closing_records`
- `unified_data_incidents`
- `collector_runs`

No new database migration is required. If any table is not active, the API records that source as unavailable. It does not replace the missing evidence with a zero-risk assumption.

## League states

Every observed league receives exactly one state:

- `enabled`: every V1 gate passes.
- `degraded`: the league has usable evidence, but at least one target or sample-size gate is incomplete.
- `disabled`: evidence is critically sparse, stale, unverified, affected by a high-severity incident or dependent on a disabled protected worker.

The state is deterministic for the same bounded input rows, report time and thresholds.

## Default gates

| Gate | Enabled target |
|---|---:|
| Successful protected worker cycles | at least 95% |
| Worker sample | at least 20 cycles |
| Verified fixture identity | at least 90% |
| Latest league data | at most 90 minutes old |
| Multi-provider event coverage | at least 50% |
| Provider availability | at least 90% |
| Average evidence coverage | at least 70% |
| Average provider disagreement | at most 12% |
| Eligible-event closing-line coverage | at least 80% |
| League sample | at least 20 unique events |

A league becomes disabled when it has fewer than five events, critically weak identity evidence, data older than six hours, a matching high-severity incident, a disabled protected worker or critically unavailable providers.

## Visible denominators

The report publishes the numerator and denominator used by each core percentage:

- Fixture identity denominator: unique latest event snapshots in the requested window.
- Multi-provider denominator: the same unique event set.
- Provider availability denominator: the latest row for each event-provider-family combination.
- Worker success denominator: collector cycles started inside the requested window.
- Closing-line denominator: unique events whose scheduled start is at or before report generation.

Repeated captures cannot inflate event counts because only the latest snapshot per event is used for league readiness.

## Closing-line chronology

The closing-line denominator includes only events already eligible for closing evidence. A closing record counts only when:

1. the event identity is present,
2. decimal closing odds are valid,
3. the scheduled start is known, and
4. `closing_captured_at` is at or before the scheduled start.

Post-start records are rejected. Current odds, simulated odds and manually estimated closing odds are never used as a fallback. Closing evidence remains post-decision evaluation data and never enters a pre-match model through this feature.

## Incident behavior

An event-specific incident applies to its league. An incident carrying explicit sport and league metadata applies to that league. Global provider-health, stale-capture and worker-failure incidents apply across the reviewed leagues.

- a matching active high-severity incident disables the league;
- other active incidents degrade the league;
- resolved incidents do not count as active evidence.

## Missing data behavior

Production Evidence fails closed:

- an unavailable source is named in `dataAvailability` and warnings;
- a missing denominator returns `null`, not an invented percentage;
- insufficient closing eligibility is visible as `closing-line-denominator-too-small`;
- missing provider evidence blocks overall readiness;
- no observed enabled league blocks the release state.

An operational API response may therefore return `ok: true` and `ready: false`. `ok` means the report was generated; it does not mean production is ready.

## CSV export

CSV is a league-level evidence artifact. It includes state, score, all core ratios, denominators, freshness, incident count and reason codes. It excludes event identifiers and provider payloads so it can be attached to a release review without redistributing restricted data.

## Activation and verification

1. Apply and verify Collector V1 and Unified Sports Data V2 migrations.
2. Configure the same strong `CRON_SECRET` for Vercel workers and the selected external scheduler.
3. Run the collector and unified-data workers through multiple real cycles.
4. Verify `/api/data-layer/health` and `/api/collector/health` are fresh.
5. Open `/production-evidence?days=30`.
6. Confirm each enabled league has visible passing denominators.
7. Export the CSV and retain it with the release evidence.
8. Treat every disabled or degraded reason as a release action, not as text to hide in the UI.

## Safety boundary

Scorecaster remains a sports-analysis and virtual paper-tracking system. Production Evidence performs no real-money execution, no account login, no deposit, no withdrawal and no bookmaker interaction. There are no bookmaker credentials in this path. It does not alter production probabilities, stakes or decisions, and it cannot automatically promote a model.

## Rollback

The feature is read-only. Rollback consists of removing the navigation entry, page, API route and engine. No table, policy or user record needs to be changed. Existing Collector, Unified Data, Calibration and Production Control Center functions remain independent.
