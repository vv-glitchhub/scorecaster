# PLAY Pipeline Repair V1 — production evidence

Date: 2026-09-07

Scope: additive event-identity normalization and live fixture mapping used by Scorecaster's paper-only owned-model decision pipeline.

## event-identity-normalization-v2

- Production migration registry contains `20260907141302 scorecaster_event_identity_normalization_v2`.
- The normalizer broadens provider/canonical club-name matching without changing probabilities or enabling real-money actions.
- Live verification after application showed provider identities such as `Levante` mapping to canonical identities such as `Levante UD` inside the permitted kickoff window.

## event-identity-fixture-map-v3

- Production migration registry contains `20260907141651 scorecaster_event_identity_fixture_map_v3`.
- The refresh function consumes both `fixture_snapshot` and `event_snapshot` collector identities and remains paper-only.
- Production catalog/data verification on 2026-09-07 showed 19/19 current identity-map rows marked verified.
- The owned decision pipeline currently has 20 market-mapped decisions in the latest 24-hour window, confirming that canonical predictions can now join live market events rather than remaining permanently unmapped.

## Safety boundary

- No PLAY edge or EV threshold was lowered.
- No automatic model promotion was enabled.
- Missing evidence remains missing and can only block/downgrade.
- Real-money execution remains unavailable; the pipeline is paper-only.
