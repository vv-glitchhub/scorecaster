# Autonomous Market Scanner V1

Autonomous Market Scanner V1 lets the paper-only Autonomous Scorecaster compare eligible event-specific bookmaker markets against the existing H2H candidate pool.

## Safety boundary

- Paper-only. No bookmaker login, money movement or real-money bet execution.
- The scanner never changes model/consensus probability, edge or EV.
- `PRICE_ONLY` Market Universe outcomes are excluded from Agent recommendations.
- Existing Agent V9/V13 recommendation gates, one-play-per-event control and hard exposure caps remain authoritative.

## Quota governance

The worker runs every 15 minutes, but advanced-market scanning is due only once per hour. Each scan is capped at three unique events and one market group per event. Market groups rotate deterministically so coverage expands over repeated cycles instead of requesting every market for every event at once.

The scan stops when The Odds API reports remaining quota at or below the configured reserve (default 100). Provider errors or quota exhaustion fail open to the existing H2H candidate pool; they do not fail the autonomous paper worker.

## Initial rotation

- Soccer: goals/team totals are intentionally over-weighted, with featured, period, result, corners/cards and player groups rotated across later cycles.
- Ice hockey: goals/team totals are over-weighted, with featured, periods and players rotated.
- Basketball: featured and player groups rotate.
- Other currently supported sports use the documented featured Market Universe group.

The rotation can expand only when the underlying Market Universe settlement model can analyze the market correctly. Unsupported settlement structures remain visible to users as `PRICE_ONLY` but are not promoted to Agent candidates.
