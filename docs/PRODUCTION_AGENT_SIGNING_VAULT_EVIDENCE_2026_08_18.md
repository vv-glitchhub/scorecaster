# Production Agent decision signing Vault evidence — 2026-08-18

## Scope

This document retains non-secret production evidence for the dedicated Scorecaster Agent decision-ticket signing key. It does **not** contain the key, a fingerprint of the key, a decrypted value, a user identifier, an auth token or a service-role credential.

## Production migration

- Supabase project: production Scorecaster project (project reference intentionally omitted from public evidence)
- Supabase migration registry version: `20260818025626`
- Migration name: `agent_decision_signing_vault_v1`
- Repository migration: `supabase/scorecaster_agent_decision_signing_vault.sql`
- Applied through the Supabase migration API on 2026-08-18

## Vault boundary verified after apply

Read-only catalog verification returned:

- `supabase_vault` extension present (0.3.1)
- exactly one secret named `scorecaster.agent_decision_signing_key`
- decrypted secret length: 96 characters (generated from 48 random bytes encoded as hex)
- RPC: `public.scorecaster_agent_decision_signing_key()`
- RPC is `SECURITY DEFINER`
- RPC search path is constrained to `pg_catalog, vault`
- `PUBLIC` EXECUTE: false
- `anon` EXECUTE: false
- `authenticated` EXECUTE: false
- `service_role` EXECUTE: true

The secret value was never selected into this document, logs, GitHub, browser code or release evidence.

## Advisor result

Supabase security advisors were run after the DDL change. The new `scorecaster_agent_decision_signing_key()` RPC did not appear in the signed-in SECURITY DEFINER warning set. Existing unrelated informational/warning items remain tracked separately; no broad grant was introduced to clear them.

Performance advisors produced only existing unused-index informational notices; the signing migration creates no index or table and introduced no new performance warning.

## Runtime contract

- An explicit server-only `AGENT_DECISION_SIGNING_KEY` environment value remains the first choice.
- If it is absent, Next.js Node instrumentation loads the dedicated key through the service-role-only Vault RPC before requests are served.
- Existing HMAC-SHA256 decision tickets and expiry semantics are unchanged.
- Vault/RPC failure keeps enhanced Agent explanations fail-closed on deterministic fallback.
- No client-side key fallback exists.

## Safety boundary

- sports analysis, risk control and paper tracking only
- no bookmaker credential storage
- no deposits or withdrawals
- no real-money bet execution
- no automatic model promotion
