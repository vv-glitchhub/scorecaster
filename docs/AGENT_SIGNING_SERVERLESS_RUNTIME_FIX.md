# Agent signing serverless runtime fix

Production verification on 2026-08-18 showed that the first Vault implementation built and deployed successfully but `/api/health` still reported Agent decision signing as unconfigured.

Root cause: Vercel serverless functions cannot rely on a `process.env` mutation performed by Next.js instrumentation in another isolated function instance.

Fix:

- resolve the dedicated Agent signing key inside the portfolio request before ticket creation;
- resolve the same key inside the explanation request before ticket verification;
- resolve signing readiness inside `/api/health` instead of inspecting only the original environment variable;
- retain environment-key precedence and the existing service-role-only Supabase Vault fallback;
- retain the five-minute in-process Vault cache, HMAC-SHA256 ticket format and fail-closed behavior;
- never return or log the secret value.

The product remains paper-only and no real-money execution capability is added.
