# Scorecaster: league-by-league capture and data-value audit

Date: 2026-10-16. **Read-only production SQL and code review; no deletion, retention rule, migration or paid change executed.**

## Executive finding

Scorecaster currently spends disproportionately more durable history capacity on MLS and repeated quality/market metrics than on the five European football leagues where its independently generated decision records are concentrated. A free-tier solution should separate (1) broad live discovery from (2) targeted high-value historical collection. Do not optimize by blindly dropping entire leagues or old records needed for reproducible betting/model evaluation.

The Postgres database measured **2,926,513,299 bytes (2,791 MiB)** vs. the **500 MiB** Free project included size. Supabase REST has returned service-restriction 402; latest model/market capture is 2026-09-30. This audit does NOT remove the restriction.

## Observed market history

`market_provider_snapshots_v2`: **2,416,279 rows**; approx. **1,418,944,512 bytes including indexes**. Counts below are rows *not games*; multiple bookmakers, outcomes, markets and snapshots multiply each event.

| League | Sport key | Market price rows | Distinct events |
|---|---|---:|---:|
| MLS | soccer_usa_mls | 433,856 | 123 |
| English Premier League | soccer_epl | 256,331 | 50 |
| MLB | baseball_mlb | 236,536 | 442 |
| NFL | americanfootball_nfl | 226,809 | 93 |
| La Liga | soccer_spain_la_liga | 209,644 | 63 |
| Serie A | soccer_italy_serie_a | 170,328 | 40 |
| NBA | basketball_nba | 147,756 | 39 |
| Bundesliga | soccer_germany_bundesliga | 139,154 | 36 |
| Ligue 1 | soccer_france_ligue_one | 133,712 | 36 |
| NHL | icehockey_nhl | 124,944 | 29 |
| Allsvenskan | soccer_sweden_allsvenskan | 79,369 | 25 |
| Eliteserien | soccer_norway_eliteserien | 77,891 | 24 |
| Veikkausliiga | soccer_finland_veikkausliiga | 77,562 | 36 |
| WNBA | basketball_wnba | 69,716 | 68 |
| SHL | icehockey_sweden_hockey_league | 32,671 | 34 |

MLS accounts for about 18% of the entire durable bookmaker-price rows. This historical pattern may reflect earlier seasonal priorities rather than current demand.

Market types: `h2h` 1,595,256 (~66%), `totals` 510,708 (~21%), `spreads` 310,315 (~13%). The source stores individual bookmaker outcomes, price, implied probability, normalized probability, margin, provider verification/update time, capture time, source reference, event IDs, and kickoff time.

There are **329 captures**, **362,032 unique combinations** of `(event_id,market,selection,bookmaker_key,price)` versus 2.42M historical rows. The same price combination may occur repeatedly, but **a later return to the same price can still be informative**; never mistake the 85% difference for safe duplicate deletion. Opening prices, material changes, reversals and verified pre-match closing prices require an ordered historical series.

## Sports analytics history

`sports_analytics_observations`: approximately **1,006,004 records** (~579 MB including indexes). Measured family counts:

| Family | Rows |
|---|---:|
| quality | 418,197 |
| market | 237,429 |
| environment | 156,879 |
| availability | 101,502 |
| team | 58,163 |
| workload | 33,834 |

MLS is the leading source at **391,336 analytic rows** (~39%); its quality/market/environment measurements often recur, e.g. `odds-consensus-value`, `weather-impact`, `data-confidence`, `trust-score`, `edge`, `lineup-record-count`. Such summaries can sometimes be represented more compactly at capture-bucket/event level; this is a **design hypothesis**, not proof they can be discarded.

Other observed major leagues' analytics rows: Allsvenskan 114,642, La Liga 105,418, WNBA 67,650, NFL 66,554, EPL 58,435, MLB 44,594, Veikkausliiga 42,115, Eliteserien 39,290, Bundesliga 30,948, Serie A 29,925, Ligue 1 15,097.

Providers supplying observations include Scorecaster Unified Data, Open-Meteo, The Odds API, TheSportsDB, and some externally sourced content with varying publication/usage rights. Never blindly store or redistribute raw licensed third-party material.

## Independent predictive coverage

`scorecaster_own_decisions_v1` contains historical records only for **EPL, La Liga, Serie A, Bundesliga and Ligue 1** (about 92,367 records based on full SQL grouping; the system's `pg_stat` row estimates are stale and differ). Only **14,542 records** have `market_mapped=true` across those leagues, which is not synonymous with a validated independent prediction or profitability. All last observed decision timestamps are stale. Preserve this model evidence, outcome provenance and calibration history even if moved to a cold archive.

This is an important mismatch: extensive MLS/NFL/MLB historical market collection is **not evidence** of a trained, qualified independent model for those leagues.

## Suggested policy (NOT YET APPLIED TO PRODUCTION)

| Tier | Leagues | Live discovery | Durable capture |
|---|---|---|---|
| A — predictive core | EPL, La Liga, Serie A, Bundesliga, Ligue 1 | All supported markets and games | First priority: independently verified stats, outcomes, pregame line and model evidence |
| B — broad sports and Finnish/Nordic coverage | NHL, NBA, NFL, SHL, Veikkausliiga, Allsvenskan | Keep live on demand | Bounded representative odds history; expand only with reliable features and outcomes |
| C — seasonal / exploratory | MLS, MLB, WNBA, Eliteserien and other supported seasonal competitions | Preserve on-demand discovery | Sparse or opt-in history until data proves model benefit |
| Provider-gapped | Finnish Liiga (currently blocked at primary provider since 2026-09-10) | Explicit unavailability and alternate-provider exploration | Do not insert synthetic prices or freshness |
| Supported but not automatically in default season universe | Champions League, Europa League, Conference League, Danish Superliga and other supported offerings | Keep product access; verify live provider capability | Opt-in or bounded verified capture when season and coverage justify |

**Market families:** football H2H/1X2 is first to calibrate. Totals and spreads remain accessible live and in historical archive, but should only consume a scarce hot-data slot if analysis and settled event-level labels are supported. For NHL/NBA/NFL, H2H/totals/spreads can each matter; require sport-specific measured value before removing any.

**Bookmaker selection:** do not simply store the first four returned providers as a permanent quality criterion. Prefer independently verified, timely and diverse benchmarks (e.g. suitable exchange/sharp reference if available) plus a locally relevant executable bookmaker and best available price, only if license and market access permit. Historical comparison needs opening, meaningful movement, and a provider-verified final *pre-kickoff* price; three-hour snapshots alone are inadequate to guarantee a closing line.

**Must retain (hot or recoverable cold):** event ID, teams, league, UTC kickoff, verified result, sport-specific independent metrics and source confidence, point-in-time input features, injuries/lineup status when actually verified, time provenance, bookmaker/source, market/selection/line, price, model version/calibration and forecasts, and settled bets/CLV. Missing values stay unknown, not today's inferred timestamp. Privacy and provider licensing must be respected.

**Likely candidates for compacting future writes:** repeated unchanged price observations, per-metric quality/confidence spam, repeated weather values from an unchanged forecast, multiple region-specific brands showing identical prices, and snapshot JSON fields that duplicate canonical facts. This requires a measured consumer/retention dependency review, not blanket row deletion.

## Next verification gates

1. Measure **sequential** unchanged provider prices, not only distinct price sets; preserve reversals, verified timestamps, opening/closing lines.
2. Map feature families to actual independent model input, calibration and settled outcome coverage by league. Evaluate model benefit and cost/row, not just rows/game.
3. Determine a per-sport/market **bookmaker-quality roster** and licensed retention. Do not permanently favor arbitrary provider order.
4. Obtain a securely stored real archive (all relevant public tables and managed user records separately) and demonstrate a complete local restoration.
5. Build/measure physically compact hot/cold data with explicit user approval. No automatic deletion or paid upgrade.
6. Reopen legitimate Supabase REST access and prove fresh captures and qualified model evidence before merging PR #356.

Reference SQL queries can be rerun on the active Supabase project with the same columns used above. Historic observations stop on 2026-09-30, and none of these rows validates current market availability by itself.
