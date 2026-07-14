# Scorecaster

AI-powered sports intelligence, odds analysis, risk control and paper-tracking workspace.

## Production status

Scorecaster now has three deployment guardrails:

- GitHub Actions runs `npm run build` for pull requests and `main` pushes.
- `/api/health` reports safe runtime and integration readiness.
- `/production-status` displays the health response in the app.

Runtime is pinned to Node.js 20 through `.nvmrc`.

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
https://scorecaster.vercel.app/production-status
https://scorecaster.vercel.app/core-status
https://scorecaster.vercel.app/api/health
```

## Main pages

- `/quick-use` — manual local bet slip and risk test
- `/production-status` — deployment and integration status
- `/core-status` — shared Caster Core state
- `/api/health` — JSON health endpoint
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
- Check production health
- Open the dashboard and Betting workspace
- Open Risk Control
- Review the Supabase schema draft

## Environment

Live odds require:

```text
ODDS_API_KEY=
```

Future AI and cloud integrations:

```text
OPENAI_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Never commit `.env.local` or secret values.

## Current production foundation

- `.github/workflows/ci.yml`
- `.nvmrc`
- `docs/PRODUCTION_MVP.md`
- `docs/PRODUCTION_RUNBOOK.md`
- `docs/CASTER_CORE_FOUNDATION.md`
- `lib/production-risk-rules.js`
- `lib/bet-slip-engine.js`
- `lib/caster-core-contract.js`
- `supabase/scorecaster_schema.sql`
- `/risk`
- `/quick-use`
- `/core-status`
- `/production-status`
- `/api/health`

## Important

Scorecaster is an analysis and paper-tracking tool. It must not promise profit. The agent should be allowed to say SKIP.
