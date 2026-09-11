# CasterDev AI — Scorecaster Project Memory

This file is durable project memory for autonomous development. It records high-signal facts and decisions, not a raw activity log.

## Mission

Continuously improve Scorecaster toward a production-grade, commercially credible sports-intelligence product without requiring the owner to provide each next task.

## Current known baseline — 2026-09-11

- Repository: `vv-glitchhub/scorecaster`
- Default branch: `main`
- Application stack observed in `package.json`: Next.js 16.2.1, React 19.2.8, Supabase SSR/client.
- The repository already contains extensive security, production, model, settlement, autonomous-agent, intelligence, UX, provider, data-readiness, Match Journey/Story, diagnostics, i18n and fixture test suites.
- Recent mainline work rebuilt the homepage as compact mobile-first V3 and hardened validation/football identity evidence.
- Existing autonomous-agent tests mean CasterDev must integrate with and improve existing autonomy rather than invent a disconnected second system.

## Standing decisions

1. Reliability, truthful data and security outrank cosmetic polish.
2. Do not fabricate ROI, win-rate, validation, odds or production claims.
3. Preserve paper-only boundaries unless real-money functionality is deliberately approved.
4. Use branch → tests/review → preview/CI → merge/release evidence, not direct blind production mutation.
5. RED actions in `AUTONOMY_CHARTER.md` require human approval; unrelated safe work should continue.

## Current autonomy initiative

### Goal

Create a persistent manager loop that can observe Scorecaster, select its own next task, delegate implementation/verification, retain memory and continue without waiting for repeated human prompts.

### Foundation tasks

- [x] Establish autonomy charter and safety boundaries.
- [x] Establish durable project memory.
- [ ] Inventory the existing autonomous-agent implementation and reuse its strongest contracts.
- [ ] Define machine-readable project state and candidate-task schema.
- [ ] Implement deterministic priority/risk scoring before model-assisted planning.
- [ ] Implement manager cycle: observe → propose candidates → select → execute/delegate → verify → remember.
- [ ] Add concurrency/lease protection so two cycles cannot mutate the same work simultaneously.
- [ ] Add budgets: maximum cycle time, tool actions, retries and cost.
- [ ] Add stop/escalation conditions and RED decision requests.
- [ ] Add browser/preview verification before guarded release.
- [ ] Add daily autonomous development report.
- [ ] Add production health feedback into the next planning cycle.

## Memory-writing rules

Write only durable information: architectural decisions, verified discoveries, recurring failures, safety constraints, completed milestones and the highest-value unresolved work. Do not store secrets, tokens, personal data, verbose command logs or speculative claims as facts.

Every autonomous cycle should finish by recording:

- What changed
- Evidence that it worked
- What failed and why
- New verified project facts
- Remaining risks
- Best next candidate tasks
- Whether a human decision is actually required
