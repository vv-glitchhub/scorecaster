# Scorecaster

AI-powered sports intelligence, odds analysis, risk control, account-based cloud history and paper-tracking workspace.

## Production status

Scorecaster has deployment and service guardrails:

- GitHub Actions runs `npm run build` for pull requests and `main` pushes.
- `/api/health` reports safe runtime and integration readiness.
- `/production-status` displays the health response in the app.
- Node.js is pinned through `.nvmrc`.
- Supabase sessions are refreshed through the Next.js root `proxy.js`.

## Start using

Run locally:

```bash
npm install --no-audit --no-fund
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
https://scorecaster.vercel.app/production-status
https://scorecaster.vercel.app/core-status
https://scorecaster.vercel.app/api/health
```

## Main pages

- `/quick-use` — manual local bet slip and risk test
- `/login` — sign in or create an account
- `/profile` — server-validated account page
- `/cloud-sync` — sync local picks to protected cloud history
- `/production-status` — deployment and integration status
- `/core-status` — shared Caster Core state
- `/api/health` — JSON health endpoint
- `/api/cloud/bets` — authenticated cloud bet API
- `/` — Scorecaster dashboard
- `/betting` — Betting workspace
- `/risk` — Bankroll and responsible risk control
- `/analytics` — Performance, ROI and CLV direction
- `/tracking` — Bet tracking direction
- `/paper-trading` — Paper bankroll direction
- `/simulator` — Match simulation
- `/agent-v7` — Agent dashboard

## What you can use now

- Add manual picks in `/quick-use`
- Save a local bet slip in the browser
- Test stake, edge and confidence
- See OK / CAUTION / SKIP risk decisions
- Create a Supabase-backed Scorecaster account
- Validate the session server-side
- Sync the local bet slip to user-specific cloud history
- Retrieve and delete cloud bets through an authenticated API
- Prevent duplicate syncs with `(user_id, client_ref)` upserts
- Isolate users with Supabase Row Level Security
- Check production health
- Open Dashboard, Betting and Risk Control

## Auth and cloud setup

Follow:

```text
docs/AUTH_CLOUD_SETUP.md
```

Run these SQL files in order:

```text
supabase/scorecaster_schema.sql
supabase/scorecaster_auth_cloud.sql
```

## Environment

Copy `.env.example` to `.env.local` for local development.

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
ODDS_API_KEY=
OPENAI_API_KEY=
```

Legacy Supabase projects can use `NEXT_PUBLIC_SUPABASE_ANON_KEY` instead of the publishable key.

Never expose a Supabase service-role key to browser code. Never commit `.env.local` or secret values.

## Current production foundation

- `.github/workflows/ci.yml`
- `.nvmrc`
- `.env.example`
- `docs/PRODUCTION_MVP.md`
- `docs/PRODUCTION_RUNBOOK.md`
- `docs/CASTER_CORE_FOUNDATION.md`
- `docs/AUTH_CLOUD_SETUP.md`
- `lib/production-risk-rules.js`
- `lib/bet-slip-engine.js`
- `lib/caster-core-contract.js`
- `lib/supabase/client.js`
- `lib/supabase/server.js`
- `proxy.js`
- `supabase/scorecaster_schema.sql`
- `supabase/scorecaster_auth_cloud.sql`
- `/risk`
- `/quick-use`
- `/cloud-sync`
- `/profile`
- `/core-status`
- `/production-status`
- `/api/health`
- `/api/cloud/bets`

## Important

Scorecaster is an analysis and paper-tracking tool. It must not promise profit. The agent should be allowed to say SKIP.

Cloud sync keeps the local browser copy after upload until the user explicitly clears it. This reduces accidental data loss during the alpha phase.
