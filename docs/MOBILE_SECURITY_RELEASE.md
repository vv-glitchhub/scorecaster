# Scorecaster mobile security and release gate

## Product boundary

Scorecaster is sports analysis, AI explanation, risk control and paper tracking. It never accepts deposits, stores payment cards, connects to bookmaker credentials, holds real-money balances or places real-money bets.

## Architecture

```text
Expo iOS / Android app
  -> Supabase Auth with session in Expo SecureStore
  -> HTTPS Scorecaster API with bearer access token
  -> server revalidates user
  -> Supabase queries run under the user's JWT
  -> Row Level Security limits rows to auth.uid()
```

Odds provider keys, AI provider keys and the Supabase service-role key remain on the server. They are forbidden from the mobile bundle by CI.

## Mandatory Supabase activation

Run in order:

```text
supabase/scorecaster_schema.sql
supabase/scorecaster_auth_cloud.sql
```

Configure:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY  # server only, required for account deletion
```

The service-role value must never use a `NEXT_PUBLIC_` or `EXPO_PUBLIC_` prefix.

## Two-user isolation test

1. Create users A and B.
2. Sign in as A and save a paper bet plus bankroll settings.
3. Sign in as B and verify A's rows are absent.
4. From B, attempt direct select, update and delete operations against A's row IDs.
5. Confirm every operation returns no row or an authorization error.
6. Repeat through cookie web auth and bearer mobile auth.
7. Export each user's data and confirm exports contain only the authenticated account.
8. Delete user A and confirm A can no longer authenticate and A's rows are removed.

Public release is blocked until this test passes.

## Automated gates

- root Next.js production build
- repository secret scan
- CodeQL JavaScript/TypeScript analysis
- mobile strict TypeScript check
- Vercel preview deployment

## Mobile configuration

```bash
cd mobile
cp .env.example .env
npm install
npx expo install --fix
npm run typecheck
```

Only public client values belong in `mobile/.env`.

## Store-release blockers that remain external

- activate Supabase migration in the real project
- configure production environment values
- complete two-user isolation test
- link an Expo EAS project
- create Apple and Google developer accounts
- add final icon, splash assets and store screenshots
- finalize legal controller identity and support contact
- complete age-rating and gambling-content questionnaires truthfully
- run external security review
- complete TestFlight and Google Play internal testing

## Incident rules

- rotate a secret immediately if it is exposed
- revoke compromised sessions
- preserve minimal audit evidence without copying user content into logs
- notify affected users and authorities when legally required
- do not publish exploitable vulnerability details in a public issue
