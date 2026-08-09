# Scorecaster Vercel Deployment Policy V1

## Goal

Keep automatic **production** deployment from `main`, while preventing feature-branch commit churn from exhausting Vercel preview build quota.

## Policy

`vercel.json` runs:

```text
node scripts/vercel-ignore-build.mjs
```

Vercel's `ignoreCommand` semantics are:

- exit `0` → ignore/skip the build
- exit `1` → continue the build

Scorecaster maps environments as follows:

| `VERCEL_ENV` | Result |
| --- | --- |
| `preview` | skip automatic build |
| `production` | continue build |
| missing/unknown | continue build (fail-safe) |

The policy deliberately fails **toward building**, never toward silently skipping, when the environment is unknown.

## Why

Scorecaster has extensive GitHub validation already, including the canonical production build, security regressions, CodeQL and feature-specific CI. Automatic Vercel preview builds on every small feature-branch commit duplicated that work and repeatedly exhausted the Vercel build-rate limit. Once the quota was exhausted, new `main` commits could not reach production, which also blocked production-evidence verification.

## What remains automatic

- GitHub CI on pull requests and pushes
- GitHub production build checks
- CodeQL and security workflows
- Vercel production deployment for `main`
- existing Vercel cron configuration

## Preview builds

Preview builds are no longer automatic. When a preview is genuinely needed for manual visual verification, create one explicitly rather than for every feature-branch commit.

## Safety boundary

This policy changes deployment scheduling only. It does not modify application runtime behavior, provider data, probabilities, staking, user data or the paper-only boundary.
