# Scorecaster AI Coach V1

AI Coach is an authenticated, paper-only process review tool. It uses only the signed-in user's own paper decisions, chronology-safe calibration observations, verified pre-start closing evidence and explicit decision-audit rows.

It does not place bets, access bookmaker accounts, change model probabilities, promote models, change automatic decisions or increase stakes. It never recommends chasing losses or promises profit.

## Evidence inputs

- `calibration_observations_v1`: settled paper decisions, verified closing consensus, CLV, Brier score, log loss, stake, profit and timestamps
- `market_provider_snapshots_v2`: provider prices captured at or before the paper-entry timestamp
- `autonomous_agent_decision_audit`: explicit allowed/skipped decisions and documented safety reasons
- `ai_coach_preferences_v1`: enablement, quiet period, bounded notification frequency and minimum sample

All reads are filtered by the authenticated `user_id`. Raw provider payloads, API keys and other users' records are not returned.

## Findings

The deterministic engine can surface:

- positive, neutral or negative verified price CLV
- weaker prices for entries made inside 30 minutes of kickoff
- a better provider price that was already captured and fresh at entry time
- repeated same-event correlated paper exposure
- losing outcomes that still beat the verified closing line
- disciplined SKIP decisions supported by quality, coverage, price or risk gates

Every finding includes its numerator, denominator, sample state and supporting evidence identifiers in audit mode. Low-sample findings are labelled `insufficient` or `provisional`, not presented as facts.

## Core formulas

```text
paper yield = sum(paper profit) / sum(paper stake)
price CLV = entry decimal odds × closing no-vig probability − 1
provider missed value = best available decimal odds / selected entry odds − 1
maximum drawdown = maximum running paper-equity peak minus a later paper-equity value
```

Brier score and log loss come from the chronology-safe Calibration Lab. The Coach does not create a replacement closing line and does not accept a manually entered or simulated line as trusted evidence.

## Preferences and notification boundary

Users can:

- disable AI Coach
- disable coaching notifications independently
- configure quiet-period start and end
- set at most 0–7 coaching notifications per week
- set the strong-finding minimum sample between 10 and 500

V1 stores the preferences and report evidence. Notification delivery remains bounded and must respect these settings before a later notification worker is activated.

## API and UI

- UI: `/coach`
- authenticated report: `GET /api/ai-coach?days=365`
- authenticated audit report: `GET /api/ai-coach?days=365&includeAudit=1`
- preferences: `PATCH /api/ai-coach`
- redacted health: `GET /api/ai-coach/health`
- profile entry point: `/profile`

## Production activation

Run in Supabase SQL Editor:

```text
scripts/apply-ai-coach-v1.sql
```

Then run the read-only verification:

```text
scripts/verify-ai-coach-v1.sql
```

AI Coach also requires the Market Microstructure and Calibration Lab patches because its trusted evidence is built from those tables.

## Two-user RLS proof

Cloud activation is not complete until two distinct authenticated test users prove isolation:

```bash
NEXT_PUBLIC_SUPABASE_URL=... \
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=... \
AI_COACH_USER_A_TOKEN=... \
AI_COACH_USER_B_TOKEN=... \
node scripts/prove-ai-coach-two-user-isolation.mjs
```

The proof checks that:

- each user sees only their own preference row
- cross-user updates affect zero rows
- report reads contain only the current user's rows
- authenticated clients cannot insert generated Coach reports

Do not commit test-user tokens. The output JSON is the production evidence artifact; tokens must be removed immediately after the proof.

## Account privacy

The normal account export includes AI Coach preferences and the user's generated reports. Account deletion removes report rows first and preferences second before deleting the authentication account. Foreign keys also use `ON DELETE CASCADE` as a final safeguard.

## Safety language

Allowed coaching focuses on process, data quality, price comparison, sample size, exposure grouping and disciplined non-action. Disallowed patterns include:

- chasing or recovering losses
- doubling or increasing stakes after a loss
- guaranteed-profit language
- instructions to deposit or move money
- real-money bet placement
- coaching statements without supporting rows and a denominator
