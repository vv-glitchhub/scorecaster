# Scorecaster Intelligence Core V1

## Goal

Scorecaster Intelligence Core turns provider observations into Scorecaster-owned, reproducible sports intelligence. Providers are replaceable observation channels; Scorecaster owns the normalized history, point-in-time features, team state, model code, predictions, evaluation and decision audit.

This does **not** mean inventing sports facts. A real match result, injury, lineup or shot must still be observed from a lawful source. If an observation is unavailable, Scorecaster marks it missing and fails closed.

## Data ownership architecture

1. **Observation sources**
   - OpenFootball CC0 mirror for football fixtures/results and historical bootstrap.
   - Existing rights-aware collectors for market/live observations.
   - Optional licensed sources can be added without changing model logic.
2. **Canonical Fact Ledger**
   - `scorecaster_canonical_facts_v1`
   - normalizes source-specific payloads into source-independent facts.
   - stores observed time, captured time, rights, trust, confidence and lineage.
3. **Canonical Outcome Store**
   - `scorecaster_event_outcomes_v1`
   - stores scheduled/final outcomes independently of provider event IDs.
4. **Event Identity Map**
   - `scorecaster_event_identity_map_v1`
   - maps provider event IDs to a canonical event identity.
5. **Point-in-Time Feature Store**
   - `scorecaster_pit_feature_snapshots_v1`
   - only information available before the feature cutoff may enter a snapshot.
6. **Team State Store**
   - `scorecaster_team_state_snapshots_v1`
   - own Elo, goal strengths, home/away strengths, form and match history.
7. **Own Shadow Model**
   - `scorecaster-own-football-baseline` v1.0.0
   - independent Elo + goal-strength Poisson ensemble.
   - market odds are not model features.
8. **Prediction Ledger**
   - `scorecaster_model_predictions_v1`
   - immutable-ish hashed shadow predictions with model/version/input lineage.
9. **Learning Example Store**
   - `scorecaster_learning_examples_v1`
   - joins a pregame feature snapshot to a later verified outcome.
   - chronology and training rights must pass before an example is eligible.
10. **Model Registry**
   - `scorecaster_model_registry_v1`
   - research → shadow → challenger → review-candidate → champion.
   - automatic promotion is prohibited.

## OpenFootball mirror

OpenFootball football.json is mirrored server-side into Scorecaster's Supabase database. The source is registered as `openfootball_cc0` with CC0-1.0 rights for production, model training and redistribution.

The mirror runs independently of the Scorecaster web application using Supabase Edge Functions + pg_cron + pg_net. The normal mirror schedule is every six hours. Historical bootstrap can be triggered securely server-side without exposing a cron secret.

Stored history remains in Scorecaster even if the upstream source later changes or disappears. Provenance and the original license remain attached to the rows.

## Own football baseline

The baseline deliberately avoids bookmaker prices as input.

Team state includes:
- Elo rating
- EWMA goals for / against
- home goals-for / goals-against strength
- away goals-for / goals-against strength
- EWMA form points
- match count and latest match time

Prediction uses:
- team goal-strength matchup → Poisson 1X2 probabilities
- Elo strength → 1X2 prior with draw mass
- fixed V1 shadow blend of Poisson and Elo

The model requires at least five historical matches for both teams. Otherwise it returns `insufficient-history` instead of guessing.

## Independent fact consensus

Market observations never count toward an independent evidence quorum. Independent sources are combined with trust/confidence weighting. Large cross-source disagreement produces `conflict` and blocks verification.

A future version should require multiple independent live observation channels for high-impact facts such as lineup, injury and shot-event evidence. A single source is never made 'verified' merely because it is available.

## Learning and model promotion

Every eligible training example must satisfy:
- feature snapshot created before outcome
- feature snapshot created before kickoff
- leakage guard passed
- verified final outcome
- independent source lineage
- model-training rights verified

The current own model is **shadow-only** and uncalibrated. It cannot alter production probability, edge, EV or PLAY/CAUTION/SKIP.

Promotion requires a separate immutable holdout evaluation against the market champion with Brier score, log loss, calibration and paired uncertainty evidence. Promotion always requires human approval.

## Resilience contract

Scorecaster aims to avoid dependence on a single provider, not to pretend factual observation can be eliminated.

- normalized stored history survives upstream outages
- provider-specific IDs are mapped to canonical identities
- derived features/models are source-independent
- rights are evaluated per source
- missing facts fail closed
- independent evidence requires independent sources
- no raw provider feed is redistributed unless rights explicitly allow it
- no real-money action is available

## Paper-only invariants

- `automaticModelPromotionAllowed = false`
- `productionProbabilityChangedByCore = false`
- `productionDecisionUpgradeAllowedByCore = false`
- `realMoneyActionAvailable = false`
- `paperOnly = true`
