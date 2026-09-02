# Scorecaster production security hardening evidence — 2026-09-02

Environment: production Supabase project `rsukfxhgqzpofiszjtbf` in `eu-west-1`.

This document retains aggregate catalog and advisor evidence only. It contains no API keys, bearer tokens, password hashes, push tokens, request bodies or application-row contents.

## Authenticated RPC boundaries

Applied `supabase/scorecaster_authenticated_rpc_boundaries_v1.sql` in one transaction.

- Public RPCs checked: 4/4 present, 4/4 SECURITY INVOKER, 4/4 authenticated-executable, 4/4 anon-denied.
- Private implementations checked: 4/4 present, 4/4 SECURITY DEFINER, 4/4 authenticated-executable through the unexposed schema, 4/4 anon-denied.
- `scorecaster_private` USAGE for authenticated wrappers: verified.
- Functional smoke: notification-device claim, autonomous run request and both auto-watch preference RPCs passed under an authenticated JWT context inside a rollback transaction.
- Persistent test mutations: none.

Fresh Security Advisor result removed all four `authenticated_security_definer_function_executable` warnings.

## pg_net extension schema

Applied `supabase/scorecaster_pg_net_extension_schema_v1.sql` in one transaction after both a rollback dry-run and a zero-pending-request preflight.

- Extension: `pg_net` 0.20.0.
- Extension namespace: `extensions`.
- Pending requests before/after: 0/0.
- Active Scorecaster cron jobs using `net.http_*`: 4.
- Scorecaster private trigger functions using `net.http_*`: 5.
- `net.http_post` and worker check: available after reinstall.
- Cleared by reinstall: 26 ephemeral `net._http_response` cache rows.
- Scorecaster application tables/rows changed: none.

Fresh Security Advisor result removed `extension_in_public`.

## Remaining advisor state

- WARN/ERROR: one WARN, `auth_leaked_password_protection`.
- Reason: Supabase documents leaked-password protection as a Pro-plan feature; the current organization is on the Free plan.
- Release impact: documented paid defense-in-depth limitation, not an application availability blocker.
- INFO: 66 `rls_enabled_no_policy` notices remain for intentionally browser-closed server-only tables. RLS and revoked client grants are the fail-closed access model.

Scorecaster remains paper-only. No real-money execution, bookmaker login, wallet, deposit or withdrawal path was added.
