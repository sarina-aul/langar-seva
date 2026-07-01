-- Driver magic links: sevadars open one assigned route without staff login.

create table public.driver_route_links (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  route_id uuid not null references public.dispatch_routes(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  sent_at timestamptz,
  last_viewed_at timestamptz,
  created_by uuid,
  unique (route_id)
);

create index driver_route_links_route_idx on public.driver_route_links(route_id);
create index driver_route_links_active_idx
  on public.driver_route_links(route_id, expires_at)
  where revoked_at is null;

alter table public.delivery_notifications
  drop constraint if exists delivery_notifications_event_type_check;

alter table public.delivery_notifications
  add constraint delivery_notifications_event_type_check
  check (
    event_type in (
      'tracking_link_created',
      'tracking_link_sent',
      'driver_route_link_sent',
      'delivery_status_update',
      'delivery_exception'
    )
  );

create or replace function public.create_driver_route_link(p_route_id uuid)
returns table (route_token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  raw_token text;
  token_digest text;
  route_ok boolean;
  link_expires timestamptz;
begin
  if not public.is_coordinator() then
    raise exception 'Only coordinators can create driver route links.';
  end if;

  select exists (
    select 1
    from public.dispatch_routes dr
    where dr.id = p_route_id
      and dr.status <> 'cancelled'
  ) into route_ok;

  if not route_ok then
    raise exception 'Route is not available for driver access.';
  end if;

  raw_token := encode(extensions.gen_random_bytes(24), 'hex');
  token_digest := encode(extensions.digest(raw_token, 'sha256'), 'hex');
  link_expires := date_trunc('day', now()) + interval '2 days';

  insert into public.driver_route_links (
    route_id,
    token_hash,
    expires_at,
    revoked_at,
    created_by
  )
  values (
    p_route_id,
    token_digest,
    link_expires,
    null,
    auth.uid()
  )
  on conflict (route_id) do update
    set token_hash = excluded.token_hash,
        expires_at = excluded.expires_at,
        revoked_at = null,
        sent_at = null,
        last_viewed_at = null,
        created_by = excluded.created_by;

  route_token := raw_token;
  expires_at := link_expires;
  return next;
end;
$$;

revoke all on function public.create_driver_route_link(uuid) from public;
grant execute on function public.create_driver_route_link(uuid) to authenticated;

create or replace function public.revoke_driver_route_link(p_route_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_coordinator() then
    raise exception 'Only coordinators can revoke driver route links.';
  end if;

  update public.driver_route_links
  set revoked_at = now()
  where route_id = p_route_id
    and revoked_at is null;
end;
$$;

revoke all on function public.revoke_driver_route_link(uuid) from public;
grant execute on function public.revoke_driver_route_link(uuid) to authenticated;

create or replace function public.mark_driver_route_link_sent(
  p_route_id uuid,
  p_provider_message_id text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_coordinator() then
    raise exception 'Only coordinators can mark driver route links sent.';
  end if;

  update public.driver_route_links
  set sent_at = now()
  where route_id = p_route_id
    and revoked_at is null;
end;
$$;

revoke all on function public.mark_driver_route_link_sent(uuid, text) from public;
grant execute on function public.mark_driver_route_link_sent(uuid, text) to authenticated;

create or replace function public.resolve_driver_route_id(p_route_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  token_digest text;
  resolved uuid;
begin
  if p_route_token is null or length(trim(p_route_token)) < 24 then
    return null;
  end if;

  token_digest := encode(extensions.digest(trim(p_route_token), 'sha256'), 'hex');

  update public.driver_route_links link
  set last_viewed_at = now()
  where link.token_hash = token_digest
    and link.revoked_at is null
    and link.expires_at > now()
  returning link.route_id into resolved;

  return resolved;
end;
$$;

revoke all on function public.resolve_driver_route_id(text) from public;
grant execute on function public.resolve_driver_route_id(text) to anon, authenticated;

create or replace function public.update_driver_route_stop(
  p_route_token text,
  p_stop_id uuid,
  p_delivery_status public.delivery_stop_status,
  p_client_visible_note text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  route uuid;
begin
  route := public.resolve_driver_route_id(p_route_token);
  if route is null then
    return false;
  end if;

  update public.dispatch_route_recipients drr
  set
    delivery_status = p_delivery_status,
    client_visible_note = nullif(trim(p_client_visible_note), '')
  where drr.id = p_stop_id
    and drr.route_id = route;

  return found;
end;
$$;

revoke all on function public.update_driver_route_stop(text, uuid, public.delivery_stop_status, text) from public;
grant execute on function public.update_driver_route_stop(text, uuid, public.delivery_stop_status, text) to anon, authenticated;

create or replace function public.mark_driver_route_picked_up(p_route_token text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  route uuid;
  pickup_time timestamptz := now();
begin
  route := public.resolve_driver_route_id(p_route_token);
  if route is null then
    return false;
  end if;

  update public.dispatch_routes
  set status = 'picked_up'
  where id = route
    and status = 'assigned';

  update public.dispatch_route_recipients drr
  set
    delivery_status = 'on_the_way',
    eta_start = pickup_time + ((drr.stop_order - 1) * interval '15 minutes'),
    eta_end = pickup_time + (drr.stop_order * interval '15 minutes')
  where drr.route_id = route
    and drr.delivery_status = 'pending';

  return true;
end;
$$;

revoke all on function public.mark_driver_route_picked_up(text) from public;
grant execute on function public.mark_driver_route_picked_up(text) to anon, authenticated;

create or replace function public.get_driver_route_for_token(p_route_token text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  route uuid;
  result json;
begin
  route := public.resolve_driver_route_id(p_route_token);
  if route is null then
    return null;
  end if;

  select json_build_object(
    'route_id', dr.id,
    'route_name', dr.route_name,
    'status', dr.status,
    'sevadar_name', s.name,
    'stops', coalesce(
      (
        select json_agg(
          json_build_object(
            'id', drr.id,
            'stop_order', drr.stop_order,
            'meals', drr.meals,
            'delivery_status', drr.delivery_status,
            'eta_start', drr.eta_start,
            'eta_end', drr.eta_end,
            'client_visible_note', drr.client_visible_note,
            'recipient_name', r.name,
            'recipient_address', r.address,
            'recipient_unit_buzz', r.unit_buzz,
            'recipient_phone', r.phone
          )
          order by drr.stop_order
        )
        from public.dispatch_route_recipients drr
        join public.recipients r on r.id = drr.recipient_id
        where drr.route_id = dr.id
      ),
      '[]'::json
    )
  )
  into result
  from public.dispatch_routes dr
  left join public.sevadars s on s.id = dr.sevadar_id
  where dr.id = route
    and dr.status <> 'cancelled';

  return result;
end;
$$;

revoke all on function public.get_driver_route_for_token(text) from public;
grant execute on function public.get_driver_route_for_token(text) to anon, authenticated;

alter table public.driver_route_links enable row level security;

grant select, insert, update on public.driver_route_links to authenticated;

create policy "staff_select_driver_route_links"
  on public.driver_route_links
  for select
  to authenticated
  using (public.is_staff());

create policy "coordinators_insert_driver_route_links"
  on public.driver_route_links
  for insert
  to authenticated
  with check (public.is_coordinator());

create policy "coordinators_update_driver_route_links"
  on public.driver_route_links
  for update
  to authenticated
  using (public.is_coordinator())
  with check (public.is_coordinator());

alter publication supabase_realtime add table public.driver_route_links;
