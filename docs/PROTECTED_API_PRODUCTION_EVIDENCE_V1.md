# Protected API Production Evidence V1

This evidence layer preserves reviewed **unauthenticated** production probes for every API declared in `config/release-readiness.json` under `protectedApis`.

## What the evidence proves

The retained observation checks the external authentication boundary without supplying a valid session cookie, bearer token, service-role key or other credential. A passing probe therefore proves that an unauthenticated request is rejected with a status explicitly allowed by the release manifest.

The production observation is not enough by itself. A separate static contract audit fingerprints and verifies the repository implementation so retained runtime evidence becomes stale when a protected API route or declaration changes.

## Static contract

`scripts/protected-api-contract-audit.mjs` checks every declared protected GET route for:

- declared route file and exported handler
- direct `getAuthenticatedContext(request)` or a narrowly audited local `requireAuth()` wrapper that itself calls `getAuthenticatedContext`
- fail-closed unauthenticated return
- authentication guard visible before protected Supabase/data/action access
- a no-store response path
- manifest unauthenticated statuses limited to HTTP 401/403

The contract fingerprint covers:

- protected API path
- HTTP method
- allowed unauthenticated statuses
- route source SHA-256

A route source or protected-API manifest change therefore invalidates retained production evidence until a fresh production probe is reviewed.

## Current reviewed production observation

Production deployment `dpl_4nMnhEvsfo4f4o6fwoSmY2dj3qKf`, commit `51918b2d35a564178dcc814be3d53d651d4f5828`, was probed without authentication credentials.

All 12 declared routes returned HTTP 401:

- `/api/operations`
- `/api/account`
- `/api/account/export`
- `/api/cloud/bets`
- `/api/cloud/watchlist`
- `/api/cloud/alerts`
- `/api/cloud/notifications`
- `/api/cloud/watchlist-monitor`
- `/api/cloud/settlement-monitor`
- `/api/cloud/autonomous-agent`
- `/api/cloud/autonomy-mission-control`
- `/api/cloud/polymarket-intelligence`

Every retained observation also recorded `Cache-Control: no-store, max-age=0`, `Age: 0` and Vercel cache state `MISS`.

Raw response bodies, request IDs and user data are not retained.

## Trusted evidence rules

`buildTrustedProtectedApiProbeEvidence()` accepts the retained package only when:

- the evidence and implementation schemas are supported
- implementation fingerprints match exactly
- deployment is production on `scorecaster.vercel.app`
- exactly one probe exists for every declared protected API
- there are no missing, duplicate or extra routes
- method matches the manifest
- status belongs to the route's declared allowed status set
- timestamp is valid
- response has `no-store`
- Age is explicitly zero
- cache state is present and is not `HIT` or `STALE`
- no session credential or bearer token was sent
- no raw response body, secret, user data or request identifier is retained
- the evidence reference is non-secret

Any failure makes the whole package unverified and every derived protected API probe entry becomes `unverified`.

## Canonical Release JSON

`buildProductionReleaseEvidence()` now treats protected APIs as a separate evidence class. If the release manifest declares protected APIs and one or more are unverified, the artifact includes blocker:

`protected-api-probes-unverified`

`/api/production-evidence?format=release` supplies this evidence only from the repository-maintained trusted document. Public query parameters cannot submit protected API status or credentials.

## Safety

The probes are read-only unauthenticated GET requests. They do not read authenticated user data and do not perform bookmaker login, deposits, withdrawals, Cash Out or real-money execution. Scorecaster remains paper-only.
