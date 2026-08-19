# Production Protected API Evidence — 2026-08-19

## Scope

The retained unauthenticated production probe set now covers 13 declared protected GET APIs, including `/api/cloud/autonomous-agent/risk-profile`.

## Deployment

- deployment: `dpl_3DvG3xjsuuBhXpmZpvvAGVD83XBs`
- commit: `1b0bee99f654bf4cbb8735872a7fc290d70106be`
- environment: production
- host: `scorecaster.vercel.app`
- implementation fingerprint: `3b5f06108d2445b961465dd01b442a1d9ba2c222bda0d8ae8779c03298803b06`

## Result

All 13 routes returned HTTP 401 without a session credential or bearer token. Every retained response had Age 0, a no-store cache policy and Vercel cache MISS. No response body, request identifier, user data, cookie, credential, bearer token or secret value is retained in the canonical evidence document.

The new autonomous risk endpoint was observed at 2026-08-19T04:04:48Z. The remaining protected routes were freshly reprobed on the same production deployment between 2026-08-19T04:06:40Z and 2026-08-19T04:10:43Z.

## Boundary

These are unauthenticated GET probes only. They do not run protected workers, create paper picks, mutate user settings or execute any real-money action. The Scorecaster product boundary remains sports analysis, risk control and paper tracking only.
