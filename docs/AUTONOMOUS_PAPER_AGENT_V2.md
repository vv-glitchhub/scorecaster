# Scorecaster Autonomous Paper Agent V2

## Purpose

Autonomous Paper Agent V2 is a production-oriented, paper-only decision worker. It can fetch verified Top Picks, apply portfolio and model-governance logic, choose bounded PLAY decisions, store virtual bets, and produce a complete audit trail for settlement, CLV analysis, calibration and shadow-model research.

The worker cannot place real-money bets. It contains no bookmaker login, payment, deposit, withdrawal or bet-placement integration.

## What V2 improves

### True daily limits

V1 limited selections inside one worker cycle. V2 loads the user's autonomous bets from the current UTC day and enforces `daily_pick_limit` across every scheduled and manual run. A settled selection still counts against that day's limit.

V2 also rejects another selection from an event already used during the same day, even when the earlier paper bet has already settled.

### System-level hard risk caps

User settings are always reduced to the following maximums before portfolio construction or persistence:

- 1.0% of virtual bankroll per PLAY
- 5.0% new daily/open exposure
- 2.5% exposure in one league
- at most three autonomous paper selections per user and UTC day

Recommended initial setting is 0.5–0.75% per PLAY with a 1,000 euro virtual bankroll.

### Autonomous circuit breaker

The risk governor reads settled paper history and the shadow model-lab report. It has three modes:

- `active`: normal bounded paper operation
- `caution`: stake is reduced by 50% and the required priority score is raised
- `paused`: no new exposure is allowed

A hard pause can be triggered by critical model drift, a six-loss streak, severe recent ROI deterioration, materially negative recent CLV, or a large calibration gap. Caution mode reacts earlier to weaker versions of those signals.

The governor does not change historical results, model probabilities or real-money state. It only lowers or blocks new paper exposure.

### Full decision ticket

Every stored V2 paper bet includes a bounded `raw_pick.decisionTicket` containing:

- used provider and market sources
- unused or missing evidence
- verified evidence and counterarguments
- blockers
- lineup, injury, news, rest, travel and weather signal availability
- data-quality and price-guard state
- learning segment and shadow-model status
- the risk-governor mode and reasons

This supports later settlement, CLV, provider-quality, calibration and challenger-model analysis without allowing the shadow learner to alter production probabilities automatically.

## Safe activation

Apply the existing migrations first:

1. `supabase/scorecaster_auth_cloud.sql`
2. `supabase/scorecaster_paper_risk_limits.sql`
3. `supabase/scorecaster_autonomous_agent.sql`
4. unified sports-data migrations listed in the release-readiness manifest

Configure the production environment:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ODDS_API_KEY`
- `CRON_SECRET` with at least 16 characters
- `SCORECASTER_AUTONOMOUS_AGENT_ENABLED=true`

Configure the GitHub Actions repository values used by `.github/workflows/notification-delivery.yml`:

- secret `SCORECASTER_NOTIFICATION_DELIVERY_URL`
- secret `SCORECASTER_CRON_SECRET`
- variable `SCORECASTER_AUTONOMOUS_AGENT_ENABLED=true`
- variable `SCORECASTER_SETTLEMENT_MONITOR_ENABLED=true`

For complete learning data, also enable Unified Data Capture and the settlement monitor so closing odds, CLV and final outcomes continue to arrive.

## Promotion policy

The self-learning model remains shadow-only. A challenger may be marked promotion-ready only after the chronological holdout gates pass, but V2 never promotes it automatically. A model change should require a separate reviewed version, unchanged test data, acceptable league-level risk, improved Brier/log-loss or calibration, and no active drift freeze.

## Production validation

Run:

```bash
npm run test:autonomous-agent
npm run test:settlement
npm run test:settlement-monitor
npm run test:unified-data
npm run build
```

Then verify an authenticated test user with a virtual bankroll and enabled autonomous settings. Confirm that repeated worker calls during one UTC day never exceed the configured daily selection count or V2 hard exposure caps.
