# Scorecaster Context Engine V1

Context Engine V1 adds a timestamped pre-match evidence layer for lineups, injuries, suspensions, availability, rest, travel, weather, surface and officials.

## Product boundary

The engine is paper-only. It does not connect to bookmaker accounts, transfer money or place real bets. Its context-adjusted output is a bounded sensitivity preview and does not independently promote PLAY.

## Evidence contract

Every item must include:

- event identity
- category and team role
- subject and current status
- confirmation state
- normalized impact and confidence
- production-publishable source identity
- observed-at timestamp before kickoff

Unsupported, stale, expired, future or post-kickoff evidence is rejected. A research-only, disabled or unknown source is rejected. Missing context stays missing and lowers the evidence-quality score.

Confirmation states remain explicit:

- `confirmed`
- `probable`
- `unconfirmed`
- `rumor`

The UI and API never relabel an unconfirmed item as confirmed.

## Conflicts and corrections

Evidence is grouped by team role, category and subject. When two materially similar sources disagree and neither clearly dominates, the item becomes a visible conflict and contributes no model adjustment.

Corrections append a new row and may reference the earlier row through `supersedes_id`. History is not silently rewritten.

## Bounded contribution model

The engine calculates:

```text
evidence_weight = confirmation_weight × confidence × source_trust × freshness_weight
team_elo_delta = clamp(impact × evidence_weight × category_cap)
```

Each category has a conservative Elo cap. Total context movement is capped to ±80 Elo points per team. Event-level conditions such as weather use a separate goal-environment adjustment capped to ±0.35.

The same transparent Elo–Davidson and Poisson baseline is then run twice:

1. before context
2. bounded context sensitivity preview

The API reports both probability sets, expected goals, fair odds, deltas and the exact accepted evidence rows.

## Public surfaces

- Human-readable UI: `/context`
- Audit JSON: `/api/context`
- Source registry: `/api/sources`

Example query:

```text
/api/context?eventId=epl:arsenal-chelsea:2026-08-05&home=Arsenal&away=Chelsea&kickoff=2026-08-05T18:00:00.000Z
```

## Database

Manual production patch:

```text
scripts/apply-context-engine-v1.sql
```

The patch is intentionally separate from the current canonical 21-migration rollout. Repository deployment therefore cannot be mistaken for proof that the production table exists. Run the patch in Supabase SQL Editor and verify the resulting table before enabling live context ingestion.

`context_evidence_v1` is server-only. RLS and FORCE RLS are enabled, browser roles receive no direct privileges, and service routes use `service_role`.

## Limitations

- Category caps are documented defaults, not league-calibrated parameters.
- The engine requires licensed or first-party normalized context records; it does not scrape or invent unavailable information.
- Event-level integration and automatic licensed ingestion remain future work.
- Closing-line and post-kickoff evidence are excluded from pre-match context calculations.
