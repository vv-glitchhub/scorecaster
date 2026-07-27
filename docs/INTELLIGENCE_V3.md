# Scorecaster Intelligence V3

Intelligence V3 combines five data-derived modules on top of publishable Collector observations:

1. AI Scout
2. Deterministic Scenario Simulator
3. Team and Player DNA
4. Paper Betting Lab
5. Transparent AI Coach

## Data boundary

The public API reads only `collector_records` rows where `publishable = true`. Research-only observations are excluded. Missing metrics remain missing and are shown as limitations. The engine never changes Scorecaster's production probability or upgrades a decision to PLAY.

## AI Scout

Scout combines market probability, optional model probability, source trust, confidence, metric coverage and freshness. It returns a 0–100 intelligence score, risk level, factors and missing evidence.

## Scenario Simulator

The simulator runs 1,000–100,000 deterministic Monte Carlo-style paper scenarios. Its seed is derived from the event and settings, so the same input produces the same output. Volatility increases when data quality is weak.

## Team and Player DNA

Team DNA summarizes coverage, trust, confidence, attack, defense, tempo and fatigue when those observations exist. Player DNA is produced only from entity-attributed records. No player values are invented when tracking or player observations are unavailable.

## Paper Betting Lab

The lab compares available probability with decimal odds and produces flat, quarter-Kelly, half-Kelly and capped full-Kelly paper strategies. The maximum calculated paper stake fraction is 5%. It has no wallet, bookmaker integration or real-money execution.

## AI Coach

Coach explains the current WATCH, CAUTION or SKIP result using the strongest available factors. It reports records used, metrics used, missing evidence and whether invented data or a production probability change occurred.

## Endpoints

```text
GET /api/intelligence-v3?eventId=<id>&iterations=20000
GET /intelligence-v3
```

## Activation

No new database migration is required. Intelligence V3 needs the existing Collector V1 tables and publishable observations. When Collector has no observations for an event, the API returns an explicit limitation instead of generated sports facts.

## Validation

```text
npm run test:intelligence-v3
npm run build
```
