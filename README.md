# Scorecaster

AI-powered sports intelligence, odds analysis, risk control, account-based cloud history and paper-tracking workspace.

## Product boundary

Scorecaster is analysis and paper tracking only.

- No deposits or withdrawals
- No payment-card or bank data
- No bookmaker credentials
- No real-money balance
- No bet execution or bookmaker redirect
- No guarantee of profit

## Production and security status

Scorecaster has deployment and security guardrails:

- GitHub Actions runs the secret/security gate and `npm run build`.
- CodeQL analyzes JavaScript and TypeScript.
- `/api/health` reports safe runtime and integration readiness.
- `/production-status` displays the health response in the app.
- Node.js is pinned through `.nvmrc`.
- Supabase sessions are refreshed through the Next.js root `proxy.js`.
- Mutating account APIs validate auth, origin, JSON type, body size, ranges and record counts.
- Database Row Level Security isolates user rows.
- HTTP security headers block framing, MIME sniffing and unnecessary device permissions.

## Native mobile application

The `mobile/` directory contains the Expo iOS and Android foundation.

It includes:

- email/password Supabase authentication
- chunked Expo SecureStore session persistence
- HTTPS bearer-authenticated user API calls
- daily picks
- paper-bet saving and settlement
- paper-bankroll view
- data export
- in-app account deletion
- explicit paper-only product messaging
- EAS preview and production profiles
- strict TypeScript CI

Mobile setup:

```bash
cd mobile
cp .env.example .env
npm install
npx expo install --fix
npm run typecheck
npm run start
```

See `mobile/README.md` and `docs/MOBILE_SECURITY_RELEASE.md`.

## Start web locally

```bash
npm install --no-audit --no-fund
npm run security:check
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

- `GET/POST/PATCH/DELETE /api/cloud/bets` — authenticated paper-bet history
- `GET/PUT /api/cloud/bankroll` — authenticated paper-bankroll controls
- `GET /api/account/export` — authenticated user-data export
- `GET/DELETE /api/account` — account-deletion readiness and permanent deletion

The same APIs accept validated web cookie sessions and mobile bearer access tokens.

## What you can use

- Add manual picks in `/quick-use`
- Save a local paper slip in the browser
- Test stake, edge and confidence
- See OK / CAUTION / SKIP risk decisions
- Create a Supabase-backed Scorecaster account
- Validate the session server-side
- Sync the local paper slip to user-specific cloud history
- Settle paper bets as won, lost, void or push
- Retrieve and delete paper bets through an authenticated API
- Prevent duplicate syncs with `(user_id, client_ref)` upserts
- Isolate users with Supabase Row Level Security
- Export account data
- Delete an account from the app when server deletion is configured
- Open Dashboard, Betting, Analytics and Risk Control

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
```

Public launch is blocked until the documented two-user isolation test passes.

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
- `mobile/`
- `docs/PRODUCTION_MVP.md`
- `docs/PRODUCTION_RUNBOOK.md`
- `docs/CASTER_CORE_FOUNDATION.md`
- `docs/AUTH_CLOUD_SETUP.md`
- `docs/MOBILE_SECURITY_RELEASE.md`
- `lib/api-security.js`
- `lib/production-risk-rules.js`
- `lib/bet-slip-engine.js`
- `lib/caster-core-contract.js`
- `lib/supabase/client.js`
- `lib/supabase/server.js`
- `proxy.js`
- `supabase/scorecaster_schema.sql`
- `supabase/scorecaster_auth_cloud.sql`
- `/privacy`
- `/terms`
- `/responsible-use`
- `/security`

## Important

Scorecaster must not promise profit. The agent must be allowed to say SKIP. Cloud sync keeps the local browser copy after upload until the user explicitly clears it during the alpha phase.
