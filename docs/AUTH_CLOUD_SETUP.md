# Scorecaster Auth + Cloud Sync Setup

This guide enables user accounts and cloud bet storage while keeping Quick Use available locally.

## 1. Supabase project

Create or open the Supabase project used by Scorecaster.

Copy these values from the project Connect dialog:

- Project URL
- Publishable key (or legacy anon key)

## 2. Database schema and security

Open the Supabase SQL editor and run the files in this order:

1. `supabase/scorecaster_schema.sql`
2. `supabase/scorecaster_auth_cloud.sql`

The second migration adds:

- `profiles`
- the cloud `bets` table
- a stable local `client_ref` for duplicate-safe sync
- indexes
- automatic profile creation
- Row Level Security
- user-specific policies

Do not use the service-role key in browser code. The app uses the public key and RLS.

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

## 4. Vercel environment variables

Add these to the Scorecaster Vercel project:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
ODDS_API_KEY=
OPENAI_API_KEY=
```

Legacy Supabase projects can use this instead of the publishable key:

```text
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Redeploy after changing environment variables.

## 5. Test the full path

1. Open `/production-status` and confirm Supabase is configured.
2. Open `/login`.
3. Create an account and confirm the email when required.
4. Open `/profile` and confirm the server validates the account.
5. Add a manual pick in `/quick-use`.
6. Open `/cloud-sync`.
7. Sync the local picks.
8. Refresh and confirm the cloud history remains visible.
9. Sign out and verify another account cannot see the first account's bets.

## Routes

- `/login` — sign in and account creation
- `/auth/confirm` — email confirmation / PKCE callback
- `/profile` — server-validated account page
- `/cloud-sync` — local-to-cloud migration and cloud history
- `/api/cloud/bets` — authenticated GET / POST / DELETE API
- `/api/health` — deployment and integration status

## Security model

Browser and server clients use the public Supabase key. Authorization is enforced by:

- validated Supabase user sessions
- server-side `getUser()` checks for cloud APIs
- RLS policies using `auth.uid()`
- API payload validation
- maximum batch sizes
- duplicate-safe `(user_id, client_ref)` upserts

The local browser copy is not deleted automatically after sync. This prevents data loss while the cloud layer is being tested.
