-- Prep stage readiness confirmations.
-- These are deliberately simple v1 operational gates before "Start cooking".
-- Future ingredient checklists and volunteer staffing plans can hang off the
-- batch once the basic confirmation flow is stable.

alter table public.batches
  add column ingredients_confirmed_at timestamptz,
  add column stations_confirmed_at timestamptz,
  add column prep_confirmed_by uuid references auth.users(id);

comment on column public.batches.ingredients_confirmed_at is
  'Timestamp when kitchen confirms ingredients are ready for prep.';
comment on column public.batches.stations_confirmed_at is
  'Timestamp when kitchen confirms prep/cooking stations are ready.';
comment on column public.batches.prep_confirmed_by is
  'Staff user who last confirmed prep readiness.';
