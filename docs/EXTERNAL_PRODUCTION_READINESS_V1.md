# External Production Readiness V1

This workflow measures Scorecaster's current production data/readiness state through the existing public release-safe `/api/production-evidence` and `/api/health` surfaces. It does not use Supabase admin access, a user session, a bearer token, bookmaker credentials or any other secret.

## Measurement semantics

A `blocked` or `degraded` production state is a valid measurement. The workflow fails only when the public evidence contract, cache boundary or safety contract is structurally invalid.

The retained artifacts contain only reduced release-safe information. They do not retain the original API response body, raw provider payloads, user identifiers or secret values.

## Point-in-time production findings

The first reviewed 30-day snapshot reported:

- release state: `blocked`
- leagues: 6
- enabled leagues: 0
- disabled leagues: 6
- events: 35
- verified fixture identity rate: 100%
- multi-provider event rate: 22.86%
- closing-eligible events: 20
- closing records: 18
- closing-line coverage: 90%
- providers: 5
- average provider availability: 54.74%
- active incidents: 2

The main blockers reported by the production evidence surface were:

- provider coverage below target
- league readiness below target
- active high-severity incidents

### Worker evidence

The worker path was healthy in the same snapshot:

- state: `enabled`
- observed cycles: 52
- successful cycles: 51
- partial cycles: 1
- failed cycles: 0
- success rate: 98.08%
- cycle target: 24
- enough cycles: true
- freshness: true

This means worker cadence/reliability is not the current primary readiness bottleneck.

### League evidence

Every observed league remained disabled. EPL contained the only substantial current sample:

- EPL events: 30
- verified identity: 100%
- multi-provider rate: 23.33%
- average provider count: 1.75
- closing-line coverage: 90%

The other five currently visible leagues each had only one event in the measured window, so the production evidence correctly retained small-sample/coverage blockers instead of treating them as release-ready.

## Provider diagnosis

The reduced provider snapshot reported:

| Provider | State | Availability | Events | Notes |
| --- | --- | ---: | ---: | --- |
| The Odds API | enabled | 100% | 38 | primary odds path healthy |
| SportsGameOdds | degraded | 73.68% | 57 | main observable secondary pricing coverage gap |
| Open-Meteo | degraded on active production build | 100% | 19 | active production still uses older scoring logic |
| sports-context-provider | disabled | 0% | 19 | context source has no current successful coverage |
| unavailable | disabled | 0% | 57 | explicit injuries/lineups/news unavailable evidence, not invented context |

The production-safe diagnosis surface did not expose incident details/types in this deployment, so the workflow does not invent them. It retains only the fact that the Production Evidence summary reported two active incidents and an `active-high-severity-incidents` blocker.

## Deployment drift matters

The external `/api/health` snapshot showed that the active production runtime was still serving Git commit:

`51918b2d35a564178dcc814be3d53d651d4f5828`

while repository `main` had already advanced beyond it. The delay is caused by Vercel's account build-rate-limit quota, not a GitHub CI production-build failure.

This distinction is important because the active production commit uses an older provider-readiness scoring formula. For example, it directly penalizes provider observations whose mode is not `auto` or whose trust label is not `trusted`. The current repository implementation has already moved to a more explicit availability/trust/confidence/freshness score.

Therefore the workflow reports the active production result as measured evidence but does **not** use an old production score to justify changing current repository thresholds.

## Current configuration snapshot

The public health surface reported configuration booleans only; no values are retained. At the measured production commit:

- database configured: true
- odds API configured: true
- CRON secret configured: true
- OpenAI configured: true
- Agent decision signing configured: false
- shadow learning enabled: false
- real-money execution enabled: false

`AGENT_DECISION_SIGNING_KEY` therefore remains a separate explicit production configuration task. Repository-side generation/verification tooling already exists; the key value itself must remain server-only.

## Next remediation target

Do not lower the release thresholds to force green status.

The next provider-side investigation should focus on why the secondary pricing path is not producing broad event-level coverage. The currently measured 22.86% multi-provider event rate is consistent with The Odds API being healthy while SportsGameOdds is materially less available.

Any remediation must preserve:

- exact event/team attribution
- chronology-safe observations
- provider disagreement visibility
- no invented odds/context
- fail-closed handling of unavailable providers
- paper-only behavior

## Safety

This workflow is read-only. No database writes, authenticated user reads, bookmaker login, deposits, withdrawals, Cash Out or real-money execution occur.