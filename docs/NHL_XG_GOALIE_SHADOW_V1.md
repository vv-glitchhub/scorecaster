# NHL xG + Goalie Shadow V1

## Purpose

`nhl-xg-goalie-shadow-v1` is Scorecaster's first dedicated advanced-data independent NHL shadow model.

It is intentionally research-only. It can produce an independent probability for the Model Factory / Ensemble path, but it cannot change the production market-consensus probability, upgrade a production decision, place a wager, or promote itself.

## Data boundary

The model consumes only stored pregame advanced observations that pass all of these rules:

- event matches the target NHL fixture
- `observedAt` and `capturedAt` are no later than the prediction horizon
- source trust is at least 0.55
- confidence is at least 0.45
- provider is not Scorecaster's own unified-data mirror
- provider is not The Odds API, odds-market, Polymarket, Open-Meteo or TheSportsDB
- required team observations map explicitly to home/away
- goalie observations map explicitly to home/away and identify a confirmed starter

This prevents market data, weather/context data and mirrored historical-result data from masquerading as a new independent predictive family.

## Required model inputs

For both home and away teams:

- `xg-for-per-60`
- `xg-against-per-60`

For both confirmed starting goalies:

- `goals-saved-above-expected-per-60`

Optional for both teams:

- `post-shot-xg-for-per-60`

Accepted aliases exist for provider compatibility, but the external provider request contract asks for the canonical names above.

## Formula

The transparent research formula is:

1. Team attack rate:
   - with post-shot xG: `0.8 * xGF60 + 0.2 * postShotXGF60`
   - otherwise: `xGF60`
2. Base projected goals:
   - `sqrt(teamAttackRate * opponentXGA60)`
3. Starting-goalie adjustment:
   - `projectedGoals = baseGoals - clamp(opponentStarterGSAx60, -0.75, 0.75)`
4. Each side receives an independent Poisson goal distribution.
5. H2H research probability is regulation win probability plus 50% of regulation tie probability.

The model clamps projected goals to a broad `[0.8, 6.0]` safety range.

## Why the model is not production-calibrated

The formula is deterministic and transparent, but it is not yet league-calibrated from a chronological holdout. Therefore:

- `performanceWeightAvailable = false`
- `automaticPromotionAllowed = false`
- Ensemble may show the output as research evidence, but validated performance weighting is unavailable
- production probability and production decision remain unchanged

The next model-quality milestone after live advanced data exists is a chronological holdout with Brier score, log loss, calibration gap, drift, CLV and sample-size gates.

## Provider contract V2

`lib/sports-analytics-provider.js` now emits `scorecaster-sports-analytics-v2` requests.

For NHL events it includes a dedicated model contract for `nhl-xg-goalie-poisson-v1` describing:

- required and optional metrics
- per-60 units
- team-side mapping
- confirmed starting-goalie metadata
- chronology requirement
- market-pricing independence requirement

The event UI never calls the provider directly. The existing sports-analytics worker stores provider observations, and the decision path reads only the latest stored pregame-safe values.

## Storage / runtime path

`external analytics provider -> sports analytics worker -> sports_analytics_observations -> sports-analytics-shadow-input-loader -> nhl-xg-goalie-shadow-v1 -> Model Factory -> lineage-derived expected-performance family -> Ensemble V1`

The loader caches event-level reads for one minute to avoid repeated database work while keeping stored pregame evidence fresh enough for the research path.

## Licensing boundary

Scorecaster does not hard-wire a third-party public statistics website into this model.

Advanced providers must be licensed or otherwise authorized for the intended Scorecaster use. Public data availability alone is not treated as permission for automated commercial ingestion. This is why the model is connected to the generic audited `SPORTS_ANALYTICS_API_URL` provider contract rather than scraping a named public website.

## Failure modes

The model fails closed when any required input is unavailable. Examples:

- missing home xGF60
- missing away xGA60
- missing confirmed home starting goalie GSAx60
- missing confirmed away starting goalie GSAx60
- only blocked/mirrored providers are present
- observations are after the decision horizon
- selection cannot be mapped to the home or away team

Missing optional post-shot xG does not get converted to zero. The model explicitly records that the optional signal is absent and falls back to xGF60-only attack rate.

## UI audit

The event data-audit page shows:

- model status
- shadow probability
- projected goals
- advanced input status
- provider lineage
- metric lineage
- exact missing-input reasons when unavailable
- production safety flags

No extra provider fetch is added by the UI.

## Safety invariants

- `productionProbabilityChanged = false`
- `productionDecisionChanged = false`
- `automaticPromotionAllowed = false`
- `market inputs used = false`
- `post-event advanced observations used = false`
- `starting goalies required = true`
- `paperOnly = true`
