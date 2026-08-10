# Production hardening evidence V1.3

Production Supabase hardening was applied and read-only verified on 2026-08-10.

Verified invariants after apply:

- dangerous browser table grants (`TRUNCATE`, `TRIGGER`, `REFERENCES`): 0
- anonymous `SECURITY DEFINER` EXECUTE grants: 0
- unexpected authenticated `SECURITY DEFINER` EXECUTE grants outside the reviewed allowlist: 0
- browser grants on policyless RLS tables: 0
- every public ordinary/partitioned table: RLS + FORCE RLS enabled

The reviewed authenticated `SECURITY DEFINER` allowlist remains intentionally limited to:

- `consume_api_quota(text,integer,integer)`
- `claim_notification_device(text,text,text,text)`
- `request_autonomous_agent_run()`

The Supabase Security Advisor was rerun after apply. Remaining policyless-RLS notices are informational for server-internal relations with browser grants removed. Leaked-password protection remains a separate Auth configuration item and is not claimed as fixed by this SQL hardening.

Scorecaster remains paper-only.
