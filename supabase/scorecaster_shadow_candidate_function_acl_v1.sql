-- Scorecaster Shadow Candidate Function ACL V1
-- Forward-only privilege hardening for service-owned shadow settlement helpers.
-- This migration changes no application rows and is safe to re-run.

revoke all on function public.set_shadow_candidate_observation_defaults() from public, anon, authenticated;
revoke all on function public.wake_shadow_learning_from_candidate() from public, anon, authenticated;
revoke all on function public.apply_shadow_candidate_settlements_v1(jsonb) from public, anon, authenticated;

grant execute on function public.set_shadow_candidate_observation_defaults() to service_role;
grant execute on function public.wake_shadow_learning_from_candidate() to service_role;
grant execute on function public.apply_shadow_candidate_settlements_v1(jsonb) to service_role;
