# Scorecaster

AI-assisted sports market intelligence, no-vig odds consensus, adversarial decision support, governed model evaluation, verified watchlists, risk control and virtual paper tracking.

## Product boundary

Scorecaster is analysis, simulation and paper tracking only.

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
- accepts only verified live-provider fixtures inside bounded near-term windows
- never adds the prototype's old fixed probability boost

Edge means best-price value versus market consensus. It is not proof that the selected team will win.

See `docs/MODEL_TRANSPARENCY.md`.

## Agent V9 deterministic core

The Agent V9 engine:

- keeps the no-vig consensus probability immutable
- builds a heuristic stress range from coverage, dispersion and confidence
- calculates base, downside and upside expected value
- blocks PLAY when downside EV is not positive
- shows break-even odds and the minimum price required for target EV
- generates a structured counterargument and lists missing evidence
- sizes paper stakes with quarter Kelly at the stress-range lower probability
- enforces single-pick, total-portfolio and league exposure caps
- allows only one PLAY selection per event
- never lets its original learning signal change probability, edge or EV

The stress range is a conservative heuristic, not a formal confidence interval.

See `docs/AGENT_V9_TRANSPARENCY.md`.

## Agent V10 grounded explanations

Agent V10 adds an optional language layer after the deterministic decision has already been locked.

- The language model cannot change PLAY / WATCH / SKIP.
- It cannot change probability, edge, EV, price limits, stake or portfolio allocation.
- Only a bounded non-personal decision contract is sent from the server.
- Provider use requires authentication, a signed short-lived decision ticket and a per-user quota.
- The request uses strict structured output and provider response storage disabled.
- No external tools are available to the explanation request.
- Free text may not introduce unsupported numbers or external facts.
- Invalid output becomes a deterministic Scorecaster explanation.

See `docs/AGENT_V10_GROUNDED_EXPLANATIONS.md`.

## Agent V11 Model Lab

Agent V11 evaluates challenger probability calibrators without silently replacing the production model.

- requires at least 120 eligible settled probability observations
- sorts observations chronologically
- trains only on the older period
- keeps the newest 30 percent as an untouched holdout
- compares champion and challenger with Brier score, log loss and calibration
- keeps challengers in shadow mode until a separate reviewed promotion process exists
- detects drift between recent and reference windows
- converts new PLAY paper decisions to WATCH with zero allocation under critical drift
- exposes that learning has not changed the production probability

See `docs/AGENT_V11_MODEL_LAB.md`.

## Watchlist & Alerts V2

The authenticated watchlist tracks server-verified live selections without creating a paper stake.

- the client sends only an event ID, selection and supported sport
- the server resolves the selection again from current Top Picks before saving
- each user sees only their own rows through forced Supabase RLS
- stored odds and decision are compared with the current verified state
- alerts cover kickoff proximity, decision changes, meaningful price moves and a broken PLAY price floor
- missing current data is shown as unavailable; no replacement market is invented
- paused items remain stored but emit no alerts
- legacy `/alerts` now routes to the verified watchlist
- current V2 refresh is user-triggered; background push delivery is not claimed yet

See `docs/WATCHLIST_ALERTS_V2.md`.

## Web workspaces

### Betting

- shared no-vig consensus instead of a fixed model probability
- fair odds, edge, EV, data confidence and freshness
- PLAY / CAUTION / SKIP
- personal virtual stake cap
- bounded near-term live fixtures only

### Agent

- Agent V9 adversarial portfolio engine
- Agent V10 optional grounded explanation
- Agent V11 chronological champion–challenger Model Lab
- verified evidence, missing evidence and counterargument
- heuristic probability stress range and downside EV
- price guard and conservative paper stake
- portfolio, league and drift controls

### Watchlist

- verified current selections only
- added versus current price and decision
- configurable move and kickoff thresholds
- pause and remove controls
- trilingual verified alerts

### Simulator

- seeded and reproducible Poisson simulation
- validated and bounded fixture input
- adjustable simulation count
- Monte Carlo sampling intervals
- system-row cost warning

## Security guardrails

- GitHub Actions runs secret scanning, API security, model, settlement, workspace, Agent and Watchlist tests plus a production build.
- CodeQL analyzes JavaScript and TypeScript.
- Supabase Row Level Security isolates account, paper and watchlist rows.
- Protected APIs validate authentication, origin, body size, ranges and record counts.
- Authenticated APIs use atomic per-user database quotas.
- PostgreSQL enforces paper stake, total exposure, league exposure, edge and confidence limits.
- Watchlist writes are independently resolved against server Top Picks rather than trusted from the client.
- Server-only integration keys are not included in browser or mobile bundles.
- Automatic H2H paper-result checking is user-triggered, bounded and rate-limited.
- `/api/health` reports safe model and integration readiness without exposing secrets.

## Native mobile MVP

The `mobile/` directory contains the Expo iOS and Android application with:

- Supabase email authentication
- session persistence in Expo SecureStore
- HTTPS bearer-authenticated API calls
- NHL, NBA, EPL, La Liga, Liiga and SHL filters
- near-term Top Picks and Agent V11
- separate verified Watchlist screen and native watch actions
- virtual bankroll and personal paper-risk limits
- paper-bet saving and result tracking
- automatic supported H2H result checking
- ROI, CLV, calibration, Brier score, drawdown and league analytics
- JSON data export and in-app account deletion
- Finnish, English and Spanish
- EAS preview and production profiles

Mobile setup:

```bash
cd mobile
cp .env.example .env
npm install
npx expo install --check
npm run typecheck
npm run start
```

## Start web locally

```bash
npm install --no-audit --no-fund
npm run security:check
npm test
npm run build
npm run dev
```

Main routes:

```text
/quick-use
/betting
/agent
/watchlist
/tracking
/analytics
/simulator
/intelligence
/login
/profile
/cloud-sync
/privacy
/terms
/responsible-use
/security
/production-status
/api/health
```

## Protected APIs

- `GET/POST/PATCH/DELETE /api/cloud/bets`
- `POST /api/cloud/bets/settle`
- `GET/PUT /api/cloud/bankroll`
- `GET/POST/PATCH/DELETE /api/cloud/watchlist`
- `POST /api/agent/portfolio`
- `POST /api/agent/explain`
- `GET /api/account/export`
- `GET/DELETE /api/account`

The protected endpoints accept validated browser-cookie and mobile-bearer sessions. Watchlist records and current comparisons remain user-specific.

## Public analysis APIs

- `GET /api/odds?sport=<known-key>&markets=h2h`
- `GET /api/top-picks`
- `GET /api/top-picks?sports=<comma-separated-known-keys>`

Unknown query parameters, unsupported sports and unsupported markets are rejected before an upstream request is made.

## Supabase activation

Run these SQL files in order:

```text
supabase/scorecaster_schema.sql
supabase/scorecaster_auth_cloud.sql
supabase/scorecaster_paper_risk_limits.sql
supabase/scorecaster_api_rate_limits.sql
supabase/scorecaster_watchlist_alerts.sql
```

Public launch is blocked until the documented two-user isolation, paper-risk, quota, watchlist, export and deletion tests pass.

## Environment

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ODDS_API_KEY=
AGENT_DECISION_SIGNING_KEY=
OPENAI_API_KEY=
OPENAI_AGENT_MODEL=
```

`SUPABASE_SERVICE_ROLE_KEY`, `ODDS_API_KEY`, `AGENT_DECISION_SIGNING_KEY` and `OPENAI_API_KEY` are server-only. Never expose them to browser or mobile code.

## Important documentation

- `docs/MODEL_TRANSPARENCY.md`
- `docs/AGENT_V9_TRANSPARENCY.md`
- `docs/AGENT_V10_GROUNDED_EXPLANATIONS.md`
- `docs/AGENT_V11_MODEL_LAB.md`
- `docs/WATCHLIST_ALERTS_V2.md`
- `docs/AUTH_CLOUD_SETUP.md`
- `docs/MOBILE_SECURITY_RELEASE.md`

Scorecaster must not promise profit. The Agent must be allowed to say WATCH or SKIP. Optional language output and shadow learning never override the authoritative deterministic decision without a separately reviewed model-promotion process.
