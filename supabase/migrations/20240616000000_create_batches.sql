-- Kitchen batch workflow: Prep → Cooking → Packing → Ready → Pickup → Dispatched
-- Single Gurdwara v1 (no gurdwaras table; multi-site deferred).
-- Coordinators create batches; both coordinator and kitchen_admin can advance stages.

-- ─── Role helpers ────────────────────────────────────────────────────────────

create or replace function public.is_kitchen_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'kitchen_admin',
    false
  );
$$;

comment on function public.is_kitchen_admin() is
  'Returns true when JWT app_metadata.role = kitchen_admin.';

create or replace function public.is_staff()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    (select auth.jwt() -> 'app_metadata' ->> 'role') in ('coordinator', 'kitchen_admin'),
    false
  );
$$;

comment on function public.is_staff() is
  'Returns true when JWT app_metadata.role is coordinator or kitchen_admin.';

-- ─── Enum ────────────────────────────────────────────────────────────────────

create type public.batch_status as enum (
  'prep',
  'cooking',
  'packing',
  'ready',
  'pickup',
  'dispatched'
);

-- ─── Table ───────────────────────────────────────────────────────────────────

create table public.batches (
  id                 uuid        primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  batch_date         date        not null,
  status             public.batch_status not null default 'prep',

  meal_count_planned integer     not null check (meal_count_planned >= 0),
  meal_count_packed  integer     not null default 0 check (meal_count_packed >= 0),

  notes              text,
  created_by         uuid        references auth.users (id),

  -- Per-stage timestamps (populated by trigger on each transition)
  cooking_at         timestamptz,
  packing_at         timestamptz,
  ready_at           timestamptz,
  pickup_at          timestamptz,
  dispatched_at      timestamptz
);

comment on table  public.batches                    is 'One langar production batch per calendar date.';
comment on column public.batches.batch_date         is 'Calendar date this batch serves.';
comment on column public.batches.meal_count_planned is 'Meals planned at batch creation.';
comment on column public.batches.meal_count_packed  is 'Meals confirmed packed; updated during packing stage.';

-- One batch per calendar date
create unique index batches_batch_date_idx on public.batches (batch_date);
create index        batches_status_idx     on public.batches (status);

-- ─── Triggers ────────────────────────────────────────────────────────────────

-- 1. Keep updated_at current (reuses the function from the recipients migration)
create trigger batches_set_updated_at
  before update on public.batches
  for each row execute function public.set_updated_at();

-- 2. Enforce forward-only stage progression
create or replace function public.enforce_batch_stage_forward()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  stages text[] := array['prep', 'cooking', 'packing', 'ready', 'pickup', 'dispatched'];
begin
  if array_position(stages, new.status::text) < array_position(stages, old.status::text) then
    raise exception
      'Batch stage can only advance forward (% → % is not allowed)',
      old.status, new.status;
  end if;
  return new;
end;
$$;

create trigger batches_enforce_stage_forward
  before update on public.batches
  for each row execute function public.enforce_batch_stage_forward();

-- 3. Stamp the timestamp for each stage the first time it is entered
create or replace function public.stamp_batch_stage_timestamp()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'cooking'    and old.status <> 'cooking'    then new.cooking_at    := now(); end if;
  if new.status = 'packing'    and old.status <> 'packing'    then new.packing_at    := now(); end if;
  if new.status = 'ready'      and old.status <> 'ready'      then new.ready_at      := now(); end if;
  if new.status = 'pickup'     and old.status <> 'pickup'     then new.pickup_at     := now(); end if;
  if new.status = 'dispatched' and old.status <> 'dispatched' then new.dispatched_at := now(); end if;
  return new;
end;
$$;

create trigger batches_stamp_stage_ts
  before update on public.batches
  for each row execute function public.stamp_batch_stage_timestamp();

-- ─── Grants + RLS ────────────────────────────────────────────────────────────

alter table public.batches enable row level security;

grant usage  on schema public    to authenticated;
grant select, insert, update on public.batches to authenticated;

-- Both roles can read batches
create policy "staff_select_batches"
  on public.batches
  for select
  to authenticated
  using (public.is_staff());

-- Only coordinators can create a new batch
create policy "coordinators_insert_batches"
  on public.batches
  for insert
  to authenticated
  with check (public.is_coordinator());

-- Both roles can advance stages and update meal counts
create policy "staff_update_batches"
  on public.batches
  for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());
