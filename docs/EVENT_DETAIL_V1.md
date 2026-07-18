# Event Detail V1

## Purpose

Event Detail V1 combines the information needed to review one current Scorecaster event:

- live-provider fixture identity and kickoff
- no-vig market consensus
- best available price, fair odds, edge and expected value
- PLAY / CAUTION / SKIP and calculated PLAY price floor
- team-attributed Sports Intelligence
- Form & Rest Shadow V1 audit
- verified watchlist action
- audited paper-tracking action

It does not place a wager, link to a bookmaker, process money or change the production probability.

## Verified event resolution

The public endpoint is:

```text
GET /api/event-detail?eventId=<id>&sport=<supported-key>&selection=<optional>
```

The route accepts only `eventId`, `sport` and optional `selection` query parameters. It validates the sport against Scorecaster's known league keys and reloads the current Top Picks route on the server.

An event that is not present in the current verified Top Picks analysis returns HTTP 404. Client-supplied match, odds, probability, evidence or model data are never used to construct the detail response.

## Response boundary

The response is shaped by `lib/event-detail.mjs` and contains bounded fields only. It forces these declarations:

```text
paperOnly: true
realMoneyActionAvailable: false
probabilityAdjustedByDetail: false
sportsIntelligence.probabilityAdjusted: false
formRestShadow.probabilityAppliedToProduction: false
formRestShadow.usedForDecision: false
```

The PLAY floor is calculated from the unchanged market consensus:

```text
minimumPlayOdds = 1.03 / consensusProbability
```

## Web

The verified directory is available at:

```text
/events
```

A current event opens at:

```text
/event/<eventId>?sport=<sportKey>&selection=<selection>
```

The public analysis is readable without an account. Watchlist and paper-save actions require authentication.

Paper saves use:

```text
POST /api/cloud/bets/audited
```

The audited route re-resolves the event and selection from current server analysis before storing the paper row and Form & Rest feature snapshot.

## Native mobile

The native app opens Event Detail as a transient screen from the Picks tab. It does not add another persistent bottom tab.

- opening detail preserves the user's current Picks state
- Back returns to Picks
- the bottom tab bar is hidden while detail is open
- watchlist and paper actions use existing authenticated APIs
- Scorecaster-originated paper rows are automatically routed through the audited endpoint

## Missing data

Missing independent evidence stays visible as missing. Event Detail does not infer injuries, lineups, form, rest or news from names or price movement.

If an event leaves the current Top Picks window, detail resolution returns 404 rather than displaying an old client copy as current analysis.

## Required checks

Run:

```bash
npm run test:event-detail
npm test
npm run build
cd mobile && npm run typecheck
```

Public release remains subject to the normal two-user isolation, account export/deletion, mobile-device, store and external security gates.
