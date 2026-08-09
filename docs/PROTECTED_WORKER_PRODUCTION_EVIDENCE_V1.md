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

Production deployment `dpl_G9VV6ecfECVx3NKfisaafRHry9Y1`, merge commit `805ef19a1493020aa34a6b824d814b6606ffb699`, was probed without authorization headers or CRON secret.

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

Every retained response also recorded `Cache-Control: no-store`, `Age: 0` and Vercel cache state `MISS`.

Raw response bodies are not retained.

## Stale protection

`config/protected-worker-implementation.json` stores the current repository worker-contract fingerprint. CI recomputes it from the manifest and route sources.

A worker route change creates an intentional two-stage state:

1. repository contract audit must pass for the new implementation fingerprint;
2. the previously retained production probe becomes `stale` and every worker evidence entry becomes `unverified`;
3. release evidence remains blocked for worker production proof;
4. after the new implementation is deployed, all nine unauthenticated routes are probed again;
5. only an explicitly reviewed production document with the new fingerprint can restore `passed` status.

Repository CI is allowed to carry this stale/unverified state during a reviewed worker change, but it is never treated as production proof. This prevents the previous route implementation from certifying a new worker implementation.

The worker-only SportsGameOdds acquisition change intentionally enters this state because `/api/internal/unified-data` changes its post-authorization capture behavior. The static auth boundary still has to pass before merge, and production worker evidence must be refreshed after deployment.

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
