# Live Data Cache Boundary V1

Scorecaster live-data API traffic is network-only. The web application does register the reviewed `/sw.js` service worker, but that worker exits immediately for same-origin paths beginning with `/api/` before any `event.respondWith(...)`, Cache API lookup or cache write can handle the request. Every `/api/*` response is also covered by the reviewed `Cache-Control: no-store, max-age=0` rule in `next.config.js`.

The current service worker may cache only the explicit offline shell/static-asset paths covered by its destination rules. It must never provide a cached fallback for API traffic.

This boundary is release-critical because stale odds, fixture state, provider health or decision evidence must never be presented as a fresh response from an offline/runtime cache.

## Repository gate

Run:

```bash
npm run test:cache-boundary
npm run cache:live-data-audit
npm run release:audit
```

The audit verifies the exact reviewed structure:

- the global `/api/:path*` header rule contains `no-store` and `max-age=0`
- `PwaRegister.jsx` registers only the reviewed `/sw.js`
- the worker keeps the non-GET and same-origin guards
- `if (url.pathname.startsWith("/api/")) return;` exists before the first `event.respondWith(...)`
- the offline asset allowlist contains no `/api/` route
- no second unreviewed service-worker registration or cache handler appears elsewhere
- Workbox/generic `runtimeCaching` cannot be introduced silently
- the paper-only product boundary remains unchanged

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

Any expansion of PWA/runtime caching is a separate reviewed change. If additional offline caching is introduced later:

1. live `/api/*` requests must continue to return before any generic runtime-cache route or `event.respondWith(...)`
2. no cached live API response may be used as a fallback when the network fails
3. static asset/offline-page caching must stay scoped so it cannot match API traffic
4. every additional worker registration or caching library must be explicitly represented in this audit rather than globally allowlisted
5. production probe evidence must be regenerated after deployment

Do not weaken the gate by broadly allowing Workbox, runtime caching or additional service workers without an explicit route-level network-only proof.

## Product boundary

This work changes caching and evidence only. Scorecaster remains sports analysis, risk control and virtual paper tracking. It does not add bookmaker login, deposits, withdrawals, Cash Out or real-money execution.
