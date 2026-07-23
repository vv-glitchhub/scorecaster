# Unified Sports Data V1

Unified Sports Data V1 turns Scorecaster's existing market, team and evidence integrations into one event-level ledger. The ledger records what was available, what AI used, what AI did not use, the source and timestamp, reliability, bounded effect and the reason for that effect.

## Data families

1. Multi-provider odds consensus
   - Primary: The Odds API bookmaker consensus.
   - Secondary: SportsGameOdds `/v2/events` when `SPORTSGAMEODDS_API_KEY` is configured and the event can be matched.
   - Provider disagreement is shown as a risk signal. The secondary provider does not silently replace the primary market.

2. Injuries and availability
   - SportsData for supported NFL, NBA, NHL and MLB competitions.
   - Records must be team-attributed, fresh and source-scored.

3. Lineups and confirmed starters
   - Existing configured lineup provider via `LINEUP_API_URL` and `LINEUP_API_KEY`.
   - Optional richer team context provider via `SPORTS_CONTEXT_API_URL` and `SPORTS_CONTEXT_API_KEY`.
   - Incomplete starter information is reported as missing rather than inferred.

4. Form, rest and congestion
   - Uses the chronology-safe Form & Rest shadow snapshot.
   - Only completed events before the target fixture are included.
   - The sample size and source state are exposed.

5. Travel
   - Comes from the configured sports context provider.
   - Distance, time zones and road-trip length are used only when explicitly provided.

6. Weather
   - Open-Meteo hourly forecast for outdoor events with verified coordinates.
   - Coordinates come from event metadata, the context provider or `VENUE_COORDINATES_JSON`.
   - Indoor events explicitly report weather as not applicable.

7. Market movement
   - Uses verified opening/current prices, timeline data and cross-provider disagreement when available.
   - Large movement is treated as price uncertainty, not automatically as team information.

8. Closing odds and CLV
   - Restricted to post-event learning and calibration.
   - Never used in a pregame decision.

9. News source reliability
   - NewsAPI articles are scored by source class, domain override, freshness, corroboration and primary-source status.
   - Optional domain scores use `NEWS_SOURCE_TRUST_JSON`.
   - Weak or stale sources remain visible in the audit but are not used by AI.

## AI provenance

Every factor contains:

- provider and source name
- observed timestamp and provider mode
- source trust and signal confidence
- bounded contextual impact
- data use mode
- whether AI used the signal
- whether it is eligible only to downgrade risk
- plain-language reason
- evidence rows and missing-data requirements

The web cockpit is available at `/data-layer`. The API is `/api/data-layer`. A native screen is available from the mobile More hub.

## Safety policy

- Probability remains the no-vig market consensus.
- Contextual data does not alter the published market probability.
- Context cannot upgrade CAUTION or SKIP to PLAY.
- Verified adverse evidence may downgrade PLAY to CAUTION.
- Total contextual effect is bounded to ±6 percentage points as an explanatory risk value, not a replacement probability.
- Closing odds cannot leak into pregame decisions.
- All actions remain paper-only.

## Server configuration

Required for the primary market:

```text
ODDS_API_KEY
```

Optional integrations:

```text
SPORTSGAMEODDS_API_KEY
SPORTSGAMEODDS_LEAGUE_MAP_JSON
NEWS_API_KEY
NEWS_SOURCE_TRUST_JSON
SPORTSDATA_API_KEY
SPORTSDATA_BASE_URL
LINEUP_API_URL
LINEUP_API_KEY
SPORTS_CONTEXT_API_URL
SPORTS_CONTEXT_API_KEY
VENUE_COORDINATES_JSON
```

Missing optional integrations must return explicit `not_configured`, `unsupported_league`, `missing_coordinates`, `no_match` or equivalent states. They must never generate demo evidence or invented player information.

## Production validation

Before calling the full layer active in production:

1. Verify a real event that matches both odds providers.
2. Verify injury and lineup data with team attribution and timestamps.
3. Verify confirmed starting-player records.
4. Verify form/rest chronology and sample size.
5. Verify a travel record and an outdoor weather forecast.
6. Verify market movement and closing-price separation.
7. Verify news reliability reasons and domain overrides.
8. Confirm that positive context cannot upgrade a decision.
9. Confirm that verified adverse context can only downgrade PLAY to CAUTION.
10. Confirm that the API and mobile views expose used and unused data without secrets.
