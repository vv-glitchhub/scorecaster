# Scorecaster Roadmap

_Last updated: 2026-07-24_

## Product direction

Scorecaster is a governed, paper-only sports decision-intelligence product. The near-term goal is not another autonomous-agent version. The goal is to prove that the already-built system is safe, observable, useful and repeatable in production.

Permanent product boundaries:

- no deposits, withdrawals or payment data
- no bookmaker credentials or account connections
- no automatic real-money execution
- no guaranteed-profit claims
- no automatic learned-model promotion
- no cached odds, picks or model decisions presented as current live data

## Current state

The repository already contains a broad production-oriented foundation:

- installable FI / EN / ES web PWA with an honest offline safety mode
- Expo iOS and Android application foundation
- no-vig market consensus and PLAY / CAUTION / SKIP decision flow
- Agent V9 adversarial portfolio controls
- Agent V10 bounded grounded explanations
- Agent V11 chronology-safe champion/challenger Model Lab
- Autonomous Scorecaster V13 with V12 Mission Control, database hard caps, cooldowns, emergency stop and immutable decision audits
- governed Shadow Learning with append-only settlement outcomes
- Supabase RLS, per-user quotas and database-enforced paper-risk controls
- watchlists, alert history, notification delivery, settlement monitoring and operations views
- Unified Sports Data, provider health, diagnostics history and closing-line capture
- release-readiness, production-activation, security, model, mobile and integration tests

The main delivery risk is now activation and evidence, not missing feature breadth.

## Priority order

### P0 — Production proof and safety activation

Related issues: [#73](https://github.com/vv-glitchhub/scorecaster/issues/73), [#9](https://github.com/vv-glitchhub/scorecaster/issues/9)

Work:

1. Apply all 17 reviewed Supabase migrations in the exact order declared in `config/release-readiness.json`.
2. Configure server-only production secrets and verify that none are exposed to web or mobile bundles.
3. Run the release audit, production activation checks and protected worker probes.
4. Prove two-user RLS isolation for every account, paper, watchlist, alert, autonomous and Shadow Learning table.
5. Verify V13 database hard caps: 1% per autonomous PLAY, 5% UTC daily/open exposure, 2.5% UTC league exposure, daily pick cap and same-event deduplication.
6. Verify V12 freeze, V13 cooldown and web/mobile emergency-stop behavior with controlled paper accounts.
7. Verify settlement, diagnostics, unified-data, autonomous and Shadow Learning workers with production-safe evidence.
8. Document rollback steps, feature flags and the exact evidence required before enabling Shadow Learning cycles.

Exit criteria:

- zero known cross-user data paths
- every accepted V13 paper selection has one matching allowed audit row
- blocked decisions never contain a saved paper-bet reference
- all protected workers fail closed when authentication or required configuration is missing
- account export and deletion cover every V13 and Shadow Learning record
- automatic model promotion remains disabled

### P1 — Data quality, observability and outcome measurement

Related issue: [#75](https://github.com/vv-glitchhub/scorecaster/issues/75)

Work:

1. Build a production provider scorecard by sport and league: availability, freshness, fixture match rate, bookmaker coverage, disagreement and incident rate.
2. Track opening line, final pre-start closing line and price CLV coverage for settled paper selections.
3. Add explicit operational service-level targets for worker success, stale-data rate, settlement backlog and unresolved incidents.
4. Add a release evidence report that links deployment, migration version, provider readiness, worker probes and manual release checks.
5. Rank supported leagues by verified data quality and disable or degrade leagues that cannot meet the evidence threshold.
6. Keep context and learning downgrade-only until chronology-safe outcome evidence is sufficient.

Proposed beta targets:

- 100% of autonomous paper selections linked to decision audits
- 100% of production tables covered by reviewed RLS policies and two-user tests
- at least 95% successful protected worker cycles outside declared provider incidents
- at least 90% verified fixture identity for enabled core leagues
- at least 80% closing-line coverage for eligible settled pregame paper selections
- zero live-data API responses served from the PWA cache

### P2 — Product clarity and repeat use

Related issue: [#76](https://github.com/vv-glitchhub/scorecaster/issues/76)

Work:

1. Make `/quick-use` the shortest path from sign-in to a trustworthy current decision.
2. Present one daily brief that answers: what is usable, what is blocked, why it is blocked and what changed.
3. Reduce duplicate surfaces and ensure Betting, Agent, Mission Control and Diagnostics use the same decision terminology.
4. Add user-visible freshness, provider coverage and price-floor explanations next to every actionable selection.
5. Add bounded product feedback for confusing decisions, missing leagues and false-positive alerts without allowing users to rewrite model outcomes.
6. Measure activation, first paper save, return usage, watchlist use, settlement completion and alert usefulness.

Exit criteria:

- a new user can understand the paper-only boundary before saving a selection
- PLAY / CAUTION / SKIP reasons are consistent across web and mobile
- stale or missing evidence is visible instead of silently replaced
- critical actions remain usable on mobile-sized screens and installed PWA mode

### P3 — Mobile beta and physical notification proof

Related issue: [#12](https://github.com/vv-glitchhub/scorecaster/issues/12)

Work:

1. Link the Expo project to EAS and produce signed preview builds.
2. Test FI / EN / ES authentication, paper save, settlement, export and deletion on physical iOS and Android devices.
3. Verify that server-only keys are absent from signed bundles.
4. Test emergency stop before the next worker claim on both platforms.
5. Complete physical push-notification delivery, deduplication, deep links and permission handling.
6. Prepare TestFlight and Google Play internal-testing disclosures, support identity, privacy text and screenshots.

Exit criteria:

- signed internal builds pass the same paper-risk and account-isolation expectations as web
- push notifications are verified on physical devices
- no release depends on unverified background behavior

### P4 — Controlled learning evaluation

This phase starts only after P0–P3 evidence is stable.

Work:

1. Accumulate at least 300 eligible settled observations and at least 100 usable closing lines.
2. Preserve chronological train/holdout separation and immutable decision-time features.
3. Compare champion and challenger with Brier score, log loss, calibration, CLV, ROI, drawdown and drift.
4. Require positive and stable holdout evidence across meaningful league and time slices.
5. Keep every challenger shadow-only until a separate reviewed manual promotion release.
6. Add an explicit rollback path to the permanent no-vig consensus champion.

Exit criteria:

- no training/holdout or closing-line leakage
- no automatic production promotion
- no probability change without a reviewable evidence package
- production risk caps remain independent of model choice

## Recommended next implementation sequence

1. Merge this roadmap and use it as the single planning reference.
2. Complete issue #73 and consolidate duplicate production-activation tasks from issue #9.
3. Implement the production evidence and provider scorecard in issue #75.
4. Run controlled two-user and hard-cap tests in production-safe accounts.
5. Enable Shadow Learning only after every P0 gate passes.
6. Complete the quick-use and daily-brief consolidation in issue #76.
7. Move to mobile internal testing in issue #12 only after web production proof is stable.

## Delivery rules

Every roadmap change should:

- use a focused branch and draft pull request
- preserve the paper-only boundary
- include relevant regression tests and a production build
- update release-readiness configuration when a new blocking gate is introduced
- document feature flags, failure behavior and rollback steps
- prefer measurable evidence over a new version number
