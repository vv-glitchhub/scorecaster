# Production Event Identity Normalization Evidence — 2026-09-10

## Scope

This evidence covers only the deterministic provider-to-canonical football event identity normalization used by Scorecaster's owned football validation pipeline. It does not change model probabilities, paper-risk rules, model promotion, or the product's paper-only boundary.

## Production migrations

- `scorecaster_event_identity_normalization_v3` — Supabase migration registry version `20260910114911`.
- `scorecaster_event_identity_normalization_v4` — Supabase migration registry version `20260910115053`.

Both migrations were applied through the connected Supabase production project using the migration API. Each migration replaces only `scorecaster_private.normalize_team_identity(text)`, preserves its immutable SQL contract and service-role-only execution boundary, and immediately reruns the existing governed `scorecaster_private.refresh_event_identity_map()` mapper.

## Why the change was required

The pre-existing mapper correctly required both teams plus a bounded kickoff-time window, but its deterministic club-name normalization was too narrow for several current provider/canonical naming variants. Examples observed in production included `Union Berlin` vs `1. FC Union Berlin`, `Bayern Munich` vs `FC Bayern München`, `Rennes` vs `Stade Rennais FC 1901`, `Lazio` vs `SS Lazio`, `Como` vs `Como 1907`, and `Angers` vs `Angers SCO`.

No fuzzy or probabilistic similarity algorithm was introduced. V3/V4 only remove bounded organizational/numeric club tokens and normalize an explicit reviewed set of linguistic aliases. The existing event mapper still requires both normalized team identities and the existing bounded kickoff window before writing a verified mapping.

## Live production verification

Before the change, the current owned-football pregame runway contained 42 upcoming events but only 18 had a verified The Odds API → canonical identity mapping.

After V3, the same check returned 41/42 verified mappings. The single remaining mismatch was `Angers` vs `Angers SCO`.

After V4 and the governed identity refresh, production returned:

- upcoming owned-football events: **42**
- verified mappings: **42**
- high-confidence mappings (`match_confidence >= 0.94`): **42**
- unmapped events: **0**
- duplicate verified mappings to the same future canonical event: **0**
- earliest current owned-football kickoff: **2026-09-11T18:30:00Z**

The migration-registry query independently confirmed both migration names and versions listed above.

## Validation boundary

This change improves the ability to join a pregame provider event to its later canonical verified outcome. It does **not** create historical learning rows after the fact. Current `learningExamples = 0` remains valid because no eligible owned-football PIT event recorded by the new pipeline had yet settled when this evidence was captured.

Scorecaster must continue to require:

1. a feature/prediction snapshot created before kickoff,
2. a verified final outcome observed after kickoff,
3. leakage guards and training-rights checks,
4. the canonical identity match,
5. no synthetic backfill,
6. no automatic model promotion.

## Safety conclusion

The production identity runway is now fully mapped for the current 42 upcoming owned-football events while preserving deterministic matching, fail-closed behavior, chronology requirements, paper-only operation and manual model governance.