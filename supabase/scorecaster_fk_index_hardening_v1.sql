-- Scorecaster V1 production foreign-key index hardening.
-- Both statements are additive and safe to run repeatedly.

create index if not exists scorecaster_learning_examples_v1_outcome_id_idx
  on public.scorecaster_learning_examples_v1 (outcome_id);

create index if not exists scorecaster_model_predictions_v1_feature_snapshot_id_idx
  on public.scorecaster_model_predictions_v1 (feature_snapshot_id);
