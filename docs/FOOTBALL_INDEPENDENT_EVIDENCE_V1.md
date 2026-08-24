# Football Independent Evidence V1

## Goal

Football Independent Evidence V1 closes the gap between a strong market opportunity and a Scorecaster PLAY decision without weakening the existing safety gates.

The layer is evidence-only. It does **not** replace the production probability, edge, EV, recommendation ranking or final safety check.

## Evidence families

### 1. Predictive — required

The predictive family uses the existing `soccer-xg-poisson-v1` shadow model.

Required properties:

- independent xG-for and xG-against observations for both teams
- observations captured before the target fixture
- deterministic input snapshot hash
- no market/odds inputs in the xG model
- provider lineage not in the blocked market/provider list
- observation age at most 72 hours at the prediction horizon
- provider contract `scorecaster-sports-analytics-v5`
- commercial-use and model-use rights explicitly confirmed
- selected-side xG probability is not more than 2 percentage points below market consensus

A 5+ percentage-point negative xG disagreement is treated as a critical evidence conflict.

Shot-quality support can additionally include:

- shots-for-per-90
- shots-against-per-90
- shots-on-target-for-per-90
- shots-on-target-against-per-90

These metrics improve audit context but do not change the production probability.

### 2. Availability

Availability requires a live injury/suspension check with no unresolved evidence conflict.

Starting lineups are treated dynamically:

- more than six hours before kickoff: confirmed lineups are useful but not mandatory
- inside the final six-hour window: both starting lineups must be confirmed

The existing SportsData soccer lineup adapter requires exactly 11 starters for both teams and keeps the probability unchanged.

### 3. Form / rest

The existing chronology-safe form/rest model is reused. For football the family requires:

- provider mode `live`
- at least three completed matches for both teams
- only matches before the target fixture
- known rest hours for both teams
- chronology guard enabled

It provides form, score-margin, rest and congestion evidence. Football profiles remain feature-only; they do not alter the probability.

## Readiness

`market-only`
: no qualifying independent evidence family is available.

`partial`
: some independent evidence exists, but the full PLAY evidence contract is not satisfied.

`verified`
: all of the following are true:

1. qualified independent predictive xG family
2. xG does not materially contradict the selected side
3. live injury/suspension status
4. at least one supporting family (availability or form/rest)
5. starting lineup rule is satisfied when inside six hours
6. no critical evidence conflict

Only `verified` sets `allowsIndependentPlayEvidence=true`.

Even then, the existing market/data gates and final independent-intelligence safety check remain mandatory.

## Sportmonks adapter

`lib/sportmonks-football-evidence-provider.js` is the first production-ready licensed-provider adapter for this evidence contract.

It is **fail closed**. No request is made unless all of these are configured:

- `SPORTMONKS_API_TOKEN`
- `SPORTMONKS_FOOTBALL_EVIDENCE_ENABLED=true`
- `SPORTMONKS_COMMERCIAL_USE_ALLOWED=true`
- `SPORTMONKS_MODEL_USE_ALLOWED=true`

Optional display policy can be recorded with `SPORTMONKS_DERIVED_DISPLAY_ALLOWED=true`.

The adapter:

- resolves team identity server-side
- requests team fixture history only
- uses completed fixtures before the target kickoff
- aggregates the latest 4–8 qualifying matches
- creates normalized xGF/xGA and shot observations per 90
- hashes the source-fixture lineage
- never uses target-fixture outcome data
- never uses market prices as model input
- never exposes the API token
- never redistributes the raw provider feed

The source is also registered in `collector-source-registry.mjs`. Raw redistribution remains false.

## Immutable capture and holdout

No new database table is required.

The existing 30-minute sports analytics worker stores normalized pregame observations in:

- `sports_analytics_snapshots`
- `sports_analytics_observations`

The existing soccer xG shadow model stores an input snapshot hash and is already captured into the advanced shadow prediction ledger. The existing advanced holdout service settles those pregame predictions against later results without feeding post-game data back into the original prediction.

This means the independent evidence layer inherits the existing chronology and holdout architecture rather than creating a second evaluation system.

## Operational health

`GET /api/football-evidence/health`

The health endpoint reports:

- provider entitlement/configuration without secrets
- recent independent xG storage
- activation blockers
- evidence policy
- paper-only safety state

Expected status before a licensed provider is configured:

`provider-not-entitled-or-configured`

That is a healthy fail-closed state, not a reason to fabricate xG data.

## Event audit UI

Football event pages render `FootballIndependentEvidencePanel`.

The panel shows:

- predictive xG qualification
- xG vs market consensus difference
- shot-quality coverage
- provider-rights gate
- injury/suspension status
- lineup requirement and confirmation
- form/rest chronology and samples
- exact missing evidence blockers

The UI cannot calculate a browser-side PLAY upgrade.

## Safety invariants

Football Independent Evidence V1 must always preserve:

- `probabilityAdjusted=false`
- `productionProbabilityChanged=false`
- `productionEdgeChanged=false`
- `productionEvChanged=false`
- `decisionUpgradeAllowedByThisLayer=false`
- `realMoneyActionAvailable=false`
- `paperOnly=true`

The layer may satisfy the **existing** evidence gate. It does not create a new betting execution path or bypass the final safety gate.
