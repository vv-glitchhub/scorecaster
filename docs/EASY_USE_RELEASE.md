# Scorecaster Easy Use release

## Goal

Make Scorecaster understandable without prior betting, AI or statistics knowledge while preserving the paper-only and security boundaries.

## Canonical user flow

1. Set virtual paper-risk limits.
2. Browse market analysis or open Agent V10.
3. Read the decision, counterargument and missing evidence.
4. Save only a virtual paper pick.
5. Settle and evaluate the paper result over a meaningful sample.

## Web changes

- Six primary tasks: Home, Picks, AI analysis, Tracking, Analytics and Simulator.
- Advanced tools, account actions and status pages moved into a secondary menu.
- Mobile web gets a fixed five-item task bar.
- Contextual three-step guidance appears on core pages.
- Home page uses the current Top Picks endpoint and Agent V10 vocabulary.
- Obsolete `/agent-v7` redirects to `/agent`.
- `/simulator` now renders the validated seeded simulator instead of the legacy static demo.
- Betting keeps sport, league and market in the primary flow; Kelly, bankroll and refresh options are collapsed as advanced settings.
- Tracking uses Finnish labels, four primary metrics, collapsible advanced metrics and confirmation for destructive actions.
- New `/help` page explains PLAY, WATCH, SKIP, edge, EV, CLV, confidence, Brier score and paper stakes.
- User zoom is no longer disabled.

## Native changes

- Finnish app-shell labels and paper-mode wording.
- Home screen starts with a three-step guide.
- Advanced risk fields are collapsed by default.
- Current bankroll, exposure, result and top pick remain visible without opening settings.

## Regression gates

`scripts/easy-use-ui.test.mjs` protects:

- the small canonical navigation
- the three-step home workflow
- current Top Picks usage
- the Agent legacy redirect
- the plain-language help page
- the canonical validated simulator
- collapsed betting and native risk settings
- Finnish tracking labels and destructive-action confirmation
- accessible viewport zoom

## External release blockers

Code cannot complete these account-owner actions:

- run the Supabase migrations in the production project
- configure production Supabase, Odds API, OpenAI and Agent signing secrets
- perform the documented two-user RLS, quota, paper-risk and settlement tests
- link Expo EAS
- produce signed iOS and Android builds
- complete TestFlight and Google Play internal testing
- provide final legal controller and support contact details
- complete external security review

Public store release remains blocked until those items are completed and verified on real devices.
