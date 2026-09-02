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

## Stale-evidence protection

`config/live-data-cache-implementation.json` fingerprints exactly the cache-relevant implementation:

- `config/live-data-cache-boundary.json` policy
- `next.config.js`
- `app/components/PwaRegister.jsx`
- `public/sw.js`
- the deterministic SHA-256 tree of every `app/api/**/route` source

The cache evidence regression recomputes those SHA-256 values from the actual repository sources. A change to the API header rule, PWA registration, service worker, or cache policy makes the retained production proof stale and blocks the test until production is re-probed and the reviewed evidence is deliberately refreshed.

Unrelated application changes do not invalidate the retained proof merely because the Git commit changes.

## Current retained observation

The retained V1 evidence records two consecutive production observations for each of `/api/health`, `/api/recommendations?limit=1`, and `/api/top-picks?view=summary` from deployment `dpl_5eYppxkytAGEQojqnpVMmhM7nkQW`, commit `2a11018e150ccbf4e4e488d3f835143b4302dfab`. All six observations were HTTP 200 with `Cache-Control: no-store` (optionally including `max-age=0`), `Age: 0`, and `x-vercel-cache: MISS`.

The response body itself is not retained in the evidence document.

## Safety boundary

This changes release evidence only. It does not enable betting execution, bookmaker login, deposits, withdrawals, Cash Out, model promotion, or any other real-money behavior. Scorecaster remains paper-only.
