# Migration Release Evidence V2

## Purpose

Scorecaster has two separate migration facts and they must never be confused:

1. the reviewed SQL migration exists in the repository; and
2. the migration has been independently verified as applied in production.

Repository presence is useful for inventory, checksums and review, but it is never production proof.

## Canonical sources

The ordered migration set comes from:

```text
config/release-readiness.json
```

The manually reviewed production status comes from:

```text
config/production-migration-status.json
```

The status registry must have the exact same migration count and order as the release manifest. Supported states remain:

- `unverified`
- `applied`
- `missing`
- `superseded`
- `manual-review`
- `blocked`

An `applied` migration is valid only when `verifiedAt`, `verifiedBy` and an evidence reference are all present.

## Release JSON binding

`GET /api/production-evidence?format=release` now derives its migration section from the canonical status registry through `buildMigrationReleaseStatus()`.

The public release artifact receives only a redacted summary:

- configured migration count
- recorded migration count
- verified-applied count
- unverified/unresolved counts
- exact-order validation state
- registry validation state
- production-verification boolean
- SHA-256 status fingerprint
- validation-failure count

Raw migration evidence references and reviewer identities are not copied into the public artifact.

The existing manifest migration-list fingerprint remains separate. This means reviewers can distinguish:

- what SQL the release expects, and
- what production status has actually been recorded for that ordered set.

## Fail-closed rules

Migration release status is `passed` only when:

- the registry schema/environment are valid
- migration count and order exactly match the manifest
- every status is supported
- every configured migration is `applied`
- every applied entry contains the required verification metadata

A status label by itself cannot certify production. `buildProductionReleaseEvidence()` requires both `status: passed` and `productionVerified: true` before the migration blocker can clear.

`missing` or `blocked` creates a failed state. An incomplete but otherwise valid registry remains `unverified`.

The current production registry intentionally remains unverified until real production evidence is collected.

## Tests

Regression coverage verifies:

- the current 21-entry registry stays unverified
- a fully evidenced synthetic registry can pass
- missing evidence on an applied entry fails
- order drift fails
- explicit missing/blocked states fail
- a caller cannot clear the Release JSON migration blocker with only a `passed` label
- the API derives migration state from repository-controlled configuration rather than query parameters

The Migration Inventory workflow runs both the inventory tests and the Release JSON migration-binding tests.

## Production workflow

After real production verification:

1. retain the non-secret schema/object evidence in the trusted release evidence store
2. update each migration entry only after object-level verification
3. preserve exact `verifiedAt`, reviewer identity and evidence reference in the private/repository status record according to the existing release process
4. run `node scripts/migration-inventory.mjs --check --require-applied --write`
5. generate the Release JSON again
6. confirm the migration summary is `passed` and `productionVerified: true`
7. continue with the independent worker, RLS/two-user, provider, mobile and manual release gates

Migration verification alone never activates production.

## Safety boundary

- paper-only product
- no migration is executed by the Release JSON endpoint
- no SQL file presence is treated as production proof
- no automatic migration application
- no secrets, connection strings or user rows in migration release evidence
- no bookmaker credentials
- no deposits, withdrawals, Cash Out or real-money execution
