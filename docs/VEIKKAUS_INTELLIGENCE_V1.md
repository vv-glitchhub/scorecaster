# Veikkaus Intelligence V1

## Purpose

Veikkaus Intelligence adds a paper-only analysis layer for manually observed Veikkaus markets and pool games. It does not connect to a Veikkaus account, submit tickets, use Cash Out, move money or scrape live pages.

The implementation deliberately separates two different pricing models:

- Pitkäveto: fixed decimal odds
- Tulosveto, Vakio, Moniveto, Voittajaveto and Toto: pool/system products that must not be treated as ordinary bookmaker prices

## Observed product structure

The user-supplied screenshots showed the current Veikkaus product surfaces for Toto, Voittajavedot, Vakio, Moniveto, Live/Pitkäveto and a football event detail page. Those screenshots are used only to understand product and market naming. They are not a production data source.

The market mapper currently recognizes these visible Finnish labels:

- Voittaja (1X2) -> `h2h_1x2`
- Maalit Yli/Alle -> `totals`
- Tasoitus -> `handicap`
- Tasapeli ei vetoa -> `draw_no_bet`
- Tuplamerkki -> `double_chance`
- Puoliaika/lopputulos -> `half_full_time`
- Lopputulos -> `correct_score`
- Molemmat joukkueet tekevät maalin -> `both_teams_to_score`
- Kulmapotkut -> `corners`
- Maalintekijä -> `goalscorer`
- Voittajamarginaali -> `winning_margin`

Unknown labels remain unsupported instead of being guessed.

## Fixed-odds analysis

Input:

- decimal odds
- independent model probability
- optional independent market benchmark probability

Output:

- implied probability
- fair odds
- probability edge
- expected value
- expected return per unit
- optional model-versus-benchmark difference

The calculation never relabels an implied bookmaker probability as an independent model.

## Pool-popularity analysis

For Vakio/Toto-style manual snapshots, the generic analyzer compares:

- model probability
- played share

It returns:

- percentage-point difference
- model-to-played-share ratio
- `underplayed`, `balanced` or `overplayed`

It intentionally does **not** calculate expected value unless the applicable pool return rate is supplied by a governed rule/data source.

## Tulosveto

Tulosveto uses the documented round return rate of 77 percent from the supplied rules. With an observed totalisator price:

`estimated_played_share = 0.77 / observed_odds`

and:

`EV = model_probability * observed_odds - 1`

The 77 percent value is specific to this rule path and is not reused for Vakio, Moniveto or Toto without explicit evidence.

## API

`GET /api/veikkaus-intelligence`

Returns the methodology, supported modes and safety boundary.

`POST /api/veikkaus-intelligence`

Supported modes:

- `fixed_odds`
- `pool_popularity`
- `tulosveto`
- `vakio_marks`
- `market_map`

The POST endpoint uses the repository's same-origin mutation protection and bounded JSON parser.

## UI

`/veikkaus-intelligence`

The first UI is a manual snapshot analyzer. It can evaluate:

- a visible Pitkäveto price against a model probability
- a model probability against a visible pool played share
- a Tulosveto price using the 77 percent round return rule
- a Veikkaus market label against the canonical Scorecaster market map

No screenshot OCR or automatic live-site extraction is performed.

## Future adapter gate

A future Veikkaus data adapter may be added only after the data source, access rights and rate/usage conditions are explicitly verified. The adapter must remain read-only. Missing fields must remain missing and must not be replaced with examples, inferred pool percentages or synthetic odds.

## Permanent safety boundary

- paper-only
- no Veikkaus credentials
- no account connection
- no bet placement
- no Cash Out
- no deposits or withdrawals
- no automatic staking
- no live-page scraping in V1
