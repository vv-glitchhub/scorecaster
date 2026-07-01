# Scorecaster

AI-powered sports intelligence, odds analysis, risk control and paper-tracking workspace.

## Start using

Run locally:

```bash
npm install
npm run dev
```

Then open:

```text
http://localhost:3000/quick-use
```

## Main pages

- `/quick-use` — manual local bet slip and risk test
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
- Save local bet slip in the browser
- Test stake, edge and confidence
- See OK / CAUTION / SKIP risk decision
- Open dashboard
- Open Betting workspace
- Open Risk Control
- Review Supabase schema draft

## Environment

For live odds and AI features, add API keys later in Vercel or `.env.local`.

Example future variables:

```text
ODDS_API_KEY=
OPENAI_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Current production foundation

- `docs/PRODUCTION_MVP.md`
- `lib/production-risk-rules.js`
- `lib/bet-slip-engine.js`
- `supabase/scorecaster_schema.sql`
- `/risk`
- `/quick-use`

## Important

Scorecaster is an analysis and paper-tracking tool. It must not promise profit. The agent should be allowed to say SKIP.
