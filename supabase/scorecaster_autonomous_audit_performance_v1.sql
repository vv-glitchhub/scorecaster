-- Scorecaster Autonomous Agent audit-write performance hardening.
-- The shadow-default trigger uses this fallback lookup only when the worker
-- cannot provide commence_time directly.

create index if not exists market_provider_snapshots_v2_event_commence_idx
  on public.market_provider_snapshots_v2 (event_id, commence_time);
