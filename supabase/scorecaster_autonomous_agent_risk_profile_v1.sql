-- Scorecaster Autonomous Agent Risk Profile V1
-- Run after scorecaster_autonomous_agent_v2.sql.
-- Backwards-compatible: existing and new users default to balanced.
-- The profile only controls paper recommendation strictness and virtual sizing.

alter table public.autonomous_agent_settings
  add column if not exists risk_profile text not null default 'balanced';

update public.autonomous_agent_settings
set risk_profile = 'balanced'
where risk_profile is null
   or risk_profile not in ('conservative', 'balanced', 'aggressive');

alter table public.autonomous_agent_settings
  drop constraint if exists autonomous_agent_risk_profile_allowed;
alter table public.autonomous_agent_settings
  add constraint autonomous_agent_risk_profile_allowed
  check (risk_profile in ('conservative', 'balanced', 'aggressive')) not valid;
alter table public.autonomous_agent_settings
  validate constraint autonomous_agent_risk_profile_allowed;

alter table public.autonomous_agent_decision_audit
  add column if not exists risk_profile text not null default 'balanced';
alter table public.autonomous_agent_decision_audit
  add column if not exists risk_policy jsonb not null default '{}'::jsonb;

update public.autonomous_agent_decision_audit
set risk_profile = 'balanced'
where risk_profile is null
   or risk_profile not in ('conservative', 'balanced', 'aggressive');

alter table public.autonomous_agent_decision_audit
  drop constraint if exists autonomous_agent_audit_risk_profile_allowed;
alter table public.autonomous_agent_decision_audit
  add constraint autonomous_agent_audit_risk_profile_allowed
  check (risk_profile in ('conservative', 'balanced', 'aggressive')) not valid;
alter table public.autonomous_agent_decision_audit
  validate constraint autonomous_agent_audit_risk_profile_allowed;

alter table public.autonomous_agent_decision_audit
  drop constraint if exists autonomous_agent_audit_risk_policy_object;
alter table public.autonomous_agent_decision_audit
  add constraint autonomous_agent_audit_risk_policy_object
  check (jsonb_typeof(risk_policy) = 'object') not valid;
alter table public.autonomous_agent_decision_audit
  validate constraint autonomous_agent_audit_risk_policy_object;

-- A risk-profile change should schedule a fresh protected cycle just like the
-- other recommendation settings. The existing scheduling function remains
-- authoritative and the worker still requires opt-in plus all safety gates.
drop trigger if exists autonomous_agent_settings_schedule on public.autonomous_agent_settings;
create trigger autonomous_agent_settings_schedule
after insert or update of
  enabled, sports, daily_pick_limit, min_priority_score, min_odds, max_odds,
  min_data_coverage, min_provider_count, max_provider_disagreement,
  max_drawdown_percent, max_daily_loss_percent, pause_after_losses, cooldown_hours,
  max_open_picks, minimum_minutes_before_start, maximum_hours_before_start,
  auto_pause_on_incident, require_unified_data, adaptive_cadence, shadow_learning_enabled,
  risk_profile
on public.autonomous_agent_settings
for each row execute function public.schedule_autonomous_agent_for_user();

comment on column public.autonomous_agent_settings.risk_profile is
  'Paper-only Agent recommendation risk profile. Does not alter model probability, edge or EV.';
comment on column public.autonomous_agent_decision_audit.risk_profile is
  'Risk profile applied when the autonomous paper decision was audited.';
comment on column public.autonomous_agent_decision_audit.risk_policy is
  'Sanitized immutable policy snapshot for autonomous paper decision audit.';
