# Scorecaster Production Launch Board V1

Production Launch Board turns the public production status page into a prioritized launch path instead of a flat list of service flags.

## Critical path

The board treats only these five signals as core launch gates:

1. Supabase cloud data configured.
2. Live odds provider configured.
3. Settlement Monitor worker active.
4. Autonomous Paper Agent worker active.
5. Paper-only product boundary intact with real-money execution disabled.

When all five are ready, the platform directs the user to the explicit per-user Autonomous Agent opt-in. The opt-in remains separate by design and is never triggered from the public status page.

## Hardening vs launch blockers

Agent Decision signing is shown as production hardening rather than incorrectly blocking the autonomous paper loop. Optional notification delivery and other diagnostic flags remain visible under the technical details section but do not affect the five-gate launch score.

## Safety boundary

The board is read-only. It reads `/api/health`, contains no production credentials, performs no state mutations, and cannot enable real-money betting. User-specific activation remains behind the authenticated `/autonomous-agent` console.
