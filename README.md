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

## Agent V9

The Agent workspace is an adversarial and portfolio-aware decision layer. It:

- keeps the no-vig consensus probability immutable
- builds a heuristic stress range from coverage, dispersion and confidence
- calculates base, downside and upside expected value
- blocks PLAY when downside EV is not positive
- shows break-even odds and the minimum price required for a 3% target EV
- generates a structured counterargument and lists missing evidence
- sizes paper stakes with quarter Kelly at the stress-range lower probability
- enforces single-pick, total-portfolio and league exposure caps
- allows only one PLAY selection per event
- uses paper history only after a sufficient CLV or probability sample
- measures ROI, CLV, calibration and Brier score
- never lets learning or narrative text change probability, edge or EV

The stress range is a conservative heuristic, not a formal 95% confidence interval. The deterministic decision object remains the source of truth even if a language-model explanation is added later.

See `docs/AGENT_V9_TRANSPARENCY.md`.

## Production and security status

Scorecaster has deployment and security guardrails:

- GitHub Actions runs secret scanning, API security tests, model tests, settlement tests, app tests, Agent V9 tests and `npm run build`.
- CodeQL analyzes JavaScript and TypeScript.
- `/api/health` reports safe runtime, model, Agent and integration readiness.
- `/production-status` displays the health response in the app.
- Node.js is pinned through `.nvmrc`.
- Supabase sessions are refreshed through the Next.js root `proxy.js`.
- Mutating account APIs validate authentication, origin, body type, body size, ranges and record counts.
- Database Row Level Security isolates user rows.
- The protected API checks personal stake, minimum edge and minimum confidence limits.
- PostgreSQL enforces single stake, total open exposure, single-league exposure and Scorecaster quality thresholds.
- Authenticated APIs use atomic per-user PostgreSQL quotas and return HTTP 429 with `Retry-After`.
- Automatic H2H paper result checks are user-triggered, rate-limited and bounded.
- The public odds proxy accepts only known sports and markets, normalizes requests, times out upstream calls and caches responses.
- Top Picks supports a bounded league filter, publishes a cached Top 3 and always marks results as paper-only.
- HTTP security headers block framing, MIME sniffing and unnecessary device permissions.

## Web workspaces

### Betting

- shared no-vig consensus instead of a fixed model probability
- fair odds, edge, EV, data confidence and freshness
- PLAY / CAUTION / SKIP
- personal virtual stake cap
- local line-movement history labelled as a price signal, not outcome proof

### Agent

- Agent V9 adversarial audit trail
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

See `mobile/README.md`, `docs/MODEL_TRANSPARENCY.md`, `docs/AGENT_V9_TRANSPARENCY.md` and `docs/MOBILE_SECURITY_RELEASE.md`.

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
https://scorecaster.vercel.app/betting
https://scorecaster.vercel.app/agent
https://scorecaster.vercel.app/simulator
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
- `scripts/excellence-apps.test.mjs`
- `scripts/agent-v9.test.mjs`
- `mobile/`
- `docs/MODEL_TRANSPARENCY.md`
- `docs/AGENT_V9_TRANSPARENCY.md`
- `docs/AUTH_CLOUD_SETUP.md`
- `docs/MOBILE_SECURITY_RELEASE.md`
- `lib/market-consensus-engine.mjs`
- `lib/agent-v9-engine.mjs`
- `lib/agent-learning.js`
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

## Important

Scorecaster must not promise profit. The Agent must be allowed to say WATCH or SKIP. A future language model may summarize deterministic evidence but cannot change probability, edge, EV, stake or the final decision.