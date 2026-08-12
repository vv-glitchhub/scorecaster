# Uncertainty Engine V1

Version: `scorecaster-uncertainty-engine-v1`

## Purpose

Uncertainty Engine V1 measures evidence risk around a research prediction. It does **not** estimate a statistical confidence interval for the event probability and it never changes the production probability or production decision.

## Inputs

The engine reads only already-audited Scorecaster evidence:

- Intelligence Fusion data-trust score
- verified data coverage
- Data Quality Gate status
- independent Model Factory / Ensemble dependence-group count
- calibration-ready dependence-group count
- model disagreement
- rejected feature/model outputs
- market benchmark availability

## Fail-closed rules

The following are critical blockers for research review:

- data trust is missing
- verified coverage is missing
- Data Quality Gate is unsafe
- fewer than two independent model groups
- fewer than two calibration-ready model groups
- high model disagreement
- market benchmark is missing

A critical blocker yields research `NO_BET`.

## Index

`uncertaintyIndex` is a transparent heuristic evidence-risk index from 0 to 100. Higher means more evidence risk.

`evidenceReadiness = 100 - uncertaintyIndex`.

The index is not a probability, prediction interval, confidence interval, p-value or Bayesian credible interval.

## Safety contract

- missing trust fails closed
- missing coverage fails closed
- model diversity is required
- calibration evidence is required
- no pseudo confidence interval is published
- production probability is unchanged
- production decision is unchanged
- automatic promotion is disabled
- paper-only is unchanged
