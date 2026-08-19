# Scorecaster Production Migration Inventory V1

## Purpose

This work package creates a controlled, evidence-based process for proving which Scorecaster Supabase migrations are present in the repository and which have actually been verified in production.

Repository file presence is **not** treated as proof that a migration ran in production. A table with a familiar name is also not enough: the verification must cover the relevant functions, triggers, indexes, grants and RLS policies.

The product boundary remains sports analysis, risk control and virtual paper tracking only. This process introduces no bookmaker connection, payment data or real-money execution.

## Canonical rollout

The canonical ordered rollout now contains 23 migrations. The inventory includes every reviewed `supabase/scorecaster_*.sql` migration, including the independently verified Agent signing migration and Autonomous Risk Profile V1. During the original inventory work package, two migrations were found in `supabase/` but missing from the release manifest:

- `supabase/scorecaster_community_feed_v1.sql`
- `supabase/scorecaster_ai_intelligence_v1.sql`

Both are included in the reviewed order. The V13 database hard caps remain immediately after Autonomous Agent V2. `supabase/scorecaster_autonomous_agent_risk_profile_v1.sql` follows the hard-cap migration because it extends the V2 settings and audit tables without weakening the hard-cap trigger. The final migration remains `supabase/scorecaster_shadow_learning_v1.sql`.

## Files

- `scripts/migration-inventory.mjs` scans the canonical manifest and every `supabase/scorecaster_*.sql` file.
- `config/production-migration-status.json` stores manual production verification status and evidence references.
- `scripts/export-production-migration-evidence.sql` exports schema metadata without application rows or secrets.
- `scripts/migration-inventory.test.mjs` covers drift detection, checksums, static risk signals and evidence requirements.
- `.github/workflows/migration-inventory.yml` runs the inventory and tests on every relevant pull request.

## Local repository audit

Run:

```bash
node scripts/migration-inventory.mjs --check
```

Generate JSON and Markdown artifacts:

```bash
node scripts/migration-inventory.mjs --check --write
```

Outputs:

```text
artifacts/production-migration-inventory.json
artifacts/production-migration-inventory.md
```

The generated artifact includes:

- ordered migration path
- repository presence
- SHA-256 checksum
- line and byte count
- detected tables, functions, triggers, policies and indexes
- static destructive-operation signals
- manually recorded production status and evidence reference
- untracked and missing migration files

Static scanning is a review aid, not a SQL parser and not permission to execute a migration automatically.

## Production evidence collection

1. Open the production Supabase SQL Editor.
2. Create a new query.
3. Paste `scripts/export-production-migration-evidence.sql`.
4. Run it once.
5. Save the returned JSON securely as a release artifact.
6. Do not include access tokens, connection strings, API keys or application row data.
7. Compare the returned objects against each migration's expected objects and the existing targeted verification scripts.

The export reads catalog metadata only. It does not modify the database and does not read user bets, comments, profiles or other application rows.

## Recording a migration as applied

Edit the matching entry in `config/production-migration-status.json` only after object-level verification:

```json
{
  "path": "supabase/scorecaster_community_feed_v1.sql",
  "status": "applied",
  "verifiedAt": "2026-08-04T12:00:00Z",
  "verifiedBy": "release-reviewer",
  "evidence": "release-evidence/2026-08-04-production-schema.json#community_comments",
  "notes": "Table, indexes, grants and four RLS policies verified."
}
```

Allowed statuses:

- `unverified`
- `applied`
- `missing`
- `superseded`
- `manual-review`
- `blocked`

An `applied` entry without `verifiedAt`, `verifiedBy` and `evidence` fails validation.

## Applying a missing migration

Do not batch-run every migration.

For each missing migration:

1. Review the exact repository checksum in the generated inventory.
2. Review every destructive or operational signal.
3. Take the required Supabase backup or recovery point.
4. Run only that migration in the documented order.
5. Stop immediately on an error.
6. Run the metadata export and the relevant targeted verification SQL.
7. Confirm application health and fail-closed behavior.
8. Record evidence before moving to the next migration.

`DROP POLICY IF EXISTS` followed by the matching `CREATE POLICY` is reported as a policy replacement. It is not treated as table-data deletion, but it still requires review because permissions change during execution.

## Final production gate

After every migration has evidence:

```bash
node scripts/migration-inventory.mjs --check --require-applied --write
```

This gate fails when:

- a configured migration file is missing
- an untracked migration exists in `supabase/`
- status order differs from the release manifest
- an unsupported status is used
- an applied migration lacks evidence
- any production migration remains unverified

Passing this gate proves only the recorded migration inventory. It does not replace two-user RLS isolation, worker authentication, hard-cap concurrency or external security testing required by the other P0 work packages.

## Recovery and rollback

- Never delete production tables merely to make a migration rerunnable.
- Prefer idempotent forward repair over destructive rollback.
- Preserve the SQL text and checksum that was executed.
- Record the failure point and all objects created before failure.
- Keep Shadow Learning disabled until the complete P0 activation gate passes.
- Keep automatic model promotion disabled permanently unless a separate reviewed release changes that boundary.
