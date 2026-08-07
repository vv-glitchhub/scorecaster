# Veikkaus Data Adapter Discovery V1

## Status

**Discovery only. Production collection disabled.**

This phase prepares Scorecaster for a future read-only Veikkaus data adapter without assuming that a visible browser request, undocumented endpoint or user screenshot grants reuse rights.

The Source Registry entry is deliberately fail-closed:

- source id: `veikkaus_public_data`
- access mode: `disabled`
- enabled: `false`
- commercial use allowed: `false`
- redistribution allowed: `false`
- model training allowed: `false`
- licence: `unverified`
- terms URL: missing
- base/data URL: missing
- retention: zero days

Until these fields are replaced by verified evidence, both collection and publishing remain blocked.

## What the supplied evidence establishes

The user-supplied Veikkaus screenshots are useful product-structure evidence. They show current visible surfaces for:

- Pitkäveto / Live-veto
- Tulosveto
- Vakio
- Moniveto
- Voittajavedot
- Toto
- football event markets such as 1X2, totals, handicap, draw-no-bet, correct score and other market groups

The supplied rules establish game semantics and selected mathematical rules such as Tulosveto's documented 77 percent round return.

They **do not** establish:

- an official reusable data API
- an API licence
- commercial display rights
- redistribution rights
- a permitted automated collection frequency
- permission to reuse browser-internal or undocumented endpoints
- permission to use account/session endpoints

Scorecaster therefore keeps screenshots as design/reference evidence only, never as a live data source.

## Discovery contract

`lib/veikkaus-data-adapter-v1.mjs` provides a no-network discovery contract.

It can inspect manually supplied observations and normalize only a bounded subset:

### Fixed odds

Required concepts:

- event id
- game name such as Pitkäveto
- observation type `fixed_odds`
- supported visible market label
- decimal odds
- source observation timestamp
- optional event start timestamp

The existing Veikkaus market mapper converts known labels into canonical Scorecaster markets. Unknown labels fail closed.

### Pool share

For products such as Vakio, a manual discovery record may contain:

- observation type `pool_share`
- played share in `(0, 1)`
- selection identifier such as `1`, `X` or `2`

Pool shares stay structurally separate from bookmaker prices.

### Pool turnover

A manual discovery record may contain:

- observation type `pool_turnover`
- non-negative turnover value
- unit `eur`

No payout percentage or expected value is inferred merely from turnover.

## Chronology rules

Discovery observations are rejected when:

- the observation timestamp is invalid
- the observation is in the future relative to Scorecaster capture time
- a pre-match observation is timestamped at or after the supplied event start
- the event identifier is missing
- the game family is unsupported
- the observation type is unsupported
- values are malformed

Accepted discovery observations retain both:

- `observedAt` — source observation time
- `collectedAt` — Scorecaster inspection/capture time

They are still marked:

- `publishable: false`
- `productionCollectable: false`
- `paperOnly: true`

## Redacted health

`GET /api/veikkaus-intelligence/source-health`

The endpoint exposes only gate state:

- rights verified or not
- endpoint verified or not
- terms verified or not
- production collection allowed or blocked
- publishing allowed or blocked
- whether live fetching/account access/bet placement/Cash Out/money movement exist

It does not return credentials, cookies, raw payloads, request URLs or customer context.

## Conditions required before any real adapter work

Before production collection can be implemented, the operator must record and review all of the following:

1. **Authoritative source identity**
   - official data owner/operator
   - documented data/API URL family
   - transport format
   - authentication requirements, if any

2. **Rights evidence**
   - applicable terms URL
   - licence or written permission
   - whether commercial application display is allowed
   - whether normalized data may be retained
   - whether redistribution is allowed
   - attribution requirements

3. **Operational limits**
   - documented request/rate limits
   - permitted update cadence
   - freshness expectations
   - retention limits

4. **Data contract**
   - event identity fields
   - sport and league identity
   - market label and selection identity
   - price or pool-share value
   - pool turnover where officially supplied
   - source timestamps

5. **Safety review**
   - endpoint must not require or expose a player account session
   - no ticket submission endpoint
   - no Cash Out endpoint
   - no payment/deposit/withdrawal functionality
   - no attempt to bypass access controls or anti-automation measures

## Promotion procedure

Promotion is intentionally code-reviewed rather than environment-variable-only.

The Source Registry entry must be updated with verified source metadata and rights. Only after that review may a future adapter call `sourceCanCollect()` and `sourceCanPublish()` successfully.

A later production implementation must also add:

- server-side read-only fetcher
- bounded timeout and payload size
- HTTPS-only URL validation
- deterministic normalization
- freshness and chronology enforcement
- provider/outage health
- no raw payload persistence
- privacy/security tests
- release-readiness gate
- worker disabled by default until production evidence passes

## Non-goals for V1

This phase does not:

- discover or guess private endpoints in code
- scrape Veikkaus pages
- OCR screenshots
- use browser automation
- use Veikkaus credentials, cookies or account sessions
- place a bet
- submit a ticket
- invoke Cash Out
- move money
- invent odds, played shares, turnovers or payout percentages

## Validation

Run:

```bash
node --test scripts/veikkaus-data-adapter-v1.test.mjs
```

The regression suite verifies the fail-closed Source Registry entry, chronology checks, market normalization, fixed-odds/pool separation, redacted health and the permanent absence of account and execution features.
