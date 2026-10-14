# Scorecaster: Probability × Value — product and validation contract

Status: design contract, not a claim of profitability. Keep all existing PLAY evidence and freshness gates.

## Objective
Find bets with both a high *calibrated* win probability and a positive *conservative* expected value, while minimizing drawdown. Do not equate a high hit rate with profit. Do not promise wins or select bets solely because the odds are short.

## Candidate requirements
1. Only verified, upcoming provider fixtures with attributable market odds, timestamps, and bookmaker counts. Missing or stale evidence => no PLAY.
2. Use a separately trained, out-of-sample calibrated model probability; show its version, sample size, validation window, and uncertainty. Market consensus alone is not independent model evidence.
3. Compute decimal-odds break-even probability p_be = 1 / odds and expected return per unit stake EV = p_model * odds - 1 (before fees). Reject EV <= 0.
4. Prefer a conservative probability p_low from calibration uncertainty. Require p_low * odds - 1 > 0 for high-confidence recommendations; otherwise WATCH even when point-estimate EV is positive.
5. Preserve the current independent intelligence, model-evidence, market freshness, and safety gates. No threshold relaxation just to fill the daily Top 3.
6. Risk budget: display fractional Kelly only as optional analysis, capped by conservative exposure limits; never auto-place real-money bets. Correlated bets share an exposure budget.

## Two transparent rankings
- High Probability + Value: order qualifying positive-conservative-EV candidates by calibrated win probability, then conservative EV and data quality.
- Maximum Value: order qualifying candidates by conservative EV, then model confidence and risk.
Both rankings can be empty. Show the reason and provider status instead of fabricated picks.

## Validation before any profitability claim
- Chronological train/validation/test split; no future odds, final lineups, results, or closing prices leaked into predictions.
- Freeze pre-match predictions and offered prices before settlement.
- Report per league/market and overall: sample size, hit rate vs implied probability, Brier score, calibration curve, ROI after fees, CLV, max drawdown, confidence intervals, and benchmark comparisons.
- Evaluate actual executable bookmaker prices, limits, voids, and market availability.
- Paper-track for a meaningful forward window. Promote to production recommendations only after reproducible evidence; never guarantee profit.

## Current release blocker (2026-10-14)
Preview of PR #356 builds READY, but /api/top-picks returned HTTP 503 with 12/12 provider leagues unavailable. Supabase unified_data_snapshots and market_provider_snapshots_v2 last updated 2026-09-30. Restore verified data flow before implementing new rankings or claiming that recommendations are profitable.

## Acceptance gates
- Live verified fixture and odds ingestion restored, no stale timestamps presented as fresh.
- PLAY remains empty when upstream data or independent evidence is unavailable.
- Historical data preserved, storage writes bounded and auditable.
- Reproducible out-of-sample performance report accompanies any High Probability + Value launch.
