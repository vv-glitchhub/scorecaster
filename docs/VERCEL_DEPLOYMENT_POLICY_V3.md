# Scorecaster Vercel Deployment Policy V3

## Goal

Preserve automatic production deployment from `main` while preventing Scorecaster's slash-named development branches (`feat/...`, `fix/...`, `chore/...`, `agent/...`, `dependabot/...`) from creating automatic Vercel deployments.

## Why V2 was insufficient

V2 used:

```json
"deploymentEnabled": {
  "*": false,
  "main": true
}
```

Vercel documents that `deploymentEnabled` uses minimatch-style branch patterns and that unspecified branches default to enabled. Scorecaster branch names normally contain `/`. A later live PR proved that the single-star default did not reliably cover those slash branches: commit `773bde673ad009cd09aeef020d3417f9efa6fea0` on `feat/sportsgameodds-usage-telemetry-v1` created a READY preview deployment.

## V3 policy

```json
{
  "git": {
    "deploymentEnabled": {
      "**": false,
      "main": true
    }
  }
}
```

The recursive pattern is the default deny for Git branches, including slash-containing names. `main` remains explicitly enabled. Vercel documents that if multiple patterns match, any matching `true` allows deployment, so `main` remains deployable.

## Live branch verification

After the V3 config was committed to `chore/vercel-git-deployment-policy-v3`, a second commit was pushed to the same slash-containing branch. A Vercel deployment query after that second commit returned zero deployments. Additional V3 test/cleanup commits are expected to remain deployment-free as a continued live check.

The issue should only be closed after V3 is merged to `main` and a fresh slash-containing branch commit is observed with zero Vercel deployments.

## What remains automatic

- GitHub CI and security checks for pull requests
- CodeQL
- repository production-build tests
- Vercel Git production deployment for `main`, subject to account quota availability
- the existing production cron

## Manual previews

Automatic preview deployments are disabled. An explicit preview can still be created when deployment-specific visual verification is genuinely required.

## Safety boundary

Infrastructure scheduling only. No provider data, probability, decision class, stake, user data, bookmaker authentication, payment or real-money execution behavior changes.
