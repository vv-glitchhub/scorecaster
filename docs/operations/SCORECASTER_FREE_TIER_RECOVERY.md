# Scorecaster on Supabase Free — storage recovery and archive plan

Status: implementation prepared; **not yet recovered or deployed to production** (2026-10-16).

## 1. Actual constraint and non-negotiable safety

The Supabase project uses a Free organization. The included database size is **500 MB**, while read-only SQL reports **2,791 MB**. Supabase REST has returned HTTP 402 and capture stopped on 2026-09-30. Platform Fair Use restrictions can remain until Supabase clears the specific restriction. Do not treat the Postgres management connection being healthy as proof that the REST API works.

The goal is **under 400 MB in hot Postgres**, leaving headroom below the Free limit. Reaching that goal requires freeing about 2.4 GB *of physical database size*; removing just the two biggest tables would still leave about 790 MB. The limits may change, and data size includes indexes and TOAST. This goal cannot be claimed met before physical measurements on the actual active project.

Snapshot from the read-only 2026-10-16 audit:

| Data | Physical bytes | Role |
| --- | ---: | --- |
| `market_provider_snapshots_v2` | 1,418,944,512 | Historical per-provider betting market prices |
| `sports_analytics_observations` | 579,469,312 | Historical model/context observations |
| `scorecaster_own_decisions_v1` | 172,015,616 | Own decision evidence and provenance |
| `scorecaster_canonical_facts_v1` | 143,958,016 | Model factual feature history |
| `unified_data_snapshots` | 133,160,960 | Captured unified evidence |
| `scorecaster_model_predictions_v1` | 108,937,216 | Independent model predictions |
| `unified_data_provider_observations` | 87,719,936 | Provider evidence |
| `sports_analytics_snapshots` | 79,200,256 | Enriched snapshots |
| `collector_records` | 61,505,536 | Acquisition history |
| `scorecaster_team_state_snapshots_v1` | 40,099,840 | Team state history |

Data from user accounts, bets, outcomes, closing odds, model calibration, betting settlement, audit trail and security policies must not be silently discarded. Some other tables also belong to this shared database.

## 2. Implemented non-destructive future write limits (PR #356)

- Market Microstructure: a maximum of **12 imminent upcoming events/cycle**, **2 events/league** and **4 bookmakers/event** across supported H2H, spreads and totals. The five owned European football leagues receive priority; the few non-owned slots rotate rather than permanently excluding other sports.
- Historical market cron: **every 3 hours** instead of every hour. Important downside: fine-grained line movement and odds close to kickoff may be missed. Live on-demand odds and match discovery are not limited.
- Sports Analytics worker: **10 unique events/cycle**, prioritizing owned football, instead of up to 20. The model is not promoted based on missing evidence.
- Unified Data already caps durable enriched selections at 18.
- On HTTP 402, protected workers stop before expensive acquisition; diagnostics report the real restriction. No retention/delete job is scheduled, no historical rows are deleted.

These changes **reduce growth; they do not reduce the existing 2.79 GB footprint**. Do not claim the Free plan is sustainable indefinitely until ongoing monthly usage is measured.

## 3. Make a recoverable archive before changing production

Prerequisites: PostgreSQL 17-compatible `pg_dump`, `pg_restore`, `psql`, Bash, `sha256sum`, free local disk space, an **encrypted user-controlled destination outside the Git repository**, and a database connection credential obtained securely from Supabase Dashboard > Database. Do not send database credentials to chat or commit them. For Windows, use WSL/Linux with PostgreSQL client tools.

1. Stop or pause **all application writers** for a consistent export. The Free-project service restriction may already block REST writes, but verify this; the direct SQL management connector might still allow management operations.
2. On your trusted computer, set `SCORECASTER_ARCHIVE_DATABASE_URL` to the Postgres connection string (prefer an appropriately restricted role capable of reading the required public tables). Run:

   ```bash
   bash scripts/free-tier-backup.sh /secure/offline/scorecaster-archives
   ```

   This exports **the entire `public` schema with data**, creates an index of restore items, captures exact row counts for critical tables, creates SHA-256 checksums, and never deletes or uploads data. It does **not** include the Supabase-managed `auth` and `storage` schemas, configuration, or object files: preserve those separately where relevant.
3. Copy the archive to **a second encrypted device/location**. Never put a SQL dump in GitHub, a public GitHub Actions artifact, or the same restricted Supabase Storage bucket. Check available free storage and file-size limits before selecting a cloud destination.
4. Create a separate, disposable PostgreSQL 17 database on your **local computer** called exactly `scorecaster_archive_restore_test`. Install required Supabase-compatible extensions and roles first. Connect with `SCORECASTER_ARCHIVE_RESTORE_TEST_URL` and run:

   ```bash
   bash scripts/free-tier-verify-restore.sh /secure/offline/scorecaster-archives/scorecaster-public-YYYYMMDDTHHMMSSZ.dump
   ```

   The verifier refuses remote addresses, any other database name, or a nonempty public-schema database. Only that isolated local test database is restored. It compares source table counts to restored counts.
5. If archive creation, checksums, restoration, row counts or extension compatibility fails, **stop**. Do not remove one production row.

Before a real retention operation, separately verify user-account recovery, live application access, and whether restored historical results and model provenance can still be queried offline.

## 4. Separate active and archived histories

Only after a complete tested backup and a documented, approved retention map:

- **Hot Supabase (under 400 MB):** user/session references, active bet and settlement state, current fixtures and prices, short recent observations, and latest verified model decisions. Keep enough genuine verified history to support current model checks; never substitute odds-market consensus as an independent model.
- **Cold encrypted archive:** historical bookmaker-price timelines, model feature snapshots, older independent predictions, outcome evidence, immutable decisions, and old experiment records. The archival format should be SQL-restorable and exportable for reproducible offline model training.
- **Proposed candidate windows for sizing only:** 1–3 days for low-value raw repeated price observations; 7–14 days for current supporting analytics; 30 days for active model snapshots; retain required bet/outcome and model audit rows or move complete audited historical sets together. These are **not an executable deletion policy**.
- Use `docs/operations/scorecaster-free-tier-capacity.sql` to measure actual eligible rows, database/index footprint, and foreign-key relationships. Without proved cardinality and restore, estimates are insufficient.
- Physically reclaiming Postgres space may require table/index rebuilds and extra temporary disk/locks. `DELETE` alone is *not* proof that the paid quota has been reduced. No `VACUUM FULL`, `REINDEX`, migration or deletion is authorized here.

Because the current database remains over limit and REST is already restricted, a carefully planned separate *empty* Free-project migration may be safer than heavyweight in-place rewrites; this is an **option**, not an automatically created project. Supabase Free has a project cap, and additional project/connection credentials and per-project limits must be checked before taking that route.

## 5. Release and verification gates

- [x] Non-destructive capture budgets and offline archive/restore tooling implemented in PR #356.
- [ ] Archive created on trusted local storage, independently copied and hash-verified.
- [ ] Full local restore actually succeeded, critical table row counts matched, and managed auth/user data addressed.
- [ ] Hot/cold retention map and foreign-key dependencies reviewed and approved.
- [ ] Hot Postgres physical usage is below 400 MB; REST no longer returns 402 (verify actual Supabase restriction reason and clearance).
- [ ] Authorized Collector, Unified Data, Market Microstructure and Sports Analytics runs write **new** rows. Check actual latest timestamps, not just HTTP 200.
- [ ] Production release evidence and security probes pass on the actual production code, including independent model freshness. Until then, keep PR #356 unmerged and paper-only recommendations unpromoted.

## 6. Honest operating limitations

This is a practical path to **try to maintain Scorecaster on Free**, not a guarantee of zero future charges. Supabase Free restrictions, available free external archive storage, Odds API usage, Vercel execution quotas, model training cost and actual demand all matter. Three-hour history snapshots cannot establish the same movement and closing-line fidelity as hourly/near-kickoff data. Record this limitation prominently in model evaluation and calibration.

Documentation: https://supabase.com/docs/guides/troubleshooting/http-status-codes and https://supabase.com/docs/guides/platform/billing-on-supabase.
