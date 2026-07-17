# Agent V11 Model Lab

Agent V11 adds a governed self-learning laboratory to Scorecaster. It does not claim to be unbeatable and it does not promote a new model merely because recent paper ROI is positive.

## Goal

The learning system should improve calibration and decision quality without leaking future results into training, overfitting a small sample or silently changing production probabilities.

## Data used

Only settled paper rows with:

- a valid stored probability between zero and one
- a binary won or lost result
- a chronological timestamp

Push, void, open and malformed rows are excluded. Email, name, account identifiers, payment information and unrestricted user text are not model features.

## Champion–challenger process

1. Sort eligible observations chronologically.
2. Require at least 120 observations.
3. Keep the newest 30 percent, with a minimum of 36 rows, as an untouched holdout.
4. Train candidate probability calibrators only on the older training period.
5. Select the challenger from training performance.
6. Evaluate champion and challenger on the untouched holdout.
7. Require meaningful Brier improvement, non-worse log loss and acceptable calibration behavior.
8. Keep every challenger in shadow mode until separately approved.

The initial champion is the identity calibrator, which leaves the market-consensus probability unchanged. Candidate families include bounded temperature scaling, logit bias and shrinkage toward 50 percent.

## Drift detection

When at least 90 observations exist, Agent V11 compares the most recent 30 rows with the preceding 60 rows. It evaluates:

- Brier score change
- absolute calibration-gap change
- mean predicted-probability shift

A warning keeps the challenger in shadow mode. Critical drift converts new PLAY paper decisions to WATCH and sets their planned paper allocation to zero.

## What learning may change

At this stage learning may:

- produce a challenger calibration report
- rank whether the challenger deserves further review
- warn about drift
- freeze new PLAY paper exposure under critical drift

Learning does not yet alter the production probability. The API and UI expose `probabilityApplied: false` and `probabilityAppliedToProduction: false` for auditability.

## Why shadow mode is mandatory

A model that performs well on its training data may fail on later matches. Chronological holdout testing reduces this risk but does not eliminate it. A challenger must accumulate enough independent shadow performance before a future explicit promotion process is added.

## Promotion gate

A challenger is only marked `promotion-ready` when:

- the total sample is sufficient
- it was selected using training data only
- it improves holdout Brier score by at least 0.005
- holdout log loss does not worsen
- holdout calibration does not materially worsen
- current drift status is stable

`promotion-ready` is not automatic activation.

## Product boundary

Agent V11 remains a sports-analysis and paper-tracking system. It does not guarantee profit, handle payments, connect to bookmaker accounts or place wagers.
