# Scorecaster Production Release Evidence Artifact V1

## Purpose

Production Evidence V1 already measures league and provider readiness from real Scorecaster observations. The release artifact adds the missing release-review layer: one machine-readable package that links those runtime denominators to deployment identity, migration inventory, protected-worker probes and manual release gates.

The artifact is deliberately fail closed. Repository configuration or a healthy league scorecard is **not** treated as proof that production migrations, physical-device checks, RLS isolation or protected-worker probes have actually been completed.

## Export

Use:

```text
GET /api/production-evidence?format=release&days=30
```

Optional `sport` filtering is the same as the normal Production Evidence endpoint.

The response is JSON and is returned with an attachment filename similar to:

```text
scorecaster-release-evidence-30d.json
```

## Artifact identity

Every artifact includes:

- `version: scorecaster-production-release-evidence-v1`
- `artifactId` — SHA-256 fingerprint of the release evidence package
- `manifestFingerprint` — SHA-256 fingerprint of the reviewed migration/patch/gate/worker declaration set
- generation timestamp
- explicit `activationEligible` boolean
- blockers

The fingerprint is for evidence identity and comparison. It is not a signature and does not replace a signed release process.

## Linked evidence

### Production evidence

A release-safe snapshot of Scorecaster Production Evidence V1 is embedded:

- report version and time window
- release state and blockers
- league counts
- event denominator
- verified fixture-identity rate
- multi-provider coverage
- closing-line numerator and denominator
- closing-line coverage
- provider availability summary
- active incident count
- league state, score, freshness and visible denominators

Raw provider payloads and user identifiers are not included.

### Deployment

Only bounded runtime metadata is exposed:

- environment: production / preview / development / unknown
- commit SHA when available
- deployment host when available

The artifact does not copy arbitrary environment variables. API keys, service-role keys, cron secrets, cookies, authorization headers and provider credentials are excluded.

A deployment is considered observed as a production runtime only when a safe commit SHA, host and `production` runtime environment are all present.

### Migration inventory

The artifact fingerprints the reviewed migration and production-patch lists from `config/release-readiness.json`.

Repository presence is not production proof. A separate trusted release process must provide a production migration evidence status and evidence reference before the artifact can become activation-eligible.

The public export currently passes migration status as `unverified` on purpose. Callers cannot change it through query parameters.

### Runtime worker evidence

The current Production Evidence worker denominator is copied into the artifact with:

- state
- observed cycles
- completed cycles
- denominator
- success rate
- latest run timestamp and age

If that runtime worker state is not `enabled`, release activation is blocked.

### Protected-worker probes

Every protected internal worker declared by the release manifest is listed with its expected unauthenticated status boundary.

The public export does not pretend those workers have been probed. Their status is `unverified` until a trusted release process supplies explicit probe evidence.

### Manual release gates

Every blocking manual release check from the release manifest is embedded with:

- id
- title
- blocking flag
- status
- optional observation time
- optional evidence reference

The public export marks them `unverified` because a URL request is not allowed to self-certify production evidence.

## Activation rule

`activationEligible` can become true only when all of these are true in the same evidence package:

1. Production Evidence report state is `ready`.
2. Safe production deployment metadata is observed.
3. Production migration evidence is explicitly `passed`.
4. Runtime worker evidence is `enabled`.
5. Every declared protected-worker probe is explicitly `passed`.
6. Every blocking manual release gate is explicitly `passed`.

Missing evidence creates a blocker rather than a neutral or healthy value.

Typical blockers include:

- `production-evidence-blocked`
- `production-deployment-unverified`
- `production-migrations-unverified`
- `runtime-worker-evidence-below-target`
- `protected-worker-probes-unverified`
- `manual-release-gates-unverified`

## Trust boundary

`GET /api/production-evidence?format=release` is intentionally read-only and cannot receive:

- migration proof
- manual-gate proof
- worker-probe proof
- deployment override
- API keys or credentials

through query parameters.

A later governed release process may call the same pure artifact builder with reviewed evidence references. That process must remain server-side and must not accept self-attested browser values as proof.

## Safety

The artifact does not change model probability, PLAY decisions, stakes or league activation. It only summarizes evidence.

It includes no:

- bookmaker credentials
- real-money execution
- deposits or withdrawals
- raw restricted provider payloads
- user identifiers
- secret environment values
- invented missing evidence

Scorecaster remains paper-only.
