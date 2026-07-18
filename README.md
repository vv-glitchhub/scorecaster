# Scorecaster

AI-assisted sports market intelligence, no-vig odds consensus, adversarial decision support, governed model evaluation, team-attributed sports intelligence, verified watchlists, alert history, optional notification-device registration, risk control and virtual paper tracking.

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
- Provider Firewall keeps provider calls inside the server and protects manual access with authentication, origin validation and quotas

See `docs/SPORTS_INTELLIGENCE_V1.md` and `docs/PROVIDER_FIREWALL_V1.md`.

## Watchlist & Alerts V2

The authenticated watchlist tracks server-verified live selections without creating a paper stake.

- the client sends only an event ID, selection and supported sport
- the server resolves the selection again from current Top Picks before saving
- each user sees only their own rows through forced Supabase RLS
- stored odds and decision are compared with the current verified state
- alerts cover kickoff proximity, decision changes, meaningful price moves and a broken PLAY price floor
- missing current data is shown as unavailable; no replacement market is invented
- paused items remain stored but emit no alerts
- current refresh is user-triggered

See `docs/WATCHLIST_ALERTS_V2.md`.

## Alert Inbox V1

Alert Inbox V1 persists verified Watchlist changes as deduplicated user history.

- unique fingerprints prevent repeated refreshes from creating duplicate rows
- active alerts preserve read state
- disappeared conditions remain in history as resolved
- reappearing conditions become active and unread
- one or all unread alerts can be marked read
- web and native clients use the same authenticated inbox
- export and account deletion include inbox rows

See `docs/ALERT_INBOX_V1.md`.

## Notification Preferences & Device Registry V1

The notification registry adds user-controlled categories and explicit native device opt-in without claiming that background delivery is active.

- web and native clients edit the same notification categories
- Watchlist filters active Alert Inbox conditions before synchronization
- native token registration starts only after the user presses the enable button
- operating-system permission and a real EAS project ID are required
- PostgreSQL computes the token SHA-256 hash and assigns one token to one user
- API responses and account exports exclude raw tokens and token hashes
- the final device removal disables the push preference
- native sign-out attempts to unregister the current device first
- permanent account deletion removes devices and preferences
- the background delivery worker and receipt processing remain disabled

See `docs/NOTIFICATION_REGISTRY_V1.md`.

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
- trilingual verified alerts
- deduplicated unread, active and resolved inbox history
- user-selected severity and event-category filters

### Profile

- account and privacy controls
- in-app notification preferences
- registered-device count and delivery-disabled status
- account export and deletion

### Simulator

- seeded and reproducible Poisson simulation
- validated and bounded fixture input
- adjustable simulation count
- Monte Carlo sampling intervals
- system-row cost warning

## Security guardrails

- GitHub Actions runs secret scanning, API security, model, settlement, Agent, Sports Intelligence, Watchlist, Alert Inbox and notification-registry tests plus a production build.
- CodeQL analyzes JavaScript and TypeScript.
- Supabase Row Level Security isolates account, paper, watchlist, alert-inbox, notification-preference and device rows.
- Protected APIs validate authentication, origin, body size, ranges and record counts.
- Authenticated APIs use atomic per-user database quotas.
- PostgreSQL enforces paper stake, total exposure, league exposure, edge and confidence limits.
- Watchlist writes are independently resolved against server Top Picks rather than trusted from the client.
- Alert Inbox accepts only server-generated Watchlist alerts; clients cannot submit arbitrary alert content.
- Push tokens are claimed through a database function that computes the token hash itself.
- Notification APIs never select or return raw push tokens or token hashes.
- Server-only integration keys are not included in browser or mobile bundles.
- Automatic H2H paper-result checking is user-triggered, bounded and rate-limited.
- `/api/health` reports safe readiness without exposing secrets or claiming inactive delivery.

## Native mobile MVP

The `mobile/` directory contains the Expo iOS and Android application with:

- Supabase email authentication and native auth callbacks
- session persistence in Expo SecureStore
- HTTPS bearer-authenticated API calls
- NHL, NBA, EPL, La Liga, Liiga and SHL filters
- near-term Top Picks and Agent V11
- team-attributed Sports Intelligence status on Agent decisions
- separate verified Watchlist screen and native watch actions
- unread, active and resolved Alert Inbox controls
- optional notification preferences and physical-device token registration
- explicit permission request and fail-closed EAS project ID check
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
- `GET/PATCH /api/cloud/alerts`
- `GET/PUT/POST/DELETE /api/cloud/notifications`
- `POST /api/intelligence`
- `POST /api/agent/portfolio`
- `POST /api/agent/explain`
- `GET /api/account/export`
- `GET/DELETE /api/account`

The protected endpoints accept validated browser-cookie and mobile-bearer sessions. Watchlist, Alert Inbox, notification preferences and device registrations remain user-specific. `/api/intelligence` is not a public provider proxy.

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
supabase/scorecaster_alert_inbox.sql
supabase/scorecaster_notification_registry.sql
```

Public launch is blocked until the documented two-user isolation, paper-risk, quota, watchlist, Alert Inbox, notification-registry, export and deletion tests pass. Background push delivery remains a separate release gate.

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

`SUPABASE_SERVICE_ROLE_KEY`, `ODDS_API_KEY`, `AGENT_DECISION_SIGNING_KEY`, `OPENAI_API_KEY`, `NEWS_API_KEY`, `SPORTSDATA_API_KEY` and `LINEUP_API_KEY` are server-only. Never expose them to browser or mobile code. The EAS project ID is public project configuration, but it must be linked to the correct owned Expo project rather than invented.

## Important documentation

- `docs/MODEL_TRANSPARENCY.md`
- `docs/AGENT_V9_TRANSPARENCY.md`
- `docs/AGENT_V10_GROUNDED_EXPLANATIONS.md`
- `docs/AGENT_V11_MODEL_LAB.md`
- `docs/SPORTS_INTELLIGENCE_V1.md`
- `docs/PROVIDER_FIREWALL_V1.md`
- `docs/WATCHLIST_ALERTS_V2.md`
- `docs/ALERT_INBOX_V1.md`
- `docs/NOTIFICATION_REGISTRY_V1.md`
- `docs/AUTH_CLOUD_SETUP.md`
- `docs/MOBILE_SECURITY_RELEASE.md`

Scorecaster must not promise profit. The Agent must be allowed to say WATCH or SKIP. Optional language output, independent evidence and shadow learning never override the authoritative market probability without a separately reviewed model-promotion process.
