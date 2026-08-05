# Scorecaster Professional Betting Intelligence Roadmap

Status date: 2026-08-05  
Program epic: #103  
Product boundary: paper-only analysis, tracking and simulation

## Product promise

Scorecaster must not merely name a likely winner. It must show:

1. the model or market-consensus probability,
2. the offered price at the selected bookmaker,
3. the best available market price,
4. fair odds, edge and expected value,
5. evidence quality and uncertainty,
6. the strongest supporting factor and largest risk,
7. sources, timestamps, formulas and model version,
8. later closing-line and calibration evidence.

No component may log in to a bookmaker, transfer funds or place a real-money bet.

## Delivery phases

### Phase A — Safe production foundation

Required before cloud learning or broad beta activation:

- #73 governed production activation
- #91 production migration inventory and evidence
- #92 server-only secret and protected-worker proof
- #93 two-user RLS and database risk-limit proof
- #94 production evidence and league readiness
- public-schema hardening V1.1 production verification

### Phase B — Provider-aware price intelligence

- #104 Bookmaker Hub
- all-bookmakers best-price mode
- specific-bookmaker price mode
- deterministic ranking by EV, edge, confidence, odds or kickoff
- selected price compared with market-best price
- no-vig consensus remains based on the whole available market
- missing bookmaker offers are omitted instead of invented

### Phase C — Transparent pre-match probability

- #96 transparent 1X2 probability engine
- Elo or ordered-logit baseline
- Poisson scoreline model
- optional Dixon–Coles correction
- calibrated chronology-safe ensemble
- market benchmark displayed separately
- home/draw/away probabilities sum to 100%

### Phase D — Event evidence and context

- #105 Match X-Ray
- #106 lineup, injury, suspension, rest, travel, weather and official context
- opponent-adjusted attack and defence
- scoreline and scenario matrix
- timestamped contribution changes
- missing, stale, conflicting and unconfirmed states

### Phase E — Market behavior and decision quality

- #107 opening/current/closing market timeline and synchronized movement evidence
- #108 CLV, Brier score, log loss and calibration lab
- no future-information or closing-line leakage
- provider, league, market, odds-range and model-version slices

### Phase F — Risk and user development

- #109 bounded Kelly and Monte Carlo Risk Lab
- #111 evidence-based AI Coach
- portfolio correlation and exposure controls
- drawdown, losing-streak and risk-of-ruin distributions
- process feedback based on paper records and CLV, not only wins and losses

### Phase G — Verified live monitoring

- #112 verified event state and paper-only alerts
- provider freshness and conflict handling
- separate live and pre-match model versions
- rate-limited notifications
- no real-money instructions or execution

### Phase H — Source governance and professional UX

- #113 source licensing, attribution and redistribution registry
- #114 five-tab professional UX, Pro Mode and accessibility
- #95 canonical quick-use flow
- #97 TestFlight and Google Play closed beta

## Shared decision contract

Every ranked selection must expose at least:

```text
Event
Market and selection
Selected bookmaker and selected odds
Best market bookmaker and best market odds
Consensus probability
Selected-price implied probability
Fair odds
Edge
Expected value
Confidence and uncertainty
Freshness
Decision: PLAY / WATCH / CAUTION / SKIP
Decision reason
Paper stake and risk limits
Source and formula links
```

Selecting a bookmaker may change only the offered-price-dependent values:

```text
market_probability = 1 / selected_odds
edge = consensus_probability - market_probability
EV = consensus_probability * selected_odds - 1
Kelly = ((selected_odds - 1) * p - (1 - p)) / (selected_odds - 1)
```

It must not silently change the whole-market consensus probability.

## Program-level release gates

- 100% of actionable selections have immutable decision audits
- 100% of public metrics have registered sources and timestamps
- zero client exposure of API keys or restricted raw provider payloads
- zero bookmaker-account, deposit, withdrawal or real-money execution code
- missing or stale evidence cannot produce a stronger decision
- chronological model evaluation passes leakage checks
- critical web, PWA and mobile flows pass accessibility and small-screen tests
- every league is explicitly enabled, degraded or disabled using production evidence

## Current implementation

Bookmaker Hub V1 is implemented on `feat/bookmaker-hub-v1` and includes:

- provider catalog from complete requested markets,
- all-bookmakers best-price mode,
- specific-bookmaker price evaluation,
- whole-market no-vig consensus,
- provider-aware EV, edge, decision and paper stake,
- best-market comparison,
- deterministic professional ranking,
- local preference persistence,
- paper-record provider evidence,
- regression tests.
