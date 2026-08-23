-- Scorecaster Shadow Candidate Settlement Performance V2
-- Keeps the hourly settlement candidate lookup bounded as the audit table grows.

create index if not exists idx_autonomous_audit_open_settlement_candidates_v2
  on public.autonomous_agent_decision_audit(created_at asc)
  where settlement_status = 'open'
    and event_id is not null
    and model_probability is not null;
