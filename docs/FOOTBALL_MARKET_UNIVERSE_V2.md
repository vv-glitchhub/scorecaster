# Scorecaster Football Market Universe V2

Football Market Universe V2 turns the operator's bookmaker UI reference into an explicit Scorecaster product taxonomy while preserving provider-rights and mathematical safety boundaries.

## Product goal

A football event should no longer appear to consist only of 1X2, handicap and match totals. Scorecaster now records the wider market families users expect to see, including goals, team totals, first-half markets, corners, cards, goalscorers, combinations and first-goal timing.

The taxonomy is not a copied bookmaker feed. It is a list of market concepts Scorecaster wants to understand.

## Coverage states

Every reference target has a transparent coverage state:

- `provider-capable`: the configured event-odds provider has a documented market key for the concept;
- `partial`: the provider exposes a related market but settlement does not exactly match every bookmaker presentation;
- `provider-gap`: no approved configured provider currently exposes the exact concept;
- event responses additionally use `available` and `not-offered` after the provider returns the selected event's markets.

A provider gap never creates a synthetic price, probability or PLAY decision.

## Provider-backed additions

The safe football event catalog now includes:

- alternate match handicaps;
- first-half 3-way result (`h2h_3_way_h1`);
- first-half totals (`totals_h1`);
- existing first-half alternate totals/team totals, BTTS, double chance and correct score;
- existing corners, cards and player markets.

New settlement shapes that Market Universe V1 does not yet model mathematically remain `PRICE_ONLY` automatically. This includes newly requested provider keys whose settlement mode is not explicitly registered in the V1 engine.

## Soccer player-prop routing

The configured upstream provider currently documents soccer player props primarily through US bookmakers. The event-level `players` group therefore uses the `us` region while other football groups continue to use `eu,uk`.

This changes only data coverage. It does not weaken source-rights checks or create any bookmaker account automation.

## Reference gaps retained intentionally

The operator reference includes concepts that the configured provider does not currently document, including:

- first team to score;
- winner + total combinations;
- 1X2 + BTTS;
- BTTS + total combinations;
- most cards as a dedicated 3-way market;
- winning margin;
- special/ready-made combinations;
- first-goal time bands;
- first-half first-goal market.

These remain visible as product gaps so future provider work is driven by an explicit target instead of being forgotten.

## Safety boundary

- real-money execution: absent;
- bookmaker login/account automation: absent;
- unsupported markets: no invented prices;
- incomplete/complex settlement: `PRICE_ONLY` unless a valid probability model exists;
- source entitlement rules remain authoritative;
- paper tracking remains the only execution mode.
