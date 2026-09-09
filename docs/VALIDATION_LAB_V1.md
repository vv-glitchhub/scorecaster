# Validation Lab V1

The Today page links to `/model-lab#validation-lab`. It labels confidence as data confidence and explains the separate probability estimate. The lab evaluates independent shadow research models; it does not certify the owned football baseline, ML challenger, or the entire product.

## What changed

- Missing metrics render as an em dash; real zero values remain numeric.
- The result matcher requires explicitly finished results, exact normalized home/away names, a known UTC kickoff within 90 minutes, and the same league request. Missing timestamps, ambiguous results, conflicting duplicates and future fixtures remain unmatched. Provider aliases need a verified canonical map; substring matching is not permitted.
- Snapshots, prediction horizons and market benchmarks must be strictly before kickoff. A model horizon cannot postdate the stored snapshot. Invalid scores or distributions cannot increase sample size.
- Event/model identity includes model ID and version. Reports separate model, sport and league cohorts.
- The loader examines the newest 1,000 snapshots within the selected window, replacing the oldest-first sample that could remain stuck on early captures. Row/league caps and provider failures are disclosed. This is a bounded sample, not full-window coverage.
- The lab shows paired sample size, benchmark coverage, Brier/log-loss improvements and calendar-month comparisons. A profitable-looking pooled result cannot hide a losing sufficiently sampled month.
- Historical comparison never sets `skillClaimAllowed=true`. `positiveComparison` and human research review are distinct from validated production skill. Production probabilities, selection gates and stake logic are unchanged.

## Versioned research policy

`lib/validation-lab-v1.mjs` defines the research review rules: at least 100 paired events, complete benchmark coverage within the evaluated cohort, positive paired Brier/log-loss improvements, and at least three completed calendar months with 25+ paired events each. Every sufficiently sampled completed month must improve on both metrics.

These are research screening rules, not empirically established profitability thresholds. The new policy is not retrospectively preregistered. A prospective frozen protocol, verified training chronology, uncertainty analysis and independent review are still needed before claiming predictive superiority or approving a model for production. Calendar-month summaries do not retrain the model and are not presented as a walk-forward training backtest.

## Verification

```sh
node --test scripts/validation-lab-v1.test.mjs scripts/advanced-model-holdout-v1.test.mjs scripts/model-research-scorecard-v1.test.mjs scripts/decision-review-surfaces-v1.test.mjs
node --test scripts/professional-model-lab-v1.test.mjs scripts/scorecaster-ready-app.test.mjs scripts/open-transparency.test.mjs scripts/active-market-universe.test.mjs
npm run security:check
npm run build
```

The Professional Model Lab workflow runs the new behavioral regressions, including missing values, result ambiguity, future finals, kickoff boundaries, invalid distributions, cohort separation, missing benchmark coverage and monthly consistency. The user requests evaluation explicitly; opening the page does not query result providers.
