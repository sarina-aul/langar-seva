-- Routing prep: postal codes for recipients and sevadar home locations.

-- Normalize Canadian postal codes to "A1A 1A1" or return null when invalid.
create or replace function public.normalize_postal_code(raw text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  compact text;
begin
  if raw is null or btrim(raw) = '' then
    return null;
  end if;

  compact := upper(regexp_replace(btrim(raw), '\s+', '', 'g'));

  if compact !~ '^[ABCEGHJ-NPRSTVXY][0-9][ABCEGHJ-NPRSTV-Z][0-9][ABCEGHJ-NPRSTV-Z][0-9]$' then
    return null;
  end if;

  return left(compact, 3) || ' ' || right(compact, 3);
end;
$$;

comment on function public.normalize_postal_code(text) is
  'Normalize a Canadian postal code to "A1A 1A1", or null if invalid.';

create or replace function public.set_recipient_postal_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.postal_code is not null and btrim(new.postal_code) <> '' then
    new.postal_code := public.normalize_postal_code(new.postal_code);
    if new.postal_code is null then
      raise exception 'Invalid Canadian postal code for recipient';
    end if;
    new.postal_prefix := left(replace(new.postal_code, ' ', ''), 3);
  else
    new.postal_code := null;
    new.postal_prefix := null;
  end if;

  return new;
end;
$$;

create or replace function public.set_sevadar_home_postal_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.home_postal_code is not null and btrim(new.home_postal_code) <> '' then
    new.home_postal_code := public.normalize_postal_code(new.home_postal_code);
    if new.home_postal_code is null then
      raise exception 'Invalid Canadian postal code for sevadar home location';
    end if;
    new.home_postal_prefix := left(replace(new.home_postal_code, ' ', ''), 3);
  else
    new.home_postal_code := null;
    new.home_postal_prefix := null;
  end if;

  return new;
end;
$$;

alter table public.recipients
  add column postal_code text,
  add column postal_prefix text;

comment on column public.recipients.postal_code is 'Canadian postal code for routing (normalized A1A 1A1).';
comment on column public.recipients.postal_prefix is 'First three characters of postal_code (FSA), set automatically.';

alter table public.sevadars
  add column home_postal_code text,
  add column home_postal_prefix text;

comment on column public.sevadars.home_postal_code is 'Sevadar home postal code for route corridor matching.';
comment on column public.sevadars.home_postal_prefix is 'First three characters of home_postal_code (FSA), set automatically.';

create trigger recipients_set_postal_fields
  before insert or update of postal_code on public.recipients
  for each row
  execute function public.set_recipient_postal_fields();

create trigger sevadars_set_home_postal_fields
  before insert or update of home_postal_code on public.sevadars
  for each row
  execute function public.set_sevadar_home_postal_fields();

create index recipients_postal_prefix_idx on public.recipients (postal_prefix)
  where postal_prefix is not null;

create index sevadars_home_postal_prefix_idx on public.sevadars (home_postal_prefix)
  where home_postal_prefix is not null;
