# Public Surface Production Evidence V1

This evidence layer proves that every route declared in `config/release-readiness.json` under `publicPages` is reachable in production and receives the required global security headers.

## Static contract

`scripts/public-surface-contract-audit.mjs` resolves every declared page to a repository `app/.../page.*` source and loads the real `next.config.js` header configuration.

The contract requires:

- every declared public page has a repository page source
- no duplicate public page declarations
- the global `/:path*` rule contains every `requiredSecurityHeaders` key with the exact manifest value

The deterministic implementation fingerprint covers:

- every public route
- the resolved page source path and SHA-256
- the complete required security-header map
- `next.config.js` SHA-256

A public page source, global Next header configuration, page declaration or required security-header change therefore invalidates retained production evidence until the public surface is re-probed and reviewed.

## Production probe

`scripts/public-surface-production-probe.mjs` accepts only HTTPS production host `scorecaster.vercel.app` and GETs every declared public page.

Each page must return:

- HTTP 200
- HTML content type
- exact required security headers

The probe records only bounded metadata:

- page path
- observation timestamp
- HTTP status
- content type
- the five allowlisted required security headers
- numeric Age header when available
- bounded Vercel cache state

The response body is never read or retained. The script cancels the response stream after headers are inspected.

## Current reviewed evidence

GitHub Actions workflow run `31271802029` produced artifact `9025825753` against active production deployment `dpl_4nMnhEvsfo4f4o6fwoSmY2dj3qKf`, commit `51918b2d35a564178dcc814be3d53d651d4f5828`.

Result: **15/15 declared public pages returned HTTP 200 and all five required security headers matched exactly.**

Required headers:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Resource-Policy: same-origin`

Public pages may legitimately be served from Vercel `HIT` or `PRERENDER` cache states. `STALE` is not accepted by the retained evidence validator. Live `/api` cache safety remains a separate stricter network-only gate.

Current public-surface implementation fingerprint:

`0f16d30368e3bacfb7352dd779da70e206c6782fd47e5822dfc10d2aeca64854`

## Trusted retained evidence

`buildTrustedPublicSurfaceEvidence()` validates `config/production-public-surface-evidence.json` against the current implementation and release manifest.

The retained package passes only when:

- evidence and contract schema versions are supported
- implementation fingerprint matches exactly
- deployment is production on `scorecaster.vercel.app`
- workflow run and artifact IDs are explicit integers
- exactly one probe exists for every declared page
- no page is missing, duplicated or extra
- every page returns 200 and HTML
- Age metadata is explicit, non-negative and integral
- cache state is present and is not `STALE`
- every required security header matches exactly
- evidence timestamp is not older than the latest retained probe
- page body read/retained, credentials, cookies, authorization, user data and secret retention flags are all explicitly false
- the evidence reference is non-secret

Any validation failure makes the entire retained public-surface package `unverified`.

## Canonical Release JSON

`buildProductionReleaseEvidence()` now includes a `publicSurfaceProbes` evidence class. If the manifest declares public pages and any page lacks current trusted evidence, the artifact adds blocker:

`public-surface-probes-unverified`

`/api/production-evidence?format=release` can populate this evidence only from repository-maintained trusted evidence. Public query parameters cannot self-certify page availability or security headers.

## Safety

This is a read-only public production check. It does not use login sessions, bearer tokens, service-role keys, bookmaker credentials, user data or provider payloads. It does not enable deposits, withdrawals, Cash Out or real-money execution. Scorecaster remains paper-only.
