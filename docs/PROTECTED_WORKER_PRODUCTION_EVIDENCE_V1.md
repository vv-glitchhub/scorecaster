# Protected Worker Production Evidence V1

This layer preserves a reviewed unauthenticated production probe for every internal worker declared in `config/release-readiness.json`.

## What it proves

The retained observation verifies the external fail-closed boundary only. No valid `CRON_SECRET`, authorization credential or service-role key is sent. A passing production probe therefore demonstrates that the route rejects an unauthenticated request with a status explicitly allowed by the release manifest before the request can be treated as an authorized worker invocation.

The static repository contract remains a separate prerequisite. `scripts/protected-worker-contract-audit.mjs` checks every declared route for:

- configured-secret / `CRON_SECRET` guard
- authorization guard
- explicit 503 fail-closed path
- explicit 401 unauthorized path
- `Cache-Control: no-store`
- authorization visible before worker/admin actions

The same audit fingerprints the canonical worker declaration plus SHA-256 of every worker route source. Retained production evidence is valid only for that exact fingerprint.

## Current reviewed production observation

Worker-only SportsGameOdds release deployment `dpl_H5Mg5RXJLG3wLUAKtyykmvyYSDP4`, merge commit `ad866939ecd2a84afcd3db9c7d77904ce624a5f3`, was READY in production and probed without authorization headers or CRON secret on 2026-08-09.

Current protected-worker implementation fingerprint:

`b33626e3f73c6b951f3f8ab9169a214fde9cc05c1f43e351e7405a64c65563f8`

All nine declared routes returned HTTP 401:

- `/api/internal/watchlist-monitor`
- `/api/internal/settlement-monitor`
- `/api/internal/autonomous-agent`
- `/api/internal/shadow-learning`
- `/api/internal/notification-delivery`
- `/api/internal/decision-diagnostics`
- `/api/internal/unified-data`
- `/api/internal/sports-analytics`
- `/api/internal/collector`

Every retained response also recorded `Cache-Control: no-store`, `Age: 0` and Vercel cache state `MISS`. Review reference: `github-issue-184#post-deploy-worker-probes-ad866939`.

Raw response bodies, provider payloads, user identifiers, credentials and secret values are not retained.

## Stale protection

`config/protected-worker-implementation.json` stores the current repository worker-contract fingerprint. CI recomputes it from the manifest and route sources.

A worker route change creates an intentional two-stage state:

1. repository contract audit must pass for the new implementation fingerprint;
2. the previously retained production probe becomes `stale` and every worker evidence entry becomes `unverified`;
3. release evidence remains blocked for worker production proof;
4. after the new implementation is deployed, all nine unauthenticated routes are probed again;
5. only an explicitly reviewed production document with the new fingerprint can restore `passed` status.

Repository CI may carry a stale/unverified state during a reviewed worker change, but that state is never production proof. The worker-only SportsGameOdds release completed this cycle: its old evidence was invalidated before merge, the changed worker route was deployed, and all nine production probes were repeated before the retained evidence was refreshed.

## Release artifact trust boundary

`/api/production-evidence?format=release` reads `config/production-worker-probe-evidence.json` only through `buildTrustedProtectedWorkerProbeEvidence()`.

The public request cannot submit worker status, CRON secret, authorization state or worker-probe evidence through query parameters. The release artifact receives `workerProbeEvidence` only after the trusted document passes all validation.

A valid retained document requires:

- exact implementation fingerprint match
- production deployment and `scorecaster.vercel.app` host
- exactly one probe for every declared worker, with no missing/extra/duplicate route
- matching HTTP method
- status present in that route's `allowedStatuses`
- explicit probe timestamp
- `no-store`, zero Age and no `HIT`/`STALE` cache replay
- no credential sent
- no raw response body, secret value, user identifier or provider payload retained
- a non-secret evidence reference

Any failure makes every retained worker entry `unverified`.

## Safety

This evidence does not execute a worker with valid authorization and does not create paper rows. It does not enable bookmaker login, deposits, withdrawals, Cash Out or real-money execution. Scorecaster remains paper-only.
