# Scorecaster

AI-assisted sports market intelligence, no-vig odds consensus, adversarial decision support, risk control, account-based cloud history and virtual paper tracking.

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
- learns only after a sufficient CLV or probability sample
- measures ROI, CLV, calibration and Brier score
- never lets learning change probability, edge or EV

The stress range is a conservative heuristic, not a formal confidence interval.

See `docs/AGENT_V9_TRANSPARENCY.md`.

## Agent V10 grounded explanations

Agent V10 adds an optional language layer after the V9 decision has already been locked.

- The language model cannot change PLAY / WATCH / SKIP.
- It cannot change probability, edge, EV, price limits, stake or portfolio allocation.
- Only a bounded non-personal decision contract is sent from the server.
- Provider use requires authentication and a per-user quota.
- The request uses strict JSON Schema and provider response storage disabled.
- No web search, file search, functions or other tools are available.
- Free text may not introduce digits or unsupported external facts.
- Evidence, counterarguments and verification steps are selected by indexes and rendered from immutable source arrays by the server.
- Invalid output becomes a deterministic Scorecaster explanation.
- The browser caches completed explanations temporarily to reduce repeated provider calls.

See `docs/AGENT_V10_GROUNDED_EXPLANATIONS.md`.

## Web workspaces

### Betting

- shared no-vig consensus instead of a fixed model probability
- fair odds, edge, EV, data confidence and freshness
- PLAY / CAUTION / SKIP
- personal virtual stake cap
- local line movement labelled as a price signal, not outcome proof

### Agent

- Agent V9 adversarial portfolio engine
- Agent V10 optional grounded explanation
- verified evidence, missing evidence and counterargument
- heuristic probability stress range and downside EV
- price guard and conservative paper stake
- portfolio and league exposure control
- learning from ROI, CLV, calibration and Brier score without changing probability

### Simulator

- seeded and reproducible Poisson simulation
- validated and bounded fixture input
- adjustable simulation count
- Monte Carlo sampling intervals
- system-row cost warning

## Security guardrails

- GitHub Actions runs secret scanning, API security, model, settlement, workspace, Agent V9 and Agent V10 tests plus a production build.
- CodeQL analyzes JavaScript and TypeScript.
- Supabase Row Level Security isolates account rows.
- Protected APIs validate authentication, origin, body size, ranges and record counts.
- Authenticated APIs use atomic per-user database quotas.
- PostgreSQL enforces paper stake, total exposure, league exposure, edge and confidence limits.
- Server-only integration keys are not included in browser or mobile bundles.
- Automatic H2H paper-result checking is user-triggered, bounded and rate-limited.
- `/api/health` reports safe model and integration readiness without exposing secrets.

## Native mobile MVP

The `mobile/` directory contains the Expo iOS and Android application with:

- Supabase email authentication
- session persistence in Expo SecureStore
- HTTPS bearer-authenticated API calls
- NHL, NBA, EPL, La Liga, Liiga and SHL filters
- daily Top 3 and wider consensus list
- virtual bankroll and personal paper-risk limits
- paper-bet saving and result tracking
- automatic supported H2H result checking
- ROI, CLV, calibration, Brier score, drawdown and league analytics
- JSON data export and in-app account deletion
- privacy, terms, responsible-use and security links
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
- `POST /api/agent/explain`
- `GET /api/account/export`
- `GET/DELETE /api/account`

The Agent explanation endpoint accepts validated browser-cookie and mobile-bearer sessions. Unauthenticated requests receive only the deterministic fallback and never consume the optional language-model provider.

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
```

Public launch is blocked until the documented two-user isolation, paper-risk, quota, export and deletion tests pass.

## Environment

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ODDS_API_KEY=
OPENAI_API_KEY=
OPENAI_AGENT_MODEL=
```

`SUPABASE_SERVICE_ROLE_KEY`, `ODDS_API_KEY` and `OPENAI_API_KEY` are server-only. Never expose them to browser or mobile code.

## Important documentation

- `docs/MODEL_TRANSPARENCY.md`
- `docs/AGENT_V9_TRANSPARENCY.md`
- `docs/AGENT_V10_GROUNDED_EXPLANATIONS.md`
- `docs/AUTH_CLOUD_SETUP.md`
- `docs/MOBILE_SECURITY_RELEASE.md`

Scorecaster must not promise profit. The Agent must be allowed to say WATCH or SKIP. The deterministic decision object remains authoritative even when an optional language-model explanation is displayed.
