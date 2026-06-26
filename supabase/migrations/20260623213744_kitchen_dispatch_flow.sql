-- Kitchen dispatch flow: structured batch planning fields, route bundles,
-- and audit trail for operational changes.

-- ─── Batch planning fields ───────────────────────────────────────────────────

alter table public.batches
  add column menu text not null default 'Langar meal',
  add column pickup_window_start time,
  add column pickup_window_end time,
  add column service_location_name text not null default 'Gurdwara kitchen',
  add column service_location_address text,
  add column short_count_reason text,
  add column pickup_opened_at timestamptz;

comment on column public.batches.menu is 'Human-readable menu for the batch.';
comment on column public.batches.pickup_window_start is 'Local pickup window start time.';
comment on column public.batches.pickup_window_end is 'Local pickup window end time.';
comment on column public.batches.service_location_name is 'Where sevadars collect meals.';
comment on column public.batches.service_location_address is 'Pickup address for sevadars.';
comment on column public.batches.short_count_reason is 'Reason captured when marking ready below planned count.';
comment on column public.batches.pickup_opened_at is 'Timestamp when pickup window is opened.';

-- Stamp pickup_opened_at when entering pickup. Kept separate from pickup_at
-- because pickup_at is stage timestamp; pickup_opened_at names the business event.
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
  if new.status = 'pickup'     and old.status <> 'pickup'     then
    new.pickup_at := now();
    new.pickup_opened_at := coalesce(new.pickup_opened_at, now());
  end if;
  if new.status = 'dispatched' and old.status <> 'dispatched' then new.dispatched_at := now(); end if;
  return new;
end;
$$;

-- ─── Dispatch model ──────────────────────────────────────────────────────────

create type public.dispatch_route_status as enum (
  'planned',
  'assigned',
  'picked_up',
  'completed',
  'cancelled'
);

create table public.sevadars (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  phone text,
  notes text,
  active boolean not null default true
);

create table public.dispatch_routes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  batch_id uuid not null references public.batches(id) on delete cascade,
  sevadar_id uuid references public.sevadars(id) on delete set null,
  route_name text not null,
  status public.dispatch_route_status not null default 'planned',
  pickup_at timestamptz,
  completed_at timestamptz,
  notes text
);

create table public.dispatch_route_recipients (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  route_id uuid not null references public.dispatch_routes(id) on delete cascade,
  recipient_id uuid not null references public.recipients(id) on delete cascade,
  stop_order integer not null default 1 check (stop_order >= 1),
  meals integer not null check (meals >= 1),
  unique (route_id, recipient_id)
);

create index sevadars_active_idx on public.sevadars(active);
create index dispatch_routes_batch_idx on public.dispatch_routes(batch_id);
create index dispatch_routes_status_idx on public.dispatch_routes(status);
create index dispatch_route_recipients_route_idx on public.dispatch_route_recipients(route_id);
create index dispatch_route_recipients_recipient_idx on public.dispatch_route_recipients(recipient_id);

create trigger sevadars_set_updated_at
  before update on public.sevadars
  for each row execute function public.set_updated_at();

create trigger dispatch_routes_set_updated_at
  before update on public.dispatch_routes
  for each row execute function public.set_updated_at();

create or replace function public.stamp_dispatch_route_status()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'picked_up' and old.status <> 'picked_up' then
    new.pickup_at := coalesce(new.pickup_at, now());
  end if;
  if new.status = 'completed' and old.status <> 'completed' then
    new.completed_at := coalesce(new.completed_at, now());
  end if;
  return new;
end;
$$;

create trigger dispatch_routes_stamp_status
  before update on public.dispatch_routes
  for each row execute function public.stamp_dispatch_route_status();

-- ─── Batch audit log ─────────────────────────────────────────────────────────

create table public.batch_audit_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  batch_id uuid not null references public.batches(id) on delete cascade,
  actor_user_id uuid,
  event_type text not null check (
    event_type in (
      'stage_changed',
      'packed_count_changed',
      'short_count_reason_set',
      'batch_plan_changed',
      'route_created',
      'route_status_changed'
    )
  ),
  from_value text,
  to_value text,
  note text
);

create index batch_audit_events_batch_created_idx
  on public.batch_audit_events(batch_id, created_at desc);

create or replace function public.log_batch_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if new.status is distinct from old.status then
    insert into public.batch_audit_events (batch_id, actor_user_id, event_type, from_value, to_value)
    values (new.id, actor, 'stage_changed', old.status::text, new.status::text);
  end if;

  if new.meal_count_packed is distinct from old.meal_count_packed then
    insert into public.batch_audit_events (batch_id, actor_user_id, event_type, from_value, to_value)
    values (new.id, actor, 'packed_count_changed', old.meal_count_packed::text, new.meal_count_packed::text);
  end if;

  if new.short_count_reason is not null and new.short_count_reason is distinct from old.short_count_reason then
    insert into public.batch_audit_events (batch_id, actor_user_id, event_type, from_value, to_value, note)
    values (new.id, actor, 'short_count_reason_set', old.short_count_reason, new.short_count_reason, new.short_count_reason);
  end if;

  if new.menu is distinct from old.menu
    or new.pickup_window_start is distinct from old.pickup_window_start
    or new.pickup_window_end is distinct from old.pickup_window_end
    or new.service_location_name is distinct from old.service_location_name
    or new.service_location_address is distinct from old.service_location_address
  then
    insert into public.batch_audit_events (batch_id, actor_user_id, event_type, note)
    values (new.id, actor, 'batch_plan_changed', 'Batch planning fields changed');
  end if;

  return new;
end;
$$;

create trigger batches_log_changes
  after update on public.batches
  for each row execute function public.log_batch_changes();

revoke all on function public.log_batch_changes() from public;

create or replace function public.log_dispatch_route_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.batch_audit_events (batch_id, actor_user_id, event_type, to_value, note)
  values (new.batch_id, auth.uid(), 'route_created', new.route_name, new.notes);
  return new;
end;
$$;

create trigger dispatch_routes_log_created
  after insert on public.dispatch_routes
  for each row execute function public.log_dispatch_route_created();

revoke all on function public.log_dispatch_route_created() from public;

create or replace function public.log_dispatch_route_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    insert into public.batch_audit_events (batch_id, actor_user_id, event_type, from_value, to_value, note)
    values (new.batch_id, auth.uid(), 'route_status_changed', old.status::text, new.status::text, new.route_name);
  end if;
  return new;
end;
$$;

create trigger dispatch_routes_log_status
  after update on public.dispatch_routes
  for each row execute function public.log_dispatch_route_status();

revoke all on function public.log_dispatch_route_status() from public;

-- ─── Grants + RLS ────────────────────────────────────────────────────────────

alter table public.sevadars enable row level security;
alter table public.dispatch_routes enable row level security;
alter table public.dispatch_route_recipients enable row level security;
alter table public.batch_audit_events enable row level security;

grant select, insert, update on public.sevadars to authenticated;
grant select, insert, update, delete on public.dispatch_routes to authenticated;
grant select, insert, update, delete on public.dispatch_route_recipients to authenticated;
grant select on public.batch_audit_events to authenticated;

create policy "staff_select_sevadars"
  on public.sevadars
  for select
  to authenticated
  using (public.is_staff());

create policy "coordinators_insert_sevadars"
  on public.sevadars
  for insert
  to authenticated
  with check (public.is_coordinator());

create policy "coordinators_update_sevadars"
  on public.sevadars
  for update
  to authenticated
  using (public.is_coordinator())
  with check (public.is_coordinator());

create policy "staff_select_dispatch_routes"
  on public.dispatch_routes
  for select
  to authenticated
  using (public.is_staff());

create policy "coordinators_insert_dispatch_routes"
  on public.dispatch_routes
  for insert
  to authenticated
  with check (public.is_coordinator());

create policy "coordinators_update_dispatch_routes"
  on public.dispatch_routes
  for update
  to authenticated
  using (public.is_coordinator())
  with check (public.is_coordinator());

create policy "coordinators_delete_dispatch_routes"
  on public.dispatch_routes
  for delete
  to authenticated
  using (public.is_coordinator());

create policy "staff_select_dispatch_route_recipients"
  on public.dispatch_route_recipients
  for select
  to authenticated
  using (public.is_staff());

create policy "coordinators_insert_dispatch_route_recipients"
  on public.dispatch_route_recipients
  for insert
  to authenticated
  with check (public.is_coordinator());

create policy "coordinators_update_dispatch_route_recipients"
  on public.dispatch_route_recipients
  for update
  to authenticated
  using (public.is_coordinator())
  with check (public.is_coordinator());

create policy "coordinators_delete_dispatch_route_recipients"
  on public.dispatch_route_recipients
  for delete
  to authenticated
  using (public.is_coordinator());

create policy "staff_select_batch_audit_events"
  on public.batch_audit_events
  for select
  to authenticated
  using (public.is_staff());

alter publication supabase_realtime add table public.dispatch_routes;
alter publication supabase_realtime add table public.dispatch_route_recipients;
alter publication supabase_realtime add table public.batch_audit_events;
