alter table public.scorecaster_model_registry_v1
  drop constraint if exists scorecaster_model_registry_v1_status_check;

alter table public.scorecaster_model_registry_v1
  add constraint scorecaster_model_registry_v1_status_check
  check (status in ('research','shadow','challenger','review-candidate','champion','shadow-champion','retired','blocked'));
