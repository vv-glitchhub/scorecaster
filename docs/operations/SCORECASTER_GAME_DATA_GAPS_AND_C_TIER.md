# Scorecaster — C-tier capture and actual match-data remediation
**Date:** 2026-10-16. **Status:** code prepared in draft PR #356; no production data modified.

## Why we accumulated odds but not proper game statistics

Read-only Supabase inspection showed:

- **21,818** `scorecaster_event_outcomes_v1` rows across the Big Five football leagues have `status='final'`, `finality_verified=true`, and both scores present. The associated `matches` table has only **140** old fixture rows, none with scores. These are DIFFERENT pipelines: a populated verified-outcome ledger **does exist**.
- `team_game_logs` = **0**, `player_game_logs` = **0**, `team_stats` = **0**, `live_team_stats` = **0** rows; `player_model_stats` = 4 and `team_model_stats` = 2. The normalized actual match-statistics/per-player ingestion pipeline was never activated for these tables.
- The public `/api/games` primarily retrieves upcoming Odds API fixtures and prices. `/api/results` fetches recent final scores on demand from TheSportsDB, but does not persist team match logs or shot/xG/player performances. Preview tests of `/api/results` returned **502 provider timeouts** for EPL, NHL and MLS; this is a second outage, distinct from Supabase 402.
- `/api/team-form` previously returned generic unverified **5.0** form/attack/defense ratings with five `N/A` results. These values were placeholder UI output, not game statistics or calibrated probabilities.
- A large volume of `sports_analytics_observations` is per-capture market/quality/weather/availability signals, not the original box score, shots, shots on target, xG, possession or player minutes.
- The existing historical team-state and proprietary model-output snapshots ARE populated for the Big Five, but they should not be confused with actual team/player game logs.

## Implemented in this change (not yet in production)

1. `lib/free-tier-league-policy.mjs` explicitly groups durable capture:
   - **A:** EPL, La Liga, Serie A, Bundesliga, Ligue 1.
   - **B:** NHL, NBA, NFL, SHL, Veikkausliiga, Allsvenskan.
   - **C:** MLS, MLB, WNBA, Eliteserien. **Zero scheduled long-lived market, Unified Data, Sports Analytics or Collector records** by default.
   - Unknown leagues also do not consume scheduled Free history slots. This has no effect on live Top Picks or on-demand odds for C or other supported leagues. It **does not remove any historical database row**.
2. A bounded **read-only** `/api/game-data?sport=soccer_epl&team=...&before=<UTC timestamp>` API reads existing validated final scores from `scorecaster_event_outcomes_v1`, providing two team performances per game (goals for/against, result and match points). SQL enforces finalized score and event/capture timestamp bounds. This is existing genuine evidence, **not new raw-game/provider acquisition or fabricated shots/xG**.
3. `/api/team-form` now computes last-five W/D/L, points-based form and scored/conceded goals from the verified result ledger. If data is unavailable (e.g., Supabase 402), it returns an explicit 503/unverified status and **null** attack/defense ratings, rather than misleading 5.0 placeholders.
4. Dedicated regression tests ensure C is excluded only from long-lived capture and that the verified game-data API cannot promote scheduled/unknown scores, unseen later outcomes or nonexistent advanced stats.

## What still must be built

**Independent in-match statistical coverage (no shortcuts):**

| Football match datum | Currently available | Next source/requirement |
| --- | --- | --- |
| League, teams, kickoff, final goals | Yes: verified result ledger | Keep historical result and timestamp provenance |
| Win/draw/loss, team form and goals for/against | Derivable from verified results | Read-only endpoint above; use cutoff before predicted match |
| Shots, shots on target, possession, corners, cards | No systematic normalized game logs | License-check a supported stats provider or a lawfully redistributable open dataset; map event/team identities |
| Team xG / player xG, lineup and minutes | Not systematically stored as game records | Independent, licensed provider and point-in-time source verification |
| Injuries, formation, player availability | Partly represented as derived intelligence / quality statuses | Only keep verified actual values and observation times; do not invent when missing |
| Game-to-game model training | Historical score labels and state snapshots exist | Build chronological feature pipeline using *only data available before prediction time*; measure calibration vs real outcomes |

**Source constraints:** TheSportsDB result fetches timed out in tested Vercel preview; the current free tier may not offer advanced stats or license them for commercial reuse. Do not invent metrics, assume an API is working, scrape prohibited data or spend money without approval.

**Storage constraints:** Supabase Free is restricted (402) and the active DB is still ~2.79 GiB. New read endpoints will return 503 until the restriction is legitimately removed. Their code is NOT an archival solution. The older history remains untouched until a full local backup and verified restore are completed. Do not make new tables/indexes or duplicate 21,818 existing score rows while the DB is restricted.

## Safe acceptance criteria

- [ ] Newest GitHub CI, data tests and worker/security fingerprint audits pass.
- [ ] Preview `/api/top-picks` and `/api/recommendations` remain 200; C sports are still discoverable on demand.
- [ ] Preview `/api/game-data` and `/api/team-form` fail transparently (503) under verified Supabase 402 rather than fabricating metrics.
- [ ] Supabase service restriction is lifted by the provider and verified with a safe read; existing 21,818 finals can be served without duplicating or leaking data.
- [ ] Commercially permissible upstream source for *actual match-level* shots, xG and player stats is confirmed; import/update pipeline has explicit source, event-ID mapping, timestamp, replay protection, tests and predictable storage cost.
- [ ] Production deployment only after genuine release/readiness checks, and historical archive/restore gate.

There is no model-certification claim, real-money execution, destructive cleanup, or paid plan change in this patch.
