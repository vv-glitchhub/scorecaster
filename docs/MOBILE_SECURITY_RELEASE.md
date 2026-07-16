# Scorecaster mobile security and release gate

## Product boundary

Scorecaster is sports analysis, AI explanation, risk control and paper tracking. It never accepts deposits, stores payment cards, connects to bookmaker credentials, holds real-money balances or places real-money bets.

## Architecture

```text
Expo iOS / Android app
  -> Supabase Auth with session in Expo SecureStore
  -> HTTPS Scorecaster API with bearer access token
  -> server revalidates user and personal paper thresholds
  -> database-backed per-user API quota
  -> PostgreSQL enforces stake, total exposure, league exposure and quality limits
  -> optional server-only scores provider settles supported open H2H paper rows
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

Run the paper-risk migration again after any release that changes the trigger. It is idempotent and replaces the existing trigger function.

Configure:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY  # server only, required for account deletion
ODDS_API_KEY               # server only, odds and optional score settlement
```

The service-role, Odds API and AI values must never use a `NEXT_PUBLIC_` or `EXPO_PUBLIC_` prefix.

## Paper-risk enforcement

The app displays the user's virtual bankroll, maximum single paper stake, maximum open paper exposure, maximum single-league exposure, minimum edge and minimum confidence. These controls are also enforced outside the UI:

- the protected API rejects a single paper stake above the configured percentage
- the protected API rejects Scorecaster picks below the user's edge or confidence threshold
- PostgreSQL rejects modified-client and direct writes above the single-stake limit
- PostgreSQL rejects total open paper exposure above the configured percentage
- PostgreSQL rejects open exposure in one league above the configured percentage
- PostgreSQL rejects Scorecaster-generated open picks below the stored edge or confidence threshold
- the trigger locks the user's settings row while evaluating exposure to reduce simultaneous-write bypasses
- database constraint failures are returned as safe HTTP 400 responses without exposing internal SQL details

Manual paper entries remain available for comparison and education. They are exempt from Scorecaster quality thresholds, but not from stake or exposure limits.

These are simulation safeguards. They do not turn Scorecaster into a real-money product.

## Automatic paper settlement

`POST /api/cloud/bets/settle` is an authenticated, user-triggered helper for supported H2H paper picks.

Security and cost controls:

- exact-origin validation for cookie clients and bearer authentication for mobile
- server-only `ODDS_API_KEY`
- database-backed limit of three checks per authenticated user per hour
- at most 100 open rows loaded per request
- at most six represented sports requested per check
- at most 50 rows updated per check
- upstream timeout and five-minute server cache
- event-ID matching first; conservative normalized team matching second
- only completed events with numeric scores are settled
- only the authenticated user's rows that are still open are updated
- ambiguous, incomplete and unsupported selections remain open
- settlement metadata contains only the event ID, final score, timestamps and source

Automatic settlement currently targets H2H team or draw selections. Totals, spreads, outrights and ambiguous legacy labels require manual review.

## Probability history and calibration

Protected cloud rows retain a minimal sanitized `raw_pick` object containing the model probability, implied probability, decision, quality fields and settlement metadata. This enables Brier score and calibration calculations without storing bookmaker credentials, payment data or unrestricted third-party payloads.

Manual rows without a valid model probability are excluded from calibration instead of being assigned invented values.

## Abuse protection

Authenticated account endpoints use an atomic PostgreSQL quota function keyed by the verified `auth.uid()`. The API fails closed if the rate-limit migration is missing. Account deletion and exports use stricter hourly limits than ordinary paper-tracking reads.

The public odds proxy accepts only known Scorecaster sports and the `h2h`, `spreads` and `totals` markets. It rejects unknown query keys, forces European decimal odds, applies an upstream timeout and caches normalized responses. Top Picks supports at most six known leagues per request and publishes a cached Top 3 subset.

Stale rate-limit counters contain only a user ID, bucket name, count and timestamps. They should be deleted after two days by invoking `delete_stale_api_rate_limits()` from trusted server maintenance.

## Two-user, risk and settlement test

1. Create users A and B.
2. Sign in as A and save paper-bankroll settings.
3. Try a Scorecaster paper pick below A's minimum edge and confirm HTTP 400.
4. Try a Scorecaster paper pick below A's minimum confidence and confirm HTTP 400.
5. Try a paper stake above A's single-stake percentage and confirm HTTP 400.
6. Add open paper bets until the total exposure limit would be exceeded and confirm rejection.
7. Add same-league open paper bets until the league exposure limit would be exceeded and confirm rejection.
8. Save a supported H2H pick with an event ID and run the result checker after a completed test event.
9. Confirm only A's matching still-open row is settled and the final score metadata is minimal.
10. Repeat the result checker until HTTP 429 with `Retry-After` is returned.
11. Sign in as B and verify A's rows are absent.
12. From B, attempt direct select, update and delete operations against A's row IDs.
13. Confirm every operation returns no row or an authorization error.
14. Repeat through cookie web auth and bearer mobile auth.
15. Export each user's data and confirm exports contain only the authenticated account.
16. Delete user A and confirm A can no longer authenticate and A's rows are removed.

Public release is blocked until this test passes.

## Automated gates

- root Next.js production build
- repository secret scan
- API security regression tests
- no-vig market consensus regression tests
- paper score-settlement regression tests
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
- complete two-user, paper-risk, result-settlement and quota tests
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
