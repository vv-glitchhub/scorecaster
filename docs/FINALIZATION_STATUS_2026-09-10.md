# Scorecaster Finalization Status — 2026-09-10

Scorecaster's web production path is release-ready for paper-only sports analysis and virtual tracking after the finalization passes merged in PRs #288 and #289.

## Completed

- Production deployment is bound to the latest reviewed `main` commit.
- `/api/health` reports production status and the active market universe.
- Daily browsing exposes the seven-day fixture directory and focused event analysis.
- Authentication return paths and password recovery UI are implemented.
- Paper tracking preserves local history through transient cloud failures and records explicit closing odds when available.
- Market null semantics no longer turn missing/stale evidence into fake zero values.
- Liiga remains a supported product league but is excluded from default/background scans while the primary provider does not advertise it. The provider gap is exposed explicitly in market-universe health.
- Intelligence Core reads recent verified outcomes, not the oldest bounded result set.
- Learning materialization selects the latest eligible pregame snapshot per owned football event and rejects post-kickoff/leakage-failed snapshots.
- Automatic model promotion remains disabled.
- PLAY gates, bankroll limits, user isolation and paper-only boundaries were not loosened.
- PR #289 passed the full visible CI matrix, including Scorecaster CI, CodeQL, Production Security Evidence, Production Evidence, External Production Readiness, Market Microstructure, Intelligence Core, Collector, Ready App and Top Picks smoke.

## Intentional fail-closed / not yet enabled

These are not silently treated as complete:

1. **Background push delivery** — notification schema/worker support exists, but production delivery remains disabled until a real-device registration, delivery and receipt test succeeds. Expo access token is not configured and no production device is currently registered.
2. **Lineup provider** — lineup-provider integration is not configured. Missing lineup evidence must remain unavailable and must not be invented or used to upgrade a decision to PLAY.
3. **Liiga primary market data** — the configured primary provider currently reports the league as unsupported. Restore default scanning only after provider capability is verified or a governed primary replacement is added.
4. **Supabase leaked-password protection** — the security advisor reports this Auth feature disabled. Enable it in Supabase Auth settings when the project plan supports it, then rerun the security advisor.
5. **Human account-flow acceptance test** — exercise sign-in, password reset, sign-out, sign-in return path, watchlist, paper-bet save, settlement and account deletion with a non-production-risk test account before broader external onboarding.

## Model validation state

Learning/calibration tables being empty is not, by itself, a pipeline failure at this stage:

- learning examples require a chronology-safe pregame feature snapshot plus a later verified final outcome;
- calibration observations require settled paper decisions;
- Validation Lab must remain conservative until enough eligible out-of-sample evidence accumulates.

The product must not claim proven market outperformance or future profitability until the governed validation thresholds are met on untouched evidence.

## Release boundary

Scorecaster remains an analysis, risk-control and paper-tracking product only. It does not execute bets, store bookmaker credentials, hold a real-money balance, or permit model learning to bypass the reviewed promotion process.
