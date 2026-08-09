# Scorecaster Vercel Deployment Policy V2

## Goal

Preserve automatic production deployment from `main` while preventing feature and pull-request branches from creating automatic Vercel deployments at all.

## Why V1 was insufficient

V1 used Vercel's Ignored Build Step (`ignoreCommand`) to cancel preview builds. That reduced build work, but Vercel applies the ignored step only after a deployment has already entered the build pipeline. Canceled builds still count toward deployment quotas and concurrent build slots. Scorecaster therefore continued to exhaust the Hobby deployment/build rate limits even though the preview build itself was canceled.

## V2 policy

`vercel.json` now applies Git deployment filtering before the normal deployment path:

```json
{
  "git": {
    "deploymentEnabled": {
      "*": false,
      "main": true
    }
  }
}
```

Vercel branch rules use glob matching. `*` disables automatic Git deployments generally; the explicit `main: true` rule keeps the production branch enabled.

The old `ignoreCommand` is removed. The old ignore-build helper and script are retired so there is a single deployment-control mechanism.

## What remains automatic

- GitHub CI and security checks for pull requests
- CodeQL
- repository production-build tests
- Vercel Git production deployment for `main`, subject to account quota availability
- the existing Vercel cron configuration

## Preview deployments

Feature and pull-request branches do not create automatic Vercel deployments. A preview can still be created explicitly when genuinely needed for visual or deployment-specific verification.

## Current quota recovery

This policy prevents future automatic preview deployment churn. It cannot retroactively remove deployments already counted in a rolling Vercel quota window. If the account is already rate-limited, production deployment resumes after the applicable quota window clears.

## Safety boundary

Deployment scheduling only. No provider data, model probability, decision class, stake, user data, bookmaker authentication or real-money execution behavior changes.
