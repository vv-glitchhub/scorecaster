# Scorecaster

AI-assisted sports market intelligence, no-vig odds consensus, adversarial decision support, governed model evaluation, team-attributed sports intelligence, verified watchlists, a user-specific in-app Notification Center, risk control and virtual paper tracking.

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

## Sports Intelligence V1

Sports Intelligence V1 adds independent match context without allowing external context to rewrite the market-consensus probability.

- evidence must be fresh and attributed to the correct fixture team
- unmatched, stale and generic provider rows are discarded
- injury and lineup evidence is selection-relative
- source trust is assigned by server-owned rules
- conflicting availability reports fail closed
- intelligence may downgrade PLAY to CAUTION / WATCH
- intelligence cannot upgrade CAUTION or SKIP to PLAY
- consensus probability, edge and EV remain unchanged
- provider calls are skipped when no provider is configured
- match intelligence is cached for five minutes
- Top Picks enriches at most 12 prefiltered selections per request
- provider failures produce unavailable evidence rather than invented replacement data

See `docs/SPORTS_INTELLIGENCE_V1.md`.

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
- current V2 refresh is user-triggered

See `docs/WATCHLIST_ALERTS_V2.md`.

## Notification Center V1

Notification Center persists a user-specific inbox from structured Watchlist alerts.

- notification candidates are built only on the server from current Watchlist comparisons
- the client cannot upload a custom notification title or message
- deterministic state buckets prevent duplicate rows for the same ongoing condition
- new material price buckets or decision states can create a new inbox item
- users can set minimum severity and category preferences
- users can mark individual or all notifications read and dismiss items from the inbox
- forced RLS isolates notification rows and settings by authenticated user
- account export and deletion include notification history and preferences
- web and native views localize structured events to Finnish, English or Spanish
- V1 does not register push tokens, request operating-system permission or claim background delivery
- synchronization is user-triggered and rate-limited

See `docs/NOTIFICATION_CENTER_V1.md`.

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
- Sports Intelligence V1 team-attributed evidence audit
- verified evidence, missing evidence and counterargument
- heuristic probability stress range and downside EV
- price guard and conservative paper stake
- portfolio, league, drift and evidence-conflict controls

### Watchlist

- verified current selections only
- added versus current price and decision
- configurable move and kickoff thresholds
- pause and remove controls
- trilingual verified current alerts

### Notification Center

- persisted user-specific structured inbox
- manual synchronization from verified Watchlist changes
- read, unread and dismissal controls
- severity and category preferences
- no push or device-token claim in V1

### Simulator

- seeded and reproducible Poisson simulation
- validated and bounded fixture input
- adjustable simulation count
- Monte Carlo sampling intervals
- system-row cost warning

## Security guardrails

- GitHub Actions runs secret scanning, API security, model, settlement, workspace, Agent, Sports Intelligence, Watchlist and Notification Center tests plus a production build.
- CodeQL analyzes JavaScript and TypeScript.
- Supabase Row Level Security isolates account, paper, watchlist, notification and notification-setting rows.
- Protected APIs validate authentication, origin, body size, ranges and record counts.
- Authenticated APIs use atomic per-user database quotas.
- PostgreSQL enforces paper stake, total exposure, league exposure, edge and confidence limits.
- Watchlist writes are independently resolved against server Top Picks rather than trusted from the client.
- Notification clients cannot create free-text alerts; structured rows are generated by the server from verified alert objects.
- Server-only integration keys are not included in browser or mobile bundles.
- The News provider key is sent in a request header rather than a URL.
- Automatic H2H paper-result checking is user-triggered, bounded and rate-limited.
- `/api/health` reports safe model and integration readiness without exposing secrets.

## Native mobile MVP

The `mobile/` directory contains the Expo iOS and Android application with:

- Supabase email authentication and native email-confirmation deep linking
- session persistence in Expo SecureStore
- HTTPS bearer-authenticated API calls
- NHL, NBA, EPL, La Liga, Liiga and SHL filters
- near-term Top Picks and Agent V11
- team-attributed Sports Intelligence status on Agent decisions
- combined native Watchlist and Notification Center view
- notification read, dismissal, enable/disable and severity controls
- virtual bankroll and personal paper-risk limits
- paper-bet saving and result tracking
- automatic supported H2H result checking
- ROI, CLV, calibration, Brier score, drawdown and league analytics
- JSON data export and in-app account deletion
- Finnish, English and Spanish
- EAS preview and production profiles plus CI-enforced release audit

Mobile setup:

```bash
cd mobile
cp .env.example .env
npm install
npm run release:check
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
/notifications
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
- `GET/POST/PUT/PATCH/DELETE /api/cloud/notifications`
- `POST /api/agent/portfolio`
- `POST /api/agent/explain`
- `GET /api/account/export`
- `GET/DELETE /api/account`

The protected endpoints accept validated browser-cookie and mobile-bearer sessions. Paper, Watchlist, Notification Center and settings records remain user-specific.

## Public analysis APIs

- `GET /api/odds?sport=<known-key>&markets=h2h`
- `GET /api/top-picks`
- `GET /api/top-picks?sports=<comma-separated-known-keys>`
- `POST /api/intelligence` for bounded same-origin or server-side match evidence loading

Unknown query parameters, unsupported sports and unsupported markets are rejected before an upstream request is made.

## Supabase activation

Run these SQL files in order:

```text
supabase/scorecaster_schema.sql
supabase/scorecaster_auth_cloud.sql
supabase/scorecaster_paper_risk_limits.sql
supabase/scorecaster_api_rate_limits.sql
supabase/scorecaster_watchlist_alerts.sql
supabase/scorecaster_notification_center.sql
```

Public launch is blocked until the documented two-user isolation, paper-risk, quota, Watchlist, Notification Center, export and deletion tests pass.

## Environment

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ODDS_API_KEY=
AGENT_DECISION_SIGNING_KEY=
OPENAI_API_KEY=
OPENAI_AGENT_MODEL=
NEWS_API_KEY=
SPORTSDATA_API_KEY=
SPORTSDATA_BASE_URL=
LINEUP_API_URL=
LINEUP_API_KEY=
```

`SUPABASE_SERVICE_ROLE_KEY`, `ODDS_API_KEY`, `AGENT_DECISION_SIGNING_KEY`, `OPENAI_API_KEY`, `NEWS_API_KEY`, `SPORTSDATA_API_KEY` and `LINEUP_API_KEY` are server-only. Never expose them to browser or mobile code.

## Important documentation

- `docs/MODEL_TRANSPARENCY.md`
- `docs/AGENT_V9_TRANSPARENCY.md`
- `docs/AGENT_V10_GROUNDED_EXPLANATIONS.md`
- `docs/AGENT_V11_MODEL_LAB.md`
- `docs/SPORTS_INTELLIGENCE_V1.md`
- `docs/WATCHLIST_ALERTS_V2.md`
- `docs/NOTIFICATION_CENTER_V1.md`
- `docs/AUTH_CLOUD_SETUP.md`
- `docs/MOBILE_SECURITY_RELEASE.md`
- `docs/MOBILE_RELEASE_READINESS_V1.md`

Scorecaster must not promise profit. The Agent must be allowed to say WATCH or SKIP. Optional language output, independent evidence and shadow learning never override the authoritative market probability without a separately reviewed model-promotion process.
