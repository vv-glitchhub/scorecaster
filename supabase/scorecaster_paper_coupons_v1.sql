-- Scorecaster Paper Coupons V1
-- Additive, paper-only schema extension for accumulator/coupon views.
-- Existing RLS policies on bet_slips and bet_slip_items remain authoritative.

alter table public.bet_slips
  add column if not exists slip_type text not null default 'accumulator';

alter table public.bet_slips
  add column if not exists total_odds numeric not null default 1;

alter table public.bet_slips
  add column if not exists settled_at timestamptz;

alter table public.bet_slip_items
  add column if not exists source_bet_id uuid references public.bets(id) on delete set null;

alter table public.bet_slip_items
  add column if not exists commence_time timestamptz;

create index if not exists idx_bet_slips_user_created
  on public.bet_slips(user_id, created_at desc);

create index if not exists idx_bet_slip_items_slip
  on public.bet_slip_items(bet_slip_id, created_at);

create index if not exists idx_bet_slip_items_source_bet
  on public.bet_slip_items(source_bet_id)
  where source_bet_id is not null;

create unique index if not exists idx_bet_slip_items_unique_source_per_slip
  on public.bet_slip_items(bet_slip_id, source_bet_id)
  where source_bet_id is not null;

comment on column public.bet_slips.slip_type is
  'Paper-only slip type. Paper Coupons V1 currently writes accumulator.';

comment on column public.bet_slips.total_odds is
  'Snapshot product of paper coupon leg odds at creation time.';

comment on column public.bet_slip_items.source_bet_id is
  'Optional link to the user-owned paper bet whose settlement drives this coupon leg.';
