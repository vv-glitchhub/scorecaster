# Scorecaster — Free-Data-First pivot (draft, 2026-10-19)

## Product direction

Prioritize independent sports forecasts built from traceable match results and performance statistics, not odds-provider consensus. Historical football xG/Poisson research already exists in `docs/ZERO_COST_FOOTBALL_MODEL_LAB_V1.md`, but is research-only: do not promote it into production without rights verification, chronological evaluation and holdout evidence.

1. **Results and verified fixtures** — capture allowed, attributable, timestamped sources and outcomes.
2. **Independent prediction lab** — create pre-match features without leakage, publish uncertainty and Brier/log-loss calibration on held-out games.
3. **Explainable match previews** — display quality flags and missing inputs; never invent odds, timestamps, lineups or wins.
4. **Paper-only tracking** — keep virtual picks and learn from outcomes without any real-money features.
5. **Optional future market comparison** — gated behind a rights-approved and budget-approved licensed provider; independent model must remain useful without it.

## Immediate low-cost runtime switch

Set the **server-only** environment variable `SCORECASTER_FREE_DATA_ONLY=true` to block known paid entry points: primary odds, sports catalogue lookup, secondary SportsGameOdds, SportsData, NewsAPI, OpenAI Agent V10 enhancements, and odds-based paper-score loading. Existing deterministic explanation fallback and the static league catalogue remain available.

**This does not cancel any subscription and does not guarantee every third-party connector is blocked.** To prevent unwanted charges, cancel provider subscriptions in their own billing dashboards, remove all unused third-party secrets from Vercel/GitHub, disable fee-bearing scheduled tasks, then redeploy and verify external request logs. Do not remove `SUPABASE_SERVICE_ROLE_KEY` or user-auth keys without a separate auth migration plan.

Expected temporary limitation: `/api/odds` returns 503 with `errorCode=paid-odds-disabled`, and `/api/top-picks` (whose current contract requires provider-verified prices) may report unavailable. This is safer than fabricating PLAY, EV, market probabilities, fixtures or prices. Build a separate independent prediction output for non-market experiences in the next PR.

## Database capacity blocker

Supabase Free includes 500 MB database size; on 2026-10-19 Scorecaster database measured about 2,792 MB. This can cause service restrictions regardless of provider payment. Plan a read-only inventory, export/verify backups and a user-reviewed retention/archival plan before any deletion. Preserve bets, closing lines, model evidence, event identities and training provenance. Check PR #356 before overlapping recovery work.

## Source rights gate

- StatsBomb Open Data: historic research scope and attribution; never assume permission for commercial production.
- Football-Data.co.uk historical CSV: investigate redistribution, model training and commercial use for intended product; don't mirror raw licensed CSV without permission.
- TheSportsDB: free API has usage restrictions and its terms prohibit publishing an app-store app without a paid subscription; do not assume the free tier authorizes native release.
- football-data.org: free rate-limited API is not the same as unrestricted commercial redistribution; review plan and terms.
- Scraping sites or bypassing rate limits is not an alternative to API licensing.

## Release and acceptance gates

- [ ] Clear subscription list: current providers, active billing accounts, renewal dates and cancellation evidence.
- [ ] `SCORECASTER_FREE_DATA_ONLY=true` prevents all configured paid external calls in a staging deployment (provider logs independently checked).
- [ ] Existing history and user-specific RLS/auth remain intact.
- [ ] No synthetic live odds or unsupported PLAY from unavailable data.
- [ ] Audit and back up database, then design an approved retention plan under Free quota.
- [ ] Approved free/owned data-source contracts and stable IDs for first football league.
- [ ] Baseline independent model: strict chronological split, Brier/log loss/calibration, coverage/latency and failure rate.
- [ ] Production UI separately labels `unavailable`, `research`, `validated forecast` and `market price`; release only after UX regression checks.
