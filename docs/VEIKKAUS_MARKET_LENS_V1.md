# Veikkaus Market Lens V1

## Purpose

Veikkaus Market Lens adds Veikkaus sportsbook prices to Scorecaster's existing bookmaker comparison and no-vig market-consensus pipeline when a matching price is available.

It is a read-only data integration. It does not log in to Veikkaus, open or submit a betslip, store payment credentials, transfer money, place a wager, cash out a wager or automate gambling activity.

## Data source

The current adapter uses the independent Odds-API.io service and filters its feed to the `Veikkaus` bookmaker. Odds-API.io is not Veikkaus and must not be represented as an official Veikkaus API.

The API key is server-only in `VEIKKAUS_ODDS_API_IO_KEY`. Never expose it through `NEXT_PUBLIC_*`, `EXPO_PUBLIC_*`, browser storage, telemetry or provider diagnostics.

Commercial, redistribution and model-training rights must follow the account and data-provider terms. This adapter does not itself grant or infer those rights.

## Matching contract

Scorecaster keeps The Odds API as the canonical live-event feed. A Veikkaus event is merged only when:

- canonical home team matches;
- canonical away team matches;
- event times are within the bounded matching window;
- the requested market contains valid decimal prices; and
- at least two outcomes are present for that market.

Reversed teams, malformed prices, unmatched events and provider errors fail closed for Veikkaus and leave the canonical primary event unchanged.

## Markets

V1 normalizes the following read-only market families into the existing Scorecaster bookmaker contract:

- moneyline / H2H;
- spread / handicap; and
- totals / over-under.

No provider deep link or betslip URL is retained.

## Consensus behavior

When a matched Veikkaus bookmaker row exists, the existing `market-consensus-engine` treats it like another bookmaker observation:

- it can contribute a no-vig probability sample;
- it can increase bookmaker coverage;
- it can become the best available price for a selection; and
- it appears in the Bookmaker Hub catalog as `Veikkaus`.

Scorecaster does not add a probability boost because a price came from Veikkaus. The source does not create a PLAY by itself.

## Failure behavior

`VEIKKAUS_ODDS_API_IO_KEY` missing:

- zero secondary network requests;
- primary odds remain unchanged;
- provider state is `not-configured`.

Provider auth, quota, upstream or network failure:

- the failure is reduced to an allowlisted safe state;
- raw provider error text and credentials are not returned;
- primary odds remain available.

## Product boundary

Veikkaus Market Lens V1 is compatible only with Scorecaster's existing product boundary:

> sports analysis, risk control and paper tracking only

`paperOnly` remains true and `realMoneyBetting` remains false.
