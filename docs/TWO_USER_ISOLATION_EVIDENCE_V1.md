# Scorecaster Two-User Isolation Evidence V1

## Status

This package prepares the repository and production-safe evidence harness for P0 issue #93. It does **not** claim production isolation is proven until two dedicated production test accounts and the rollback-only SQL probe have actually been run and their redacted results retained.

The evidence is deliberately split into three layers:

1. repository contract audit
2. non-destructive bearer/cookie production probe
3. rollback-only database transaction probe

No layer may silently replace a missing layer.

## 1. Repository contract audit

Run:

```bash
node scripts/two-user-isolation-contract-audit.mjs
```

The audit reads `config/two-user-isolation.json` and verifies the reviewed ownership boundary for:

- profiles
- bankroll/risk settings
- paper bets
- watchlist
- alert inbox
- autonomous settings, state, runs and decision audit
- shadow-learning samples, state and cycles

For every table it checks:

- RLS enabled
- FORCE RLS enabled
- an `auth.uid()` ownership policy tied to the declared owner column
- the reviewed authenticated grant matrix
- explicit revocation of client writes on read-only audit/state tables

It also verifies the database hard-cap contract:

- duplicate autonomous event per UTC day
- maximum autonomous stake = 1% of bankroll
- maximum daily paper exposure = 5% of bankroll
- maximum same-league exposure = 2.5% of bankroll
- transaction-scoped advisory locking
- SQLSTATE `23514` check violations

The account API contract is checked separately so export and deletion remain bound to `auth.user.id`.

Optional redacted artifact:

```bash
TWO_USER_ISOLATION_CONTRACT_REPORT_PATH=artifacts/two-user-isolation-contract.json \
node scripts/two-user-isolation-contract-audit.mjs
```

## 2. Safe two-user bearer/cookie production probe

The runtime probe is intentionally non-destructive:

```bash
node scripts/two-user-isolation-probe.mjs
```

Required runtime inputs:

```text
SCORECASTER_ISOLATION_SUPABASE_URL
SCORECASTER_ISOLATION_SUPABASE_PUBLISHABLE_KEY
SCORECASTER_ISOLATION_BASE_URL
SCORECASTER_ISOLATION_USER_A_TOKEN
SCORECASTER_ISOLATION_USER_B_TOKEN
```

For full cookie-path evidence also supply the dedicated test-session cookie headers through:

```text
SCORECASTER_ISOLATION_USER_A_COOKIE
SCORECASTER_ISOLATION_USER_B_COOKIE
```

These values must come from dedicated disposable test accounts. Do not write them into GitHub, CI variables that print values, documentation or release artifacts.

### What the safe probe does

For every reviewed table:

1. resolves test-account A and B identities through Supabase Auth
2. verifies A and B are distinct
3. verifies each user can see at least one of their own dedicated fixture rows
4. asks A to select rows whose owner is B
5. asks B to select rows whose owner is A
6. requires both cross-user reads to return zero rows
7. on reviewed writable tables, asks A to perform `owner = owner` against B-owned rows
8. requires that no B row is returned or changed
9. re-reads B's own count to confirm the no-op update probe did not alter fixture visibility

The update probe deliberately writes the same owner value back. Even a broken policy would therefore not change the stored value; however a returned B row is still treated as a security failure.

### Account export evidence

The probe calls `/api/account/export` for both dedicated users through bearer authentication and, when cookie headers are supplied, through web-cookie authentication.

The payload is inspected only in memory. The report records whether every exported object/row belongs to the authenticated user. The export payload itself is not retained by the harness.

### Redaction

The report never contains:

- raw user UUIDs
- bearer tokens
- cookies
- passwords
- service-role values
- publishable-key values

User identities are represented by short SHA-256 fingerprints solely so A and B can be distinguished in the evidence file.

The safe runtime probe **cannot** mark the full #93 release gate as passed because it intentionally does not attempt destructive DELETE, cross-user INSERT, account deletion or hard-cap writes.

## 3. Rollback-only transactional production probe

Use:

```text
scripts/two-user-isolation-transactional-probe.sql
```

Run it only in the production Supabase SQL Editor with two dedicated disposable test-account UUIDs. Replace:

```text
__USER_A_UUID__
__USER_B_UUID__
```

Do not paste account passwords, bearer tokens, cookies or service-role keys into the SQL.

The script starts with `BEGIN` and ends with `ROLLBACK`.

Before switching into user A's authenticated database role it verifies that both dedicated users have fixture rows in every reviewed isolation table. Missing fixtures abort the evidence run.

As authenticated user A it then attempts against B-owned rows:

- SELECT
- owner-preserving UPDATE
- DELETE

Read-only tables may reject UPDATE/DELETE at the grant boundary; writable tables must expose zero B rows through RLS. Any unexpected affected row raises and aborts the transaction.

The DELETE is safe for production evidence because the entire SQL session is rollback-only. If a broken policy unexpectedly allowed a delete, the raised exception/outer rollback prevents that test deletion from becoming persistent.

## Database hard-cap execution

The same rollback-only SQL transaction executes four independent database-level rejection scenarios against user A's paper account.

### Autonomous stake > 1%

An autonomous paper insert at `1.01%` of bankroll must raise the V13 database trigger's 1% hard-cap check violation.

### Duplicate same event

The first valid autonomous paper row is inserted inside a PL/pgSQL exception subtransaction; the second row for the same event/day must raise the duplicate-event violation. The exception block rolls both temporary rows back.

### Daily paper exposure > 5%

A temporary non-autonomous 4.5% paper exposure is combined with a 0.75% autonomous attempt in another league. The autonomous attempt must be rejected by the 5% daily database cap.

### Same-league exposure > 2.5%

A temporary 2.25% same-league paper exposure is combined with a 0.5% autonomous attempt. The attempt must be rejected by the 2.5% same-league database cap while total daily exposure remains below 5%.

At the end the script confirms that none of its marker rows remain even inside the transaction, emits one machine-readable success JSON row and then executes `ROLLBACK`.

## Cross-user INSERT evidence

The repository contract verifies every writable table's `WITH CHECK (auth.uid() = owner)` policy and authenticated grant boundary. A generic browser/runtime INSERT probe is not used because deliberately inserting a B-owned row from A could create data if production RLS were broken.

If direct cross-user INSERT execution is required for release review, run it only inside a separately reviewed rollback-only SQL transaction or an equivalent PostgREST environment that demonstrably applies transaction rollback. Do not weaken this harness to perform potentially persistent cross-user inserts merely to satisfy a checkbox.

## Account deletion evidence

`DELETE /api/account` destroys the authenticated account and must therefore be tested only with a disposable dedicated account. The repository audit verifies that both profile deletion and Supabase Auth deletion use `auth.user.id`.

For production completion:

1. create a disposable deletion test account C
2. create only C-owned paper state
3. retain before-count evidence without raw row contents
4. call account deletion as C through the reviewed authenticated path
5. verify C auth identity and C-owned cascaded state are gone
6. verify A and B counts are unchanged
7. retain only redacted counts/fingerprints

Do not use A or B for this destructive deletion test because their rows are needed for the isolation matrix.

## Production evidence matrix

A complete #93 production review should retain references to:

- repository contract JSON
- safe two-user bearer/cookie probe JSON
- rollback-only SQL success JSON
- disposable account-deletion evidence
- production public-schema hardening V1.2 evidence from #99
- successful release JSON linking the manual `two-user-isolation` gate

The release gate remains `unverified` until every required layer exists. Missing fixtures or missing cookie evidence are blockers, never automatic passes.

## Failure handling

If any cross-user probe returns a row or affects a B-owned row:

1. treat the run as a security failure
2. keep production activation blocked
3. preserve the redacted evidence and exact table/operation name
4. do not copy raw rows, UUIDs, cookies or tokens into the issue
5. inspect the table grant and RLS policy
6. re-run public-schema hardening verification #99
7. fix the narrow policy/grant defect
8. repeat both safe and rollback-only probes with fresh test fixtures

Do not restore broad `anon` or `authenticated` grants as a workaround.

## Permanent product boundary

These probes test authorization and paper-account risk caps only. They add no bookmaker credentials, deposits, withdrawals, Cash Out or real-money execution. All hard-cap writes are virtual paper rows and the transactional probe rolls them back.
