# Transparent 1X2 — Manual Model Candidate Registry V1

## Purpose

This registry preserves a reviewed challenger decision **without** turning review evidence into automatic production activation.

The canonical file is:

```text
config/transparent-1x2-model-candidates.json
```

It intentionally starts empty. Repository work must never invent a candidate, paired historical result, reviewer or approval.

## Permanent top-level boundary

The registry requires:

```text
automaticPromotionAllowed = false
runtimeLoadingAllowed = false
```

The live Transparent 1X2 engines do not import this registry. Even an `approved-candidate` record is only evidence for a future explicit code/profile change.

## Candidate prerequisites

A candidate can be created only from V4 paired evidence that is already:

- valid
- real reviewed historical evidence
- ready for manual review
- at least 100 paired rows
- paper-only
- no automatic promotion
- no production probability change
- no invented statistical-significance claim

The candidate stores only V4 IDs/fingerprints, metric direction/deltas and a non-secret evidence reference. It does not embed the historical event rows.

## Candidate profile

V1 accepts the currently reviewed Dixon-Coles challenger family only:

```text
engine = dixon-coles-1x2
rho in [-0.25, 0.25]
sampleSize >= 100
market = h2h
valid trainingCutoff
```

The normalized profile receives a SHA-256 `profileFingerprint`.

The training cutoff must not be later than candidate-record creation time. Prediction-time chronology remains enforced independently by the V2/V3 evaluation pipeline and by the live challenger profile contract.

## Review states

### `pending-review`

No reviewer, review timestamp or approval evidence may be present. This prevents a pending record from implying approval.

### `rejected`

Requires:

- `reviewedAt`
- bounded reviewer identifier
- non-secret review evidence reference

A rejected record remains useful immutable model-history evidence.

### `approved-candidate`

Requires the same explicit human review fields.

This state means only:

```text
eligibleForFutureManualProfileChange = true
```

It still means:

```text
automaticPromotionAllowed = false
runtimeLoadingAllowed = false
productionActivationAllowed = false
productionProbabilityChanged = false
```

A separate reviewed code/profile change is required before any future production model change.

## Evidence references

Both the paired comparison and a completed human review require a traceable non-secret evidence reference.

References containing credentials, token-like query parameters or private-key labels are rejected. URLs with embedded credentials or query strings are rejected.

## Immutability

Each candidate contains:

- V4 comparison/cohort/config/package/prediction fingerprints
- profile fingerprint
- review state and evidence metadata
- fixed safety boundary
- final `recordFingerprint`

The registry audit recomputes the record/profile fingerprints. Editing a reviewed parameter, evidence identity or review state without regenerating the record is detected as fingerprint drift.

Duplicate candidate IDs and duplicate profile IDs fail the registry audit.

## Canonical audit

Run:

```bash
npm run model:candidate-registry-audit
```

or the full tests:

```bash
npm run test:model-candidate-registry
```

The current expected repository state is a valid registry with zero candidates and zero approved candidates.

## Future workflow after real #96 evidence exists

1. Produce real reviewed V3 baseline/challenger evaluation packages.
2. Produce a valid V4 paired comparison over the identical cohort.
3. Retain the V4 artifact in the reviewed model-evidence store.
4. Fit/review the candidate profile using only chronology-safe training data.
5. Build a `pending-review` candidate record.
6. Review overall and slice/fold evidence manually.
7. Mark it `rejected` or `approved-candidate` with explicit review evidence.
8. Run the registry audit and full model CI.
9. If approved, create a separate explicit production-profile code change.
10. Re-run the full Scorecaster safety/release gates before that separate change can ship.

## Safety

- paper-only
- offline/manual model governance only
- no automatic model promotion
- no runtime loading of the candidate registry
- no invented model evidence or approval
- no bookmaker login
- no deposits, withdrawals, Cash Out or real-money execution
