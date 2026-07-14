# Scorecaster Auth + Cloud Sync Setup

This guide enables user accounts and protected paper-bet storage while keeping Quick Use available locally.

## 1. Supabase project

Create or open the Supabase project used by Scorecaster.

Copy these values from the project Connect dialog:

- Project URL
- Publishable key (or legacy anon key)
- Service-role key for server-only account deletion

## 2. Database schema and security

Open the Supabase SQL editor and run the files in this order:

1. `supabase/scorecaster_schema.sql`
2. `supabase/scorecaster_auth_cloud.sql`
3. `supabase/scorecaster_paper_risk_limits.sql`
4. `supabase/scorecaster_api_rate_limits.sql`

The migrations add:

- `profiles`
- the cloud `bets` table
- paper-bankroll settings
- a stable local `client_ref` for duplicate-safe sync
- indexes and data constraints
- automatic profile creation
- forced Row Level Security
- user-specific policies
- database enforcement for single paper stake and total open paper exposure
- database-backed per-user API quotas

Do not use the service-role key in browser or mobile code. Normal account operations use the public key, a verified user JWT and RLS. The service-role key is read only by the server for permanent account deletion.

## 3. Supabase Auth settings

Enable Email + Password authentication.

Set the Site URL to the production address:

```text
https://scorecaster.vercel.app
```

Add this Redirect URL:

```text
https://scorecaster.vercel.app/auth/confirm
```

For local development also add:

```text
http://localhost:3000/auth/confirm
```

The native app uses Supabase mobile sessions and must be tested with the `scorecaster://` application scheme before store release.

## 4. Vercel environment variables

Add these to the Scorecaster Vercel project:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ODDS_API_KEY=
OPENAI_API_KEY=
```

Legacy Supabase projects can use this instead of the publishable key:

```text
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Redeploy after changing environment variables. Never prefix the service-role, Odds API or OpenAI key with `NEXT_PUBLIC_` or `EXPO_PUBLIC_`.

## 5. Test the full path

1. Open `/production-status` and confirm Supabase is configured.
2. Open `/login`.
3. Create account A and confirm the email when required.
4. Open `/profile` and confirm the server validates the account.
5. Set account A's virtual bankroll and paper-risk percentages.
6. Add a manual paper pick in `/quick-use` or the mobile app.
7. Open `/cloud-sync` and sync the local pick.
8. Refresh and confirm the cloud history remains visible.
9. Try a single paper stake above the configured limit and confirm HTTP 400.
10. Try to exceed the total open paper-exposure limit and confirm the database rejects the write.
11. Settle a paper bet with optional closing odds and confirm profit, ROI and CLV are calculated.
12. Create account B and verify it cannot read, update or delete account A's rows.
13. Repeat a protected request until HTTP 429 and `Retry-After` are returned.
14. Export account A's data and confirm only A's rows are included.
15. Delete account A and confirm it can no longer authenticate.

## Routes

- `/login` — sign in and account creation
- `/auth/confirm` — email confirmation / PKCE callback
- `/profile` — server-validated account and privacy controls
- `/cloud-sync` — local-to-cloud migration and cloud history
- `/api/cloud/bets` — authenticated GET / POST / PATCH / DELETE API
- `/api/cloud/bankroll` — authenticated paper-bankroll settings
- `/api/account/export` — authenticated user-data export
- `/api/account` — account-deletion status and permanent deletion
- `/api/health` — deployment and integration status

## Security model

Browser and mobile clients use a public Supabase key. Authorization, risk control and abuse protection are enforced by:

- validated Supabase user sessions
- server-side `getUser()` checks for protected APIs
- RLS policies using `auth.uid()`
- server and database paper-stake validation
- database total-open-exposure validation
- atomic per-user PostgreSQL request quotas
- exact-origin validation for cookie mutations
- API content-type, body-size, text-length and numeric-range validation
- maximum batch sizes
- duplicate-safe `(user_id, client_ref)` upserts
- server-only integration secrets

The local browser copy is not deleted automatically after sync. This prevents data loss while the cloud layer is being tested.
