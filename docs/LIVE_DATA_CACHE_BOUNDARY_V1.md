# Live Data Cache Boundary V1

Scorecaster live-data API traffic is network-only. The current web application does not register a service worker or use a PWA runtime cache, and every `/api/*` response is covered by the reviewed `Cache-Control: no-store, max-age=0` rule in `next.config.js`.

This boundary is release-critical because stale odds, fixture state, provider health or decision evidence must never be presented as a fresh response from an offline/runtime cache.

## Repository gate

Run:

```bash
npm run test:cache-boundary
npm run cache:live-data-audit
npm run release:audit
```

The audit fails closed when:

- the global `/api/:path*` no-store header rule disappears
- either required cache-control token disappears
- application/native/public source begins registering a service worker
- a fetch-handling service worker, Cache API usage, Workbox or generic `runtimeCaching` appears before a reviewed network-only exception exists
- the paper-only product boundary changes

Repository evidence explicitly sets `productionVerified=false`. Passing CI is not production proof.

## Production header probe

After the intended `main` deployment is live, run from an approved release-review environment:

```bash
node scripts/live-data-cache-production-probe.mjs \
  --origin=https://scorecaster.vercel.app \
  --require-production \
  --write
```

The probe requests each reviewed path twice and requires:

- `Cache-Control` contains `no-store`
- `Age` is absent or zero
- `x-vercel-cache` is not `HIT` or `STALE`
- no HTTP 5xx response

The generated artifact contains only allowlisted response headers, timing/status data and a SHA-256 evidence identity. Response bodies, cookies, authorization headers, secret values and personal data are not retained.

## Release Evidence

`live-data-pwa-cache-boundary` is a blocking manual release check in `config/release-readiness.json`. Public Release JSON therefore remains `unverified` for this gate until a trusted release-review process supplies retained production evidence. A public caller cannot clear the gate through query parameters.

## Future PWA/offline work

Adding a service worker is a separate reviewed change. If offline caching is introduced later:

1. live `/api/*` requests must be explicitly bypassed with network-only handling before any generic runtime-cache route
2. no cached live response may be used as a fallback when the network fails
3. static asset/offline-page caching must be scoped so it cannot match API traffic
4. this audit and regression suite must be updated to prove the exact network-only exception rather than simply allowing Workbox/service-worker patterns
5. production probe evidence must be regenerated after deployment

Do not weaken the gate by broadening allowed service-worker patterns without an explicit route-level network-only proof.

## Product boundary

This work changes caching and evidence only. Scorecaster remains sports analysis, risk control and virtual paper tracking. It does not add bookmaker login, deposits, withdrawals, Cash Out or real-money execution.
