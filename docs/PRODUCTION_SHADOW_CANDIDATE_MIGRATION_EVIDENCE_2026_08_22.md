# Scorecaster Shadow Candidate production migration evidence — 2026-08-22

## Scope and boundary

This evidence records read-only production catalog verification for the five Shadow Candidate migrations. The feature remains paper-only: rejected candidates are observations, model promotion is never automatic, and no real-money execution exists.

No application rows, user identifiers, connection strings, tokens or service keys were read or stored for this verification.

## Migration registry

The connected production Supabase migration registry returned these exact entries in dependency order:

| Version | Migration |
|---|---|
| `20260821042046` | `scorecaster_shadow_candidate_observations_v1` |
| `20260821042137` | `scorecaster_shadow_candidate_settlement_batch_v1` |
| `20260821042510` | `scorecaster_shadow_candidate_trigger_safety_v1` |
| `20260821043402` | `scorecaster_shadow_candidate_settlement_batch_v1_fix` |
| `20260822133341` | `scorecaster_shadow_candidate_function_acl_v1` |

## Observations V1

Catalog verification confirmed:

- `public.shadow_candidate_settlement_runs_v1` exists with RLS and FORCE RLS enabled;
- direct table access is absent for both `anon` and `authenticated`;
- all 25 reviewed audit columns are present on `public.autonomous_agent_decision_audit`;
- `autonomous_audit_shadow_defaults` and `autonomous_audit_wake_shadow_learning` exist;
- `set_shadow_candidate_observation_defaults()` and `wake_shadow_learning_from_candidate()` exist.

## Settlement Batch V1

`public.apply_shadow_candidate_settlements_v1(jsonb)` exists. The production ACL permits `service_role` execution and denies execution to `anon` and `authenticated`.

## Trigger Safety V1

The current wake helper and `autonomous_audit_wake_shadow_learning` trigger are present after the INSERT-safe forward repair. The verification read catalog metadata only.

## Settlement Batch fix

The corrected `apply_shadow_candidate_settlements_v1(jsonb)` definition is the active overload. The registry records the forward repair after the initial batch definition.

## Function ACL V1

The forward-only hardening migration changed no application rows. Post-migration privilege checks returned the following invariant for all three helpers:

| Role | EXECUTE |
|---|---:|
| `anon` | false |
| `authenticated` | false |
| `service_role` | true |

The three verified functions are:

- `set_shadow_candidate_observation_defaults()`
- `wake_shadow_learning_from_candidate()`
- `apply_shadow_candidate_settlements_v1(jsonb)`

## Conclusion

The five migrations are present in the production registry and their current schema/ACL boundary matches the reviewed repository state. Repository presence alone was not used as production proof.
