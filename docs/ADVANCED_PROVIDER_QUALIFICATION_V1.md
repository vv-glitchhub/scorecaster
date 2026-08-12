# Advanced Provider Qualification V1

Version: `scorecaster-advanced-provider-qualification-v1`

Required provider contract: `scorecaster-sports-analytics-v5`.

## Purpose

Provider Qualification separates four things that must never be conflated:

1. provider configured
2. independent advanced data actually stored
3. an audited deterministic advanced probability model admitted by Model Factory
4. chronology-safe immutable holdout capture readiness

Configuration alone never means model-ready.

## Shadow qualification requirements

A provider/event qualifies for shadow holdout only when all of the following are true:

- external advanced provider is configured
- provider contract is V5 compatible
- at least one independent advanced provider observation is present
- latest advanced observation is operationally recent and before the prediction horizon
- at least one advanced Model Factory output exists
- admitted advanced outputs are chronology-safe
- every admitted advanced output has an input snapshot hash

The operational freshness bound is 72 hours. This is an operational ingestion guard, not a sport-specific predictive-quality claim.

## Stages

- `provider-not-configured`
- `provider-contract-incompatible`
- `configured-no-independent-data`
- `data-present-model-not-admitted`
- `advanced-data-or-model-blocked`
- `qualified-for-shadow-holdout`

## Safety contract

- raw advanced data never becomes a probability automatically
- market pricing cannot qualify as advanced independent data
- chronology is mandatory
- input snapshot hash is mandatory for holdout
- production eligibility is always false in V1
- automatic promotion is disabled
- production probability and decision are unchanged
- paper-only is unchanged
