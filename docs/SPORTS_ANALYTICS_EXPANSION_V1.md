# Sports Analytics Expansion V1

Sports Analytics Expansion V1 adds a governed catalogue and calculation foundation for collecting substantially richer sport-specific data without weakening Scorecaster's existing model-integrity rules.

## Product boundary

This expansion does not make research metrics authoritative by default.

1. Published probability remains the no-vig market consensus.
2. New sport-specific analytics are context or shadow-model inputs until chronology-safe validation proves calibration value.
3. Context may downgrade a decision but cannot upgrade CAUTION or SKIP to PLAY.
4. Missing data remains explicit. Scorecaster must never invent tracking, injury, lineup, weather or event evidence.
5. Closing prices and outcomes remain evaluation-only and cannot leak into pre-event features.
6. Scorecaster remains analysis, simulation and paper tracking only.

## New foundation

### Catalogue

`lib/sports-analytics-catalog.mjs` defines:

- supported sport families
- sport-specific markets
- event, tracking, player, team, expected and counterfactual metrics
- coverage calculations that expose both available and missing metrics
- a common vocabulary for provider normalization

Initial sports:

- football / soccer
- ice hockey
- basketball
- American football
- baseball
- tennis
- golf
- handball
- volleyball
- floorball
- rugby
- cricket
- MMA and boxing
- motorsport
- esports

### Expected Performance Engine

`lib/expected-performance-engine.mjs` provides deterministic primitives for:

- expected action value
- expected decision value compared with the best alternative
- expected points
- proximity gained
- target-zone rate
- golf distance buckets and proximity profiles
- bounded data-confidence scoring
- normalized provider observations

These functions are intentionally model-agnostic. Sport-specific models can use them without duplicating safety, validation and naming logic.

### Public catalogue API

```text
GET /api/sports-analytics/catalog
GET /api/sports-analytics/catalog?sport=golf
GET /api/sports-analytics/catalog?sport=ice_hockey&family=expected
GET /api/sports-analytics/catalog?sport=golf&available=strokes-gained,expected-proximity,proximity-gained
```

The endpoint exposes capabilities and coverage, not secrets, account data or real-money actions.

## Shared data families

Every sport should eventually support the following common families where applicable:

| Family | Examples | Freshness | Default use |
|---|---|---:|---|
| Identity | fixture, competition, season, venue, participants | daily | eligibility |
| Market | bookmaker, odds, limits, movement, no-vig consensus | live | authoritative price |
| Result | final score, settlement, player result | post-event | evaluation only |
| Event | play-by-play actions and state changes | live | context |
| Tracking | player, ball, puck or vehicle coordinates | live | context / shadow |
| Player | role, form, skill, usage and matchup | daily | context |
| Team | strength, style, tactics and lineup combinations | daily | context |
| Availability | lineups, injuries, suspensions and withdrawals | minutes | downgrade only |
| Workload | rest, travel, schedule density and load | daily | downgrade only |
| Environment | venue, weather, surface and altitude | hourly | context |
| Officiating | referee or umpire tendencies and rules | daily | context |
| Expected | xG, EPV, EPA, expected strokes and equivalents | event | shadow model |
| Counterfactual | value of choices not selected | event | research only |
| Quality | provenance, freshness, agreement and completeness | capture | safety gate |

## Highest-value metrics by sport

### Football / Soccer

Collect:

- shot location, angle, body part, shot type and goalkeeper position
- pass and carry start/end locations
- pressure, defender distance and visible passing options
- player and ball locations for spacing and team shape
- set-piece type and phase
- lineup, substitutions, injuries and tactical formation
- weather, pitch and referee context

Build:

- xG and post-shot xG
- xA and expected possession value
- xThreat and progression value
- xPress, xRun and xSpace
- prevented threat
- xDV for shot/pass/carry selection
- xOV for off-ball creation

### Ice Hockey

Collect:

- shot and attempt location, angle, speed and type
- pass sequence, cross-slot pass, rebound and screen context
- zone entry and exit method
- puck and skater tracking, speed, acceleration and zone time
- manpower state, line combinations and time on ice
- goalie movement, location, workload and save type
- travel, back-to-back games and rest

Build:

- xG and post-shot xG
- goals saved above expected
- expected zone-entry value
- expected pass and rebound value
- chance-creation value before a shot exists
- shot-versus-pass xDV
- off-puck and prevented-chance value

### Basketball

Collect:

- shot location, defender distance, shot clock and dribble count
- passes, potential assists, drives and paint touches
- screens, spacing, rotations and lineup combinations
- player speed, distance, touches and matchup assignment
- foul state, timeouts, rest and travel

Build:

- expected points per shot
- expected possession value
- shot quality and shot-selection xDV
- screen value, gravity and off-ball spacing value
- expected assist, rebound and turnover value
- lineup-adjusted player impact

### American Football

Collect:

- down, distance, score, field position and time
- formations, personnel, routes, targets, blocks and pressures
- player tracking, separation, speed and coverage shell
- weather, surface and officiating
- injury and snap-share changes

Build:

- expected points, EPA and win probability
- completion probability and CPOE
- expected rushing yards and yards after catch
- tackle value and blocking value
- play-call, fourth-down and route-choice xDV

### Baseball

Collect:

- every pitch's type, location, velocity, spin and movement
- bat speed, swing path, exit velocity and launch angle
- fielder and runner positioning
- lineup, handedness, bullpen availability and park conditions

Build:

- xBA, xSLG and xwOBA
- expected runs and run expectancy
- catch probability and defensive value
- expected total bases
- pitch-selection and pitch-sequence xDV
- defensive-positioning and baserunning decision value

### Tennis

Collect:

- point score and pressure state
- first/second serve, speed and placement
- return position and quality
- shot type, direction, depth and rally length
- player movement, court coverage and fatigue
- surface, weather and medical interruptions

Build:

- expected point, game, set and match win probability
- serve and return quality
- fatigue-adjusted point value
- serve-direction, return-position and shot-selection xDV

### Golf

Collect every shot with:

- distance to the hole before and after the shot
- start lie and end lie
- club
- start and end coordinates
- carry, total distance, apex, spin, launch and landing angle when available
- wind, elevation, temperature and firmness
- target, pin location and hazard geometry
- penalty, recovery and out-of-position state

Build distance profiles for at least:

```text
0-30 m
30-50 m
50-75 m
75-100 m
100-125 m
125-150 m
150-175 m
175-200 m
200+ m
```

For every distance bucket calculate:

- average remaining distance
- median remaining distance
- green-hit rate
- under 1 m, 3 m, 5 m and 10 m rates
- expected proximity
- proximity gained
- strokes gained
- expected birdie created
- horizontal and longitudinal dispersion
- short/long/left/right miss tendency
- bad-shot avoidance
- club efficiency

Counterfactual models should compare:

- club selection
- safe target versus flag attack
- lay-up versus attack
- expected score distribution, not only average score

### Handball and Floorball

Collect shots, passes, transitions, goalkeeper position, defender distance, special situations and tracking where available.

Build xG, post-shot xG, expected possession value, goalkeeper goals prevented and shot/pass xDV.

### Volleyball

Update rally win probability after every serve, reception, set, attack, block and dig.

Build expected touch value, expected rally win, setter-decision value, serve-target value and rotation strength.

### Rugby

Collect carries, passes, kicks, rucks, set pieces, tackles and territory.

Build expected points, phase value, try probability, tackle-prevention value and kick-versus-carry xDV.

### Cricket

Collect every delivery, shot, wicket, field setting, partnership and match phase.

Build expected runs, wicket probability, win probability, shot-selection value, delivery-selection value and field-placement value.

### MMA and Boxing

Collect strikes by target and type, knockdowns, takedowns, control, submissions, movement, distance and round state.

Build expected damage, finish probability, round-win probability and strike/takedown decision value. Model uncertainty must remain high when tracking or judge-quality evidence is incomplete.

### Motorsport

Collect laps, sectors, telemetry, tyres, pit stops, weather, flags, traffic and reliability.

Build expected lap time, race-position distribution, overtake probability, retirement probability and pit/tyre strategy value.

### Esports

Collect rounds, maps, economy, objectives, drafts, player positions, roles and patches.

Build expected round and map win, economy-adjusted strength, objective value, buy-decision value and draft-choice value. Patch version is mandatory provenance.

## Golf proximity example

Input observations:

```js
[
  {
    startDistanceMeters: 82,
    endDistanceMeters: 4,
    expectedEndDistanceMeters: 7,
    greenHit: true
  },
  {
    startDistanceMeters: 94,
    endDistanceMeters: 8,
    expectedEndDistanceMeters: 7,
    greenHit: true
  }
]
```

The engine produces a `75-100 m` profile including sample count, average remaining distance, green-hit rate, proximity gained and target-zone rates.

## Data-provider strategy

Use a provider adapter per data family, not one giant provider-specific model.

Each adapter must return normalized observations with:

```text
sport
eventId
participantId
metric
value
unit
observedAt
provider
sourceTrust
confidence
metadata
```

Provider activation must verify:

- commercial and redistribution rights
- supported leagues and seasons
- historical depth
- live delay
- identifier stability
- rate limits and quotas
- correction policy
- attribution requirements
- personal or biometric data restrictions

Examples of valuable source families include official league tracking systems, licensed event-data providers, official results feeds, weather services, injury/lineup providers and Scorecaster's existing odds providers. Public web pages must not be scraped as a substitute for a licensed API unless their terms explicitly permit it.

## Data-quality gates

A metric is not production-ready until Scorecaster can report:

- sample size
- provider count
- source trust
- observation freshness
- completeness
- cross-provider agreement
- entity-match confidence
- chronology status
- missing fields
- correction or revision state

The initial confidence helper combines sample size, provider count, agreement, completeness and freshness. It is a transparent operational score, not a statistical confidence interval.

## Implementation roadmap

### Phase 1 — Foundation

- analytics catalogue
- normalized observation contract
- expected-performance primitives
- golf proximity profile
- public capability and coverage API
- regression tests

### Phase 2 — Storage and ingestion

- shared non-personal analytics observation tables
- provider adapter registry
- entity mapping and duplicate detection
- event-time chronology enforcement
- raw-to-feature lineage
- correction and revision history

### Phase 3 — First production sports

Prioritize sports already central to Scorecaster:

1. ice hockey
2. football / soccer
3. basketball
4. tennis
5. golf

Start with data that is legally available, fresh and attributable. Missing tracking data must not block event, lineup, workload and environmental improvements.

### Phase 4 — Shadow models

- sport-specific feature builders
- time-ordered train/holdout splits
- calibration by league, market and season
- champion/challenger evaluation
- drift detection
- no automatic production promotion

### Phase 5 — Decision intelligence

- xDV alternative-action models
- xOV off-ball/off-puck value
- matchup-specific simulations
- player and lineup uncertainty
- market sensitivity and price thresholds

## Validation requirements

Before any new metric influences a production decision:

1. prove all features existed before event start
2. document data rights and provider attribution
3. measure missingness and correction rates
4. compare against a simple baseline
5. use untouched chronological holdout data
6. report Brier score, log loss and calibration where probabilities are produced
7. segment by league, market, season and data-availability state
8. test that missing data fails closed
9. verify the metric cannot alter the immutable market probability outside the reviewed promotion process
10. keep all real-world use paper-only
