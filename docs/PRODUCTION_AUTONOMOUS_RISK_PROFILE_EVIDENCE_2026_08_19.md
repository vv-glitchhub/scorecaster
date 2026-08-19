# Production Autonomous Risk Profile V1 Evidence — 2026-08-19

## Scope

This evidence records the production database state for `autonomous_agent_risk_profile_v1` without exposing user identifiers, application rows, secrets, tokens or credentials.

Product boundary remains sports analysis, risk control and virtual paper tracking only. The risk profile changes recommendation strictness and virtual sizing only. It does not change model probability, edge or EV and cannot enable real-money betting.

## Migration registry

Production Supabase migration registry contains:

- version: `20260819033704`
- name: `autonomous_agent_risk_profile_v1`

The migration was applied through the Supabase migration API before the application code that reads the new columns is deployed.

The canonical clean-install dependency order is `Autonomous Agent V2 -> V13 hard caps -> Autonomous Risk Profile V1 -> Shadow Learning`. This preserves the existing requirement that database hard caps are installed immediately after V2 and before any selectable recommendation-risk extension. The production registry timestamp above records the actual historical application date of this additive migration and is not rewritten to imitate the canonical clean-install order.

## Verified schema state

Object-level production verification confirmed:

- `public.autonomous_agent_settings.risk_profile` exists and defaults to `balanced`.
- Allowed setting values are limited to `conservative`, `balanced` and `aggressive`.
- `public.autonomous_agent_decision_audit.risk_profile` exists and defaults to `balanced`.
- `public.autonomous_agent_decision_audit.risk_policy` exists and is constrained to JSON objects.
- `autonomous_agent_settings_schedule` remains installed after the trigger replacement and a risk-profile change participates in the existing protected scheduling path.
- `autonomous_agent_settings` has both RLS and FORCE RLS enabled.
- `autonomous_agent_decision_audit` has both RLS and FORCE RLS enabled.

## Backfill verification

Aggregate-only verification after migration showed:

- autonomous settings rows: 1 balanced, 0 conservative, 0 aggressive
- historical autonomous decision-audit rows: 588 balanced, 0 conservative, 0 aggressive
- audit rows with a non-object `risk_policy`: 0

These counts are recorded only as migration evidence. No user ID, event ID, selection, bet row or other application payload was exported.

## Safety interpretation

Existing history is intentionally labeled `balanced` because all prior autonomous V13 decisions were produced before a user-selectable autonomous risk profile existed and the shared Agent engine therefore used its balanced default.

The migration creates no new table and grants no new browser role privileges. Existing row ownership policies and the existing server worker boundary remain authoritative.

The shared Agent policy continues to enforce the production paper hard caps:

- maximum single virtual stake: 1% of bankroll
- maximum total virtual exposure: 5% of bankroll
- maximum single-league virtual exposure: 2.5% of bankroll

User-specific minimum edge and minimum confidence remain additional floors. Selecting a higher-risk profile cannot lower those personal minimums.

## Advisor review

Security and performance advisors were re-run after the DDL change. No new risk-profile-specific RLS or performance finding was introduced. Existing unrelated advisor findings remain tracked separately and are not reclassified by this migration.

## Release acceptance

This migration may be recorded as `applied` because:

1. the exact named migration is present in the production migration registry;
2. the new columns and constraints were verified in production;
3. existing rows were backfilled deterministically to `balanced`;
4. RLS + FORCE RLS remained enabled on both affected tables;
5. no new public table or browser grant was created;
6. the application remains paper-only and probability/edge/EV are not modified by the risk setting.