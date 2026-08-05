# Scorecaster Professional Explanation and Model Lab V1

This layer makes a Scorecaster assessment inspectable at two levels without generating unsupported reasons.

## Simple Mode

Simple Mode contains only fields derived from the structured calculation audit:

- displayed decision
- probability label and value
- selected decimal price
- strongest positive factor
- strongest risk
- missing evidence

A narrative sentence is presentation only. It is never treated as evidence or fed back into the calculation.

## Pro Mode

Pro Mode separates:

```text
independent model probability
market benchmark probability
selected bookmaker price
decision probability
```

When no independent model probability exists, the output is explicitly labeled `market-benchmark-only`. Market data is never relabeled as an independent predictive model.

Pro Mode also publishes:

- active model identity and role
- model training status and training cutoff
- feature-availability cutoff
- formula identifiers and implementation paths
- quality-component inputs, weights and contributions
- ranking-component inputs, transformations and contributions
- reconciliation differences
- gates and missing inputs
- source attribution
- evidence-sensitivity band

The evidence-sensitivity band is a deterministic sensitivity display. It is not a calibrated statistical confidence interval.

## Contribution reconciliation

Evidence quality is recomputed as:

```text
quality =
  0.30 * trust
+ 0.25 * confidence
+ 0.20 * freshness
+ 0.15 * record coverage
+ 0.10 * source diversity
```

Ranking score is recomputed as:

```text
score =
  70 * quality
+ 30 * min(abs(edge), 0.15) / 0.15
```

The API reports the displayed value, recomputed value, numerical difference and a reconciliation boolean. A contribution is not shown unless its actual input field exists in the calculation schema.

## Formula and model registry

`lib/model-formula-registry-v1.mjs` publishes:

- formula text
- formula category
- implementation path
- input cutoff rule
- whether the component is trained
- methodological notes

Model entries publish their role, probability type, implementation paths, training status, training cutoff, feature cutoff and automatic-promotion boundary.

## Event snapshot

For each event, the professional explanation builds a canonical public snapshot containing:

- event identity
- calculation timestamp
- decision-time normalized inputs
- sorted publishable normalized records
- explicit flags showing that private keys, personal data and restricted raw payloads are absent

The canonical object is hashed using SHA-256. Repeating the calculation with the same records, decision inputs and calculation timestamp produces the same snapshot hash.

Public endpoint examples:

```text
/api/transparency?eventId=EVENT_ID&mode=pro
/api/transparency?eventId=EVENT_ID&mode=pro&reproduce=1&snapshotHash=SHA256
```

The reproduction response states whether the new hash matches the expected hash.

## Shared product surfaces

The same `ProfessionalExplanationCard` component is used in:

- `/model-lab`
- every `/event/[eventId]` page

This prevents separate Simple and Pro explanation implementations from drifting apart.

## Missing-data boundary

- null remains null
- missing evidence is listed
- missing model probability does not become zero
- missing selected price does not become zero
- market probability does not become model probability by relabeling
- unsupported factors are not generated

## Security and privacy

Public transparency output excludes:

- API keys and service credentials
- user identity
- private paper-bet records
- restricted raw provider payloads
- bookmaker account information

The layer is paper-only and cannot place a bet, transfer money or promote a model automatically.
