# Polymarket Intelligence V1

## Purpose

Scorecaster can read public Polymarket sports-market information as a secondary risk signal. The integration does not connect a wallet, authenticate to a trading account, submit orders, transfer funds or settle Scorecaster paper bets.

The current Scorecaster probability remains the no-vig bookmaker-market consensus. Polymarket never replaces that probability.

## Data source

The implementation uses the public Polymarket Gamma API origin:

```text
https://gamma-api.polymarket.com
```

Match discovery uses the public search endpoint with active-event filtering. No Polymarket API key, wallet address, private key or signing credential is required.

The provider can return event and market metadata including:

- event and market titles
- outcome prices
- market start time
- liquidity and volume
- bid, ask and spread metadata when available
- market and resolution descriptions

## Match safety

Polymarket and bookmaker providers may use different team names, schedules or market rules. Scorecaster therefore does not accept a simple text hit as sufficient evidence.

A candidate market is normalized and checked using:

1. both team names
2. event and market title coverage
3. scheduled-time proximity when both timestamps exist
4. supported outcome mapping
5. market-match confidence
6. liquidity or volume

Ambiguous Yes/No markets and events with a large schedule mismatch are rejected.

## Decision boundary

Polymarket is **downgrade-only**.

A Scorecaster PLAY may become CAUTION only when all of these conditions hold:

- the market is live and actively matched
- match confidence is at least 0.75
- liquidity is at least 1,000 USD or volume is at least 10,000 USD
- the selected-side Polymarket probability is at least eight percentage points below Scorecaster's consensus probability

Polymarket cannot:

- change model or consensus probability
- create edge or expected value
- upgrade CAUTION or SKIP to PLAY
- increase paper stake
- bypass Agent V11, sports-intelligence or database risk controls
- settle a paper result

This boundary is exposed in each pick through fields including:

```text
polymarketUsedForUpgrade: false
probabilityAdjustedByPolymarket: false
scoreSettledByPolymarket: false
```

## Current application flow

The live flow is:

```text
Odds provider fixtures
  -> no-vig market consensus
  -> sports evidence gate
  -> form/rest shadow context
  -> Polymarket downgrade-only gate
  -> Top Picks
  -> Agent V11 portfolio
  -> Autonomous Paper Agent
```

Because the current Agent and Autonomous Agent both consume Top Picks, the same Polymarket safety result is applied consistently.

## Read-only API

Authenticated users can inspect a match through:

```text
GET /api/cloud/polymarket-intelligence
```

Allowed query parameters:

- `home`
- `away`
- `sport`
- `league`
- `commenceTime`

The endpoint is protected by Scorecaster authentication and the database-backed API quota. It has no POST action and cannot place orders.

## User interface

The page is available at:

```text
/polymarket-intelligence
```

It displays:

- match-confidence score
- home and away probabilities when safely mapped
- liquidity and volume
- start-time difference
- price-mapping method
- external market link
- explicit trading and result-source boundaries

The interface is available in Finnish, English and Spanish.

## Scores and settlement

Polymarket also publishes sports-score streams, but provider documentation states that those feeds can contain delays, errors or missing events. Scorecaster does not use a Polymarket score stream as an official result source.

Paper settlement remains isolated in the existing score-provider and settlement-monitor code. Polymarket is not imported by:

- `lib/paper-settlement-engine.mjs`
- `lib/settlement-monitor.js`
- `app/api/cloud/bets/settle/route.js`

## Failure behavior

The integration fails safely:

- no exact market: existing decision remains unchanged
- weak match or low liquidity: existing decision remains unchanged
- provider error or timeout: existing decision remains unchanged
- ambiguous outcome mapping: candidate is rejected
- disagreement supporting the Scorecaster side: no upgrade occurs

A missing Polymarket market is a normal outcome and is never replaced with invented data.

## Testing

The dedicated regression suite verifies:

- public Gamma search is used
- wallet and trading code is absent
- strong downside disagreement downgrades PLAY
- optimistic Polymarket data never upgrades a pick
- missing or weak data leaves decisions unchanged
- Top Picks uses the new safety gate
- the API is authenticated and rate limited
- the UI is trilingual
- settlement code does not import or reference Polymarket
