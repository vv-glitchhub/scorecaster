# Production Live-Cache Evidence V1

This evidence layer preserves a reviewed production observation for the `live-data-pwa-cache-boundary` release gate without treating repository CI or a public request as production proof.

## Trust model

The public `/api/production-evidence?format=release` route does not accept a gate status, `productionVerified` flag, manual evidence payload, or cache proof from query parameters. It reads the reviewed repository document `config/production-manual-gate-evidence.json` and validates it through `buildTrustedLiveDataCacheGateEvidence()`.

A retained `passed` state is accepted only when all required checks pass:

- the evidence belongs to `live-data-pwa-cache-boundary`
- the evidence type is the reviewed double-production-probe format
- the verified deployment is explicitly production on `scorecaster.vercel.app`
- at least two distinct production probes are retained
- every probe is HTTP 200
- every probe contains the required `no-store` cache-control token
- every retained Age value is at or below the policy maximum, currently zero
- no probe is `HIT` or `STALE`
- the retained implementation fingerprint equals the current cache implementation fingerprint
- no raw response body, secret value, user identifier, or provider payload is retained

Missing or malformed evidence becomes `unverified`; it is never imputed as passed.

## Cache-relevant implementation boundary

`config/live-data-cache-implementation.json` fingerprints the sources that define whether live API traffic can be cached:

- `config/live-data-cache-boundary.json` policy
- `next.config.js`
- `app/components/PwaRegister.jsx`
- `public/sw.js`
- the deterministic set of `app/api/**/route` paths

The route tree is intentionally a **route-surface fingerprint**, not a hash of unrelated business logic inside every API handler. This avoids an impossible pre-deployment evidence cycle where any ordinary API implementation change would invalidate production cache proof before that change could be deployed.

Content-level cache safety remains strict. `scripts/live-data-cache-boundary-audit.mjs` scans the actual API source on every CI run and blocks any route that introduces public CDN caching such as `public`, `s-maxage`, or `stale-while-revalidate`. It also verifies the global API header rule, service-worker API bypass, offline asset allowlist, reviewed service-worker registration, and paper-only product boundary.

A change to the cache policy, global headers, service-worker behavior, PWA registration, or API route surface still invalidates retained production evidence and requires a deliberate refresh.

## Current retained observation

The retained evidence is bound to cache implementation fingerprint:

`d2117db236f726e3235241bc9aaa05f389c4b023f94966ef826a3600bd8e65b1`

It records two consecutive production observations for each of:

- `/api/health`
- `/api/recommendations?limit=1`
- `/api/unified-data/freshness`

The observations were made against production deployment `dpl_D6eswLJRPba3BqEbgGFzah9WNKNj`, commit `883f730c84ab0f718f8bcf4a2accac6ea291e65b`, on `scorecaster.vercel.app` on 2026-09-04. All six observations were HTTP 200 with `Cache-Control: no-store` (optionally including `max-age=0`), `Age: 0`, and `x-vercel-cache: MISS`.

The redacted evidence artifact is:

`artifacts/live-data-cache-production-probe.json#5a9e5c22f0847f916a325bf533a404d04bc3cf221e8d7ea09a08a5a4b5aa5044`

No response body is retained in the evidence document.

## Safety boundary

This changes release evidence only. It does not enable betting execution, bookmaker login, deposits, withdrawals, Cash Out, model promotion, or any other real-money behavior. Scorecaster remains paper-only.
