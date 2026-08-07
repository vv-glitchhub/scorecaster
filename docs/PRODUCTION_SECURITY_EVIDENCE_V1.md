# Scorecaster Production Security Evidence V1

## Status

This package prepares the repository and production-safe probes required by WP0.2 / issue #92. It does not claim that production secrets are configured or that authenticated workers have been executed successfully.

The boundary is intentionally split into four evidence types:

1. static protected-worker contract audit
2. redacted configuration-presence evidence
3. guard-only production probes with no valid cron credential
4. client bundle/source secret-boundary audit

Real production completion still requires approved runtime configuration, actual worker-cycle evidence and retained release artifacts.

## 1. Protected-worker contract audit

Run:

```bash
node scripts/protected-worker-contract-audit.mjs
```

The audit reads `config/release-readiness.json` and checks every declared internal worker route.

Each route must visibly provide:

- a configured cron-secret gate
- an authorization gate
- a fail-closed 503 path when required worker configuration is absent
- an unauthorized 401 path
- `Cache-Control: no-store`
- authorization rejection before the first visible worker/admin action

The audit is static only. It does not read the cron-secret value and does not invoke a worker.

Optional machine-readable output:

```bash
PROTECTED_WORKER_CONTRACT_REPORT_PATH=artifacts/protected-worker-contract.json \
node scripts/protected-worker-contract-audit.mjs
```

## 2. Redacted production configuration evidence

The variable classification is in:

```text
config/production-security.json
```

Required public browser configuration:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Required server-only production variables for the current core release boundary:

- `SUPABASE_SERVICE_ROLE_KEY`
- `ODDS_API_KEY`
- `CRON_SECRET`
- `AGENT_DECISION_SIGNING_KEY`

Conditional server-only integrations such as OpenAI, SportsGameOdds, news/context, Sports Analytics and Collector keys are classified separately.

Generate a redacted report:

```bash
node scripts/production-security-report.mjs
```

The report contains only variable names and booleans indicating presence. It never writes environment values.

In repository/CI mode missing production variables are informational. In an approved environment where the production variables are expected to exist, use:

```bash
node scripts/production-security-report.mjs --require-present
```

The report fails if a server-only variable has a forbidden `NEXT_PUBLIC_` or `EXPO_PUBLIC_` alias.

## 3. Guard-only production worker probes

`npm run release:smoke` / `scripts/production-smoke.mjs` now probes every protected internal worker twice:

- without an Authorization header
- with a fixed, intentionally invalid probe credential

A valid `CRON_SECRET` is **never** supplied by these guard probes. Therefore these checks must terminate at the authentication/configuration boundary before worker execution.

The resulting `artifacts/production-smoke.json` includes a `workerProbeEvidence` map compatible with the Production Release Evidence artifact builder. Each worker records:

- `passed` / `failed`
- observation timestamp
- unauthenticated HTTP status
- invalid-credential HTTP status
- duration for each guard probe
- `workerInvokedByProbe: false`
- `validCredentialUsed: false`

This evidence proves the public guard behavior only. It does not prove that an authenticated scheduled cycle succeeds. Successful runtime worker-cycle evidence remains a separate Production Evidence requirement.

### Why the probe does not use the real cron secret

Many internal GET routes perform real collection, settlement, monitoring or learning work after successful authentication. A security probe must not trigger those side effects merely to test authentication.

The valid-worker path is therefore evidenced by normal scheduled worker runs and their persisted audit/denominator records, not by an ad hoc security request.

## 4. Client secret-boundary audit

After a web production build:

```bash
npm run build
node scripts/client-secret-boundary-audit.mjs --require-web-build
```

The audit scans:

- `.next/static` client assets
- `mobile/src` source that will enter the native client bundle

The web-build boundary fails on:

- forbidden public aliases of server-only names
- OpenAI-style secret values
- Supabase `sb_secret_` values
- private-key blocks

A literal server environment-variable **name** in a generated Next.js chunk is recorded as review metadata rather than treated as a leaked secret value. Next.js does not make non-`NEXT_PUBLIC_` environment values available to browser code merely because the variable name is present. The report therefore separates `warnings` from actual `violations`.

The native-source boundary is stricter: a server-only variable name has no legitimate role in `mobile/src`, so it remains a failure there. Forbidden public aliases and secret-shaped values also fail.

This distinction prevents a harmless environment-variable name from masking the actual acceptance criterion: no server secret **value** may enter a client bundle, and no server-only variable may be intentionally exposed through a public alias.

The report explicitly states that a signed iOS/Android bundle has not yet been inspected. Signed bundle verification remains part of the physical mobile release work in #97/#12.

## Production evidence sequence

When production access is approved, retain all of the following without secret values:

1. `production-security.json` from `production-security-report.mjs --require-present`
2. `protected-worker-contract.json` from the static contract audit
3. `production-smoke.json` from the production base URL
4. `client-secret-boundary.json` from the built web client audit
5. Production Evidence worker-cycle denominators showing successful scheduled runs
6. Release JSON linking the worker probes, deployment, migration proof and manual release gates

Do not mark worker probes as passed in a release artifact from user-supplied browser values. Evidence references must come from the controlled release process.

## Fail-closed expectations

For every internal worker:

- missing cron configuration returns the declared unavailable status
- missing auth is rejected
- invalid auth is rejected
- rejected probes create no paper rows, settlement writes or learning records
- no response body exposes secret values
- worker responses are no-store

Short-lived token expiry is not a property of the shared cron bearer secret. Therefore “expired cron token” is not fabricated as a test case. User-session expiry remains part of authenticated account testing, while `CRON_SECRET` is rotated/revoked rather than expired.

## Emergency stop and rollback

If a worker or production security gate behaves unexpectedly:

1. keep `SCORECASTER_SHADOW_LEARNING_ENABLED=false`
2. disable the affected Vercel Cron schedule / worker trigger
3. use the existing Autonomous Agent emergency-stop controls to disable user opt-in where relevant
4. do not rotate a secret merely to hide a functional failure; first preserve the redacted evidence and logs
5. if credential exposure is suspected, rotate the affected server-only credential in the provider and Vercel
6. redeploy after rotation so old runtime instances no longer receive the previous value
7. re-run the guard-only smoke probes
8. verify Production Evidence worker cycles and backlog before re-enabling the schedule
9. never restore broad database grants or weaken worker authorization as a workaround

For a suspected `CRON_SECRET` leak, rotate it in both the production runtime and the approved scheduler source before re-enabling workers. Never write the old or new value into GitHub issues, CI logs or release artifacts.

## Permanent product boundary

Production security work does not add bookmaker login, deposits, withdrawals, Cash Out or real-money execution. Scorecaster remains sports analysis, risk control and virtual paper tracking only.
