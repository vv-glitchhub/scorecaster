# Scorecaster Intelligence Fusion V2

Intelligence Fusion V2 is the audited bridge between Scorecaster's Unified Sports Data ledger and its grounded AI explanation layer.

## Goal

Make every relevant verified data family available to the AI without allowing missing, stale, low-trust, contradictory or future information to improve a prediction.

The layer does not replace the market model. The canonical probability remains Scorecaster's no-vig market consensus. Fusion is an evidence, uncertainty and downgrade layer.

## Inputs

Fusion consumes the factor ledger already produced by Unified Sports Data, including the data families available for a given sport and event:

- primary and independent secondary odds
- injuries and availability
- confirmed lineups / starters
- recent form
- rest and schedule congestion
- sports context and travel-related evidence
- venue and weather evidence
- news with source reliability
- any additional audited factor registered in the unified ledger

The architecture is additive: a new audited factor can enter Fusion through the ledger without teaching the language model to scrape or invent the fact itself.

## AI eligibility gate

A factor is eligible for AI evidence only when all of these are true:

1. the upstream factor explicitly sets `usedByAi: true`
2. the status is not a known missing/unavailable/error state
3. confidence is at least 0.45
4. trust is at least 0.55
5. contextual source timestamps pass the pre-event chronology guard

The market odds factor continues to use Scorecaster's existing market freshness gate. This avoids treating the legacy `commenceTime` display fallback as a real observation timestamp.

Rejected factors remain visible under `ignoredFactors` with exact reasons. They are not silently deleted or imputed.

## Output

Each enriched pick receives:

```text
intelligenceFusionV2
```

It contains:

- eligible factors
- ignored factors and rejection reasons
- adverse verified factors
- source-aware trust summary
- data-family coverage
- unresolved conflicts
- AI explanation evidence
- counterarguments
- missing evidence
- a data-quality decision ceiling
- the permanent probability/safety contract

`/api/data-layer` exposes the same audit for diagnostics and Event Detail exposes a sanitized event-level summary.

## Decision contract

Fusion is intentionally asymmetric.

It may:

- explain verified evidence
- surface missing and conflicting evidence
- reduce confidence in the decision process
- impose a `CAUTION` ceiling when verified adverse evidence or weak coverage requires it
- fail closed when the audited odds consensus is absent

It may not:

- increase the market probability
- increase edge or EV
- turn `SKIP` or `CAUTION` into `PLAY`
- invent missing data
- use post-start closing information for a pre-match decision
- use future-dated contextual evidence
- place a real-money bet

The output therefore always declares:

```text
probabilityAdjusted: false
marketProbabilityRemainsCanonical: true
contextCanUpgrade: false
paperOnly: true
```

## Grounded language-model use

Agent V10 receives Fusion's eligible evidence, counterarguments and missing evidence before the older fallback evidence list.

The existing Agent V10 validator still applies:

- the model selects only from supplied evidence indexes
- unsupported external facts are rejected
- new numerical claims are rejected
- certainty / guaranteed-win language is rejected
- a deterministic fallback remains available

This gives the language model access to more real data without giving it authority to manufacture sports facts or change deterministic probabilities.

## Regression coverage

`scripts/intelligence-fusion-v2.test.mjs` verifies:

- only eligible audited factors are used
- low-trust positive context cannot help the AI
- verified adverse context imposes a CAUTION ceiling
- future contextual evidence is rejected
- missing odds consensus fails closed
- grounded Agent explanations prioritize fused audited evidence
- the canonical probability remains unchanged

The suite is included in `npm run test:intelligence`, and therefore in the full Scorecaster test chain.
