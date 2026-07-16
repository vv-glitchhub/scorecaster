# Scorecaster

AI-assisted sports market intelligence, no-vig odds consensus, risk control, account-based cloud history and paper tracking.

## Product boundary

Scorecaster is analysis and paper tracking only.

- No deposits or withdrawals
- No payment-card or bank data
- No bookmaker credentials
- No real-money balance
- No bet execution or bookmaker redirect
- No guarantee of profit

## Model integrity

The default Top Picks engine:

- removes each bookmaker's market margin
- creates a robust consensus from available no-vig probabilities
- compares the best available price with consensus fair odds
- exposes bookmaker coverage, agreement, freshness and numeric data confidence
- blocks stale and low-coverage data from receiving PLAY
- never adds the prototype's old fixed probability boost

Edge means best-price value versus market consensus. It is not proof that the selected team will win.

See `docs/MODEL_TRANSPARENCY.md`.

## Production and security status

Scorecaster has deployment and security guardrails:

- GitHub Actions runs secret scanning, API security tests, model tests, settlement tests and `npm run build`.
- CodeQL analyzes JavaScript and TypeScript.
- `/api/health` reports safe runtime, model and integration readiness.
- `/production-status` displays the health response in the app.
- Node.js is pinned through `.nvmrc`.
- Supabase sessions are refreshed through the Next.js root `proxy.js`.
- Mutating account APIs validate authentication, origin, body type, body size, ranges and record counts.
- Database Row Level Security isolates user rows.
- The protected API checks personal stake, minimum edge and minimum confidence limits.
- PostgreSQL enforces single stake, total open exposure, single-league exposure and Scorecaster quality thresholds.
- Authenticated APIs use atomic per-user PostgreSQL quotas and return HTTP 429 with `Retry-After`.
- Automatic H2H paper result checks are user-triggered, rate-limited and bounded.
- The public odds proxy only accepts known sports and markets, normalizes requests, times out upstream calls and caches responses.
- Top Picks supports a bounded league filter, publishes a cached Top 3 and always marks results as paper-only.
- HTTP security headers block framing, MIME sniffing and unnecessary device permissions.

## Native mobile MVP

The `mobile/` directory contains the Expo iOS and Android application.

It includes:

- email/password Supabase authentication
- chunked Expo SecureStore session persistence
- HTTPS bearer-authenticated user API calls
- NHL, NBA, EPL, La Liga, Liiga and SHL filters
- daily Top 3 plus wider consensus pick list
- trust score and PLAY / CAUTION / SKIP output
- fair odds, edge, EV, bookmaker coverage and data freshness
- editable virtual bankroll and personal paper-risk thresholds
- server- and database-enforced paper limits
- paper-bet saving and manual settlement
- user-triggered automatic H2H result checking
- optional closing odds, CLV, ROI and result summary
- probability calibration, expected versus actual hit rate and Brier score
- drawdown, streak, open exposure and league performance
- JSON data export through the device share sheet
- in-app account deletion
- privacy, terms, responsible-use and security links
- explicit paper-only product messaging
- EAS preview and production profiles
- Expo dependency compatibility and strict TypeScript CI

Mobile setup:

```bash
cd mobile
cp .env.example .env
npm install
npx expo install --check
npm run typecheck
npm run start
```

See `mobile/README.md`, `docs/MODEL_TRANSPARENCY.md` and `docs/MOBILE_SECURITY_RELEASE.md`.

## Start web locally

```bash
npm install --no-audit --no-fund
npm run security:check
npm test
npm run build
npm run dev
```

Then open:

```text
http://localhost:3000/quick-use
```

Production routes:

```text
https://scorecaster.vercel.app/quick-use
https://scorecaster.vercel.app/intelligence
https://scorecaster.vercel.app/login
https://scorecaster.vercel.app/profile
https://scorecaster.vercel.app/cloud-sync
https://scorecaster.vercel.app/privacy
https://scorecaster.vercel.app/terms
https://scorecaster.vercel.app/responsible-use
https://scorecaster.vercel.app/security
https://scorecaster.vercel.app/production-status
https://scorecaster.vercel.app/core-status
https://scorecaster.vercel.app/api/health
```

## Main protected APIs

- `GET/POST/PATCH/DELETE /api/cloud/bets` — authenticated paper history, personal threshold enforcement, result and CLV
- `POST /api/cloud/bets/settle` — authenticated and rate-limited automatic H2H score check
- `GET/PUT /api/cloud/bankroll` — authenticated virtual bankroll and paper-risk controls
- `GET /api/account/export` — authenticated user-data export
- `GET/DELETE /api/account` — account-deletion readiness and permanent deletion

The same APIs accept validated web cookie sessions and mobile bearer access tokens. They fail closed when the database-backed quota layer has not been activated.

## Public analysis APIs

- `GET /api/odds?sport=<known-key>&markets=h2h` — normalized cached European decimal odds
- `GET /api/top-picks` — cached default league set and featured Top 3
- `GET /api/top-picks?sports=<comma-separated-known-keys>` — one to six supported leagues

Unknown query parameters, unsupported sports and unsupported markets are rejected before an upstream request is made.

## What you can use

- Add manual picks in `/quick-use`
- Save a local paper slip in the browser
- Test stake, edge and confidence
- See PLAY / CAUTION / SKIP decisions with data-quality explanations
- Create a Supabase-backed Scorecaster account
- Validate the session server-side
- Sync the local paper slip to user-specific cloud history
- Set and enforce virtual-bankroll, stake, league, edge and confidence limits
- Settle paper bets manually or check supported H2H results automatically
- Track profit, ROI, closing odds, CLV, drawdown and league performance
- Measure probability calibration and Brier score from stored Scorecaster picks
- Retrieve and delete paper bets through an authenticated API
- Prevent duplicate syncs with `(user_id, client_ref)` upserts
- Isolate users with Supabase Row Level Security
- Export account data
- Delete an account from the app when server deletion is configured
- Open Dashboard, Intelligence, Betting, Analytics and Risk Control

## Supabase activation

Follow:

```text
docs/AUTH_CLOUD_SETUP.md
docs/MOBILE_SECURITY_RELEASE.md
```

Run these SQL files in order:

```text
supabase/scorecaster_schema.sql
supabase/scorecaster_auth_cloud.sql
supabase/scorecaster_paper_risk_limits.sql
supabase/scorecaster_api_rate_limits.sql
```

Re-run `scorecaster_paper_risk_limits.sql` after a release that changes the trigger. Public launch is blocked until the documented two-user isolation, paper-risk, automatic settlement and quota tests pass.

## Environment

Copy `.env.example` to `.env.local` for local development.

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ODDS_API_KEY=
OPENAI_API_KEY=
```

Legacy Supabase projects can use `NEXT_PUBLIC_SUPABASE_ANON_KEY` instead of the publishable key.

`SUPABASE_SERVICE_ROLE_KEY`, `ODDS_API_KEY` and `OPENAI_API_KEY` are server-only. Never expose them to browser or mobile code. Never commit `.env.local`, `mobile/.env` or secret values.

## Current foundation

- `.github/workflows/ci.yml`
- `.github/workflows/mobile-ci.yml`
- `.github/workflows/codeql.yml`
- `scripts/security-check.mjs`
- `scripts/api-security.test.mjs`
- `scripts/market-consensus.test.mjs`
- `scripts/paper-settlement.test.mjs`
- `mobile/`
- `docs/MODEL_TRANSPARENCY.md`
- `docs/AUTH_CLOUD_SETUP.md`
- `docs/MOBILE_SECURITY_RELEASE.md`
- `lib/market-consensus-engine.mjs`
- `lib/paper-settlement-engine.mjs`
- `lib/api-security.js`
- `lib/production-risk-rules.js`
- `lib/bet-slip-engine.js`
- `lib/caster-core-contract.js`
- `lib/supabase/client.js`
- `lib/supabase/server.js`
- `proxy.js`
- `supabase/scorecaster_schema.sql`
- `supabase/scorecaster_auth_cloud.sql`
- `supabase/scorecaster_paper_risk_limits.sql`
- `supabase/scorecaster_api_rate_limits.sql`
- `/privacy`
- `/terms`
- `/responsible-use`
- `/security`

## Important

Scorecaster must not promise profit. The agent must be allowed to say SKIP. Cloud sync keeps the local browser copy after upload until the user explicitly clears it during the alpha phase.
