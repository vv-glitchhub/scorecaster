# Scorecaster Supabase 402 recovery runbook
_Status: verified 2026-10-15. Non-destructive operational procedure._

## What is broken

- Supabase organization is on the **Free** plan; included database size is **500 MB per project**.
- Direct read-only PostgreSQL inspection reports about **2,791 MB** for the project database; the public REST API returns **HTTP 402** for reads, including `unified_data_snapshots`.
- The latest `unified_data_snapshots`, `market_provider_snapshots_v2`, and `sports_analytics_snapshots` were written **2026-09-30**. Scheduled Collector/Unified Data/Settlement workers subsequently return failures.
- The project itself is ACTIVE_HEALTHY, and SQL management queries work. **This does not imply that PostgREST/Auth/Storage requests work.**
- Supabase documentation says a Fair Use restriction can return **402 for all API requests**. See:
  - https://supabase.com/docs/guides/troubleshooting/http-status-codes#402-service-restriction
  - https://supabase.com/docs/guides/platform/billing-faq#fair-use-policy

## Immediate safe actions

1. In the correct Supabase organization, open **Billing / Usage** and confirm the specific restriction reason (for example `exceed_db_size_quota`) and billing period. A 402 can also be caused by overdue payment; do **not** conclude from size alone that every restriction has the same cause.
2. **Choose the cost/data tradeoff explicitly**:
   - **Safest non-destructive path:** authorize upgrading the affected organization to Pro (current docs state 8 GB included database size per project). Check the actual checkout total, compute charges, spend cap and other projects before confirming payment.
   - **Free-plan path:** export and independently verify a recoverable backup of the large historical tables; document retention requirements, references and index size. Only after explicit approval, archive/migrate aged data and reclaim enough database disk to fit below the Free threshold. Merely running DELETE may **not** reclaim allocated space immediately. Large `VACUUM FULL` / `REINDEX` may lock tables or demand extra disk; never run casually during an outage.
   - **Wait for quota reset:** Supabase may lift usage restrictions when its billing cycle resets; the actual cycle and specific restriction need confirmation. This does not solve the persistent database growth issue.
3. Preserve odds movement, opening and closing lines, CLV, bets, outcome settlement, training provenance and independent-model calibration data. Do not remove them as part of a quick quota fix.
4. After the restriction is lifted, first perform a **read-only HEAD** probe to the `unified_data_snapshots` REST endpoint with valid server credentials; require a non-402 success. Do **not** write or replay all historical captures as a "test".
5. Execute a single authorized bounded collector and Unified Data cycle; confirm the worker responds 200 and **new timestamps** exist in the database. Check `collector_runs` and actual stored selection counts. Then resume the normal schedule.
6. Verify current independent model decisions and out-of-sample calibration separately; restored market odds alone are **not** proof of a qualified PLAY prediction.
7. Re-run CI, deploy a tested preview, update legitimate production worker guard evidence, and require the external production release gate to pass before promotion.

## Read-only verification SQL

```sql
SELECT pg_size_pretty(pg_database_size(current_database())) AS db_size;

SELECT 'unified_data_snapshots' AS source, max(captured_at) AS latest
FROM public.unified_data_snapshots
UNION ALL
SELECT 'market_provider_snapshots_v2', max(captured_at)
FROM public.market_provider_snapshots_v2
UNION ALL
SELECT 'sports_analytics_snapshots', max(captured_at)
FROM public.sports_analytics_snapshots;

SELECT relname, pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
       n_live_tup AS estimated_rows
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(relid) DESC LIMIT 20;
```

## Expected application behavior until resolved

- Live third-party odds or provider-verified fixtures may still be displayed.
- Database freshness and protected worker endpoints return a clear `supabase-service-restricted` error and do **not** misrepresent the pipeline as fresh.
- The scheduled workers fail closed and report a billing/quota restriction; no secret values or raw provider responses are logged.
- Do not promote hypothetical high-probability / high-value bets on old or market-only evidence.

No subscriptions, migration, deletion, scheduled writes, or real-money actions are authorized by this document.
