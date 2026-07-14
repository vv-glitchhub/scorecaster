# Scorecaster mobile security and release gate

## Product boundary

Scorecaster is sports analysis, AI explanation, risk control and paper tracking. It never accepts deposits, stores payment cards, connects to bookmaker credentials, holds real-money balances or places real-money bets.

## Architecture

```text
Expo iOS / Android app
  -> Supabase Auth with session in Expo SecureStore
  -> HTTPS Scorecaster API with bearer access token
  -> server revalidates user and the single paper-stake limit
  -> database-backed per-user API quota
  -> PostgreSQL enforces single and total open paper exposure
  -> Supabase queries run under the user's JWT
  -> Row Level Security limits rows to auth.uid()
```

Odds provider keys, AI provider keys and the Supabase service-role key remain on the server. They are forbidden from the mobile bundle by CI.

## Mandatory Supabase activation

Run in order:

```text
supabase/scorecaster_schema.sql
supabase/scorecaster_auth_cloud.sql
supabase/scorecaster_paper_risk_limits.sql
supabase/scorecaster_api_rate_limits.sql
```

Configure:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY  # server only, required for account deletion
```

The service-role value must never use a `NEXT_PUBLIC_` or `EXPO_PUBLIC_` prefix.

## Paper-risk enforcement

The app displays the user's virtual bankroll, maximum single paper stake and maximum open paper exposure. These controls are also enforced outside the UI:

- the protected API rejects a single paper stake above the configured percentage
- PostgreSQL rejects a direct or modified-client write above the single-stake limit
- PostgreSQL also rejects total open paper exposure above the configured exposure percentage
- database constraint failures are returned as safe HTTP 400 responses without exposing internal SQL details

These are simulation safeguards. They do not turn Scorecaster into a real-money product.

## Abuse protection

Authenticated account endpoints use an atomic PostgreSQL quota function keyed by the verified `auth.uid()`. The API fails closed if the rate-limit migration is missing. Account deletion and exports use stricter hourly limits than ordinary paper-tracking reads.

The public odds proxy accepts only known Scorecaster sports and the `h2h`, `spreads` and `totals` markets. It rejects unknown query keys, forces European decimal odds, applies an upstream timeout and caches normalized responses. Top Picks supports at most six known leagues per request and publishes a cached Top 3 subset.

Stale rate-limit counters contain only a user ID, bucket name, count and timestamps. They should be deleted after two days by invoking `delete_stale_api_rate_limits()` from trusted server maintenance.

## Two-user and risk test

1. Create users A and B.
2. Sign in as A and save a paper bet plus bankroll settings.
3. Try a paper stake above A's single-stake percentage and confirm HTTP 400.
4. Add open paper bets until the total exposure limit would be exceeded and confirm the database rejects the final write.
5. Sign in as B and verify A's rows are absent.
6. From B, attempt direct select, update and delete operations against A's row IDs.
7. Confirm every operation returns no row or an authorization error.
8. Repeat through cookie web auth and bearer mobile auth.
9. Export each user's data and confirm exports contain only the authenticated account.
10. Repeatedly call a protected endpoint and confirm the configured quota returns HTTP 429 with `Retry-After`.
11. Delete user A and confirm A can no longer authenticate and A's rows are removed.

Public release is blocked until this test passes.

## Automated gates

- root Next.js production build
- repository secret scan
- API security regression tests
- CodeQL JavaScript/TypeScript analysis
- Expo dependency compatibility check
- mobile strict TypeScript check
- Vercel preview deployment when the Vercel build allowance is available

## Mobile configuration

```bash
cd mobile
cp .env.example .env
npm install
npx expo install --check
npm run typecheck
```

Only public client values belong in `mobile/.env`.

## Store-release blockers that remain external

- activate all Supabase migrations in the real project
- configure production environment values
- complete two-user, paper-risk and quota tests
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
