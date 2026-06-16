-- Seva Eats v1: recipient intake schema
-- Public can INSERT pending rows only; coordinators read/update via RLS.

-- Enums
create type public.recipient_status as enum (
  'pending',
  'approved',
  'active',
  'paused',
  'rejected'
);

create type public.delivery_window as enum (
  'morning',
  'afternoon',
  'evening',
  'flexible'
);

create type public.language_pref as enum (
  'english',
  'punjabi',
  'hindi',
  'urdu',
  'other'
);

create type public.delivery_frequency as enum (
  'one_time',
  'weekly',
  'biweekly',
  'monthly'
);

create type public.contact_pref as enum (
  'phone',
  'text',
  'either'
);

-- Recipients table
create table public.recipients (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Required intake fields
  name text not null,
  phone text not null,
  address text not null,
  unit_buzz text not null,
  household_size smallint not null check (household_size >= 1 and household_size <= 20),
  meals smallint not null check (meals >= 1 and meals <= 20),
  delivery_window public.delivery_window not null,
  language public.language_pref not null default 'english',

  -- Optional intake fields
  frequency public.delivery_frequency,
  contact_pref public.contact_pref,
  notes text,

  -- Workflow / geocoding (populated by coordinators or edge function later)
  status public.recipient_status not null default 'pending',
  geocode_lat double precision,
  geocode_lng double precision,
  geocode_place_id text,
  geocoded_at timestamptz
);

comment on table public.recipients is 'Langar meal recipients — intake v1, no auth required to submit.';
comment on column public.recipients.geocode_lat is 'Placeholder for future geocoding pipeline.';
comment on column public.recipients.geocode_lng is 'Placeholder for future geocoding pipeline.';
comment on column public.recipients.geocode_place_id is 'Placeholder for Google/Mapbox place ID.';

create index recipients_status_idx on public.recipients (status);
create index recipients_created_at_idx on public.recipients (created_at desc);

-- Keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger recipients_set_updated_at
  before update on public.recipients
  for each row
  execute function public.set_updated_at();

-- Default meals to household_size on insert when client omits or matches household
create or replace function public.default_meals_to_household()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.meals is null then
    new.meals := new.household_size;
  end if;
  return new;
end;
$$;

create trigger recipients_default_meals
  before insert on public.recipients
  for each row
  execute function public.default_meals_to_household();

-- Coordinator check via app_metadata (set by admin, never user_metadata)
create or replace function public.is_coordinator()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'coordinator',
    false
  );
$$;

comment on function public.is_coordinator() is
  'Returns true when JWT app_metadata.role = coordinator. Assign via Supabase Auth admin API only.';

-- RLS
alter table public.recipients enable row level security;

-- Expose table to Data API with RLS enforced
grant usage on schema public to anon, authenticated;
grant select, insert on public.recipients to anon, authenticated;
grant update, delete on public.recipients to authenticated;

-- Public intake: anonymous users may insert only pending recipients
create policy "anon_insert_pending_recipients"
  on public.recipients
  for insert
  to anon
  with check (status = 'pending');

-- Authenticated non-coordinators: same insert-only rule (future volunteer apps)
create policy "authenticated_insert_pending_recipients"
  on public.recipients
  for insert
  to authenticated
  with check (
    status = 'pending'
    and not public.is_coordinator()
  );

-- Coordinators: full read access
create policy "coordinators_select_recipients"
  on public.recipients
  for select
  to authenticated
  using (public.is_coordinator());

-- Coordinators: update any recipient (approve, geocode, etc.)
create policy "coordinators_update_recipients"
  on public.recipients
  for update
  to authenticated
  using (public.is_coordinator())
  with check (public.is_coordinator());

-- Coordinators: delete if needed for data hygiene
create policy "coordinators_delete_recipients"
  on public.recipients
  for delete
  to authenticated
  using (public.is_coordinator());
