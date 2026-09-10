# Scorecaster Acceptance & Validation V1

## Purpose

`/acceptance-validation` is the single release-evidence surface for Scorecaster. It separates three questions that must not be conflated:

1. Is the production code and data pipeline healthy?
2. Has enough chronology-safe real evidence accumulated to review model quality?
3. Which final acceptance gates require evidence outside repository code?

The page reuses existing production sources instead of creating a second source of truth:

- `/api/health`
- `/api/intelligence-core/health`
- `/api/calibration/health`
- `/api/production-control-center?hours=24&limit=5000`
- authenticated `/api/operations` when a user session is available
- manual `/api/model-holdout?days=180` only when the user requests model-versus-market evaluation

## Evidence semantics

An empty sample is never rendered as zero performance. `0` learning examples or calibration observations means the evidence is still collecting.

The V1 review-sample gate follows the Validation Lab minimum paired sample. Both chronology-safe learning examples and settled paper calibration observations must reach the policy minimum before the combined evidence state becomes `review-sample-ready`.

This combined state is deliberately conservative. It does not claim profitability, statistical significance beyond the underlying Validation Lab report, or permission to promote a challenger automatically.

## Model versus market

The dashboard contains the same 180-day holdout evidence used by Validation Lab, but it remains manual. Opening the page does not trigger result-provider work.

When requested, the dashboard surfaces:

- settled evaluations
- market-paired evaluations
- model count
- best available Brier skill score
- model Brier versus market Brier
- model log loss and paired log-loss improvement
- current research/collecting status

Historical outperformance is explicitly not treated as a guarantee of future return.

## External acceptance gates

The following remain explicit until real external evidence exists:

- Supabase leaked-password protection
- real password-reset email link
- physical push-device registration
- push delivery and receipt verification before enabling background delivery
- governed lineup provider or explicit optional-unavailable state
- Liiga provider capability re-verification

The dashboard does not invent a successful state for any of these.

## Safety boundary

Acceptance & Validation V1 does not alter PLAY thresholds, probabilities, bankroll rules, user isolation, provider rights, model promotion, or settlement logic.

Scorecaster remains paper-only:

- no real-money execution
- no bookmaker login
- no deposits or withdrawals
- no automatic model promotion
- no learning-driven production probability change

## CI

`.github/workflows/acceptance-validation-v1.yml` runs:

- Acceptance & Validation V1 regressions
- Validation Lab regressions
- advanced holdout regressions
- repository security check
- production build
