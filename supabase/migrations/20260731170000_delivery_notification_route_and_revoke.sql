-- Allow route-level SMS audit rows (driver links), revoke client tracking links,
-- and recalculate later-stop ETAs when a driver advances a stop.

alter table public.delivery_notifications
  alter column route_recipient_id drop not null,
  alter column recipient_id drop not null,
  add column if not exists route_id uuid references public.dispatch_routes(id) on delete cascade;

alter table public.delivery_notifications
  drop constraint if exists delivery_notifications_target_check;

alter table public.delivery_notifications
  add constraint delivery_notifications_target_check
  check (route_recipient_id is not null or route_id is not null);

create index if not exists delivery_notifications_route_idx
  on public.delivery_notifications(route_id, created_at desc)
  where route_id is not null;

create or replace function public.revoke_delivery_tracking_link(p_route_recipient_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_coordinator() then
    raise exception 'Only coordinators can revoke delivery tracking links.';
  end if;

  update public.delivery_tracking_links
  set revoked_at = now()
  where route_recipient_id = p_route_recipient_id
    and revoked_at is null;
end;
$$;

revoke all on function public.revoke_delivery_tracking_link(uuid) from public;
grant execute on function public.revoke_delivery_tracking_link(uuid) to authenticated;

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

  insert into public.delivery_notifications (
    route_id,
    event_type,
    status,
    provider_message_id,
    sent_at
  )
  values (
    p_route_id,
    'driver_route_link_sent',
    case
      when p_provider_message_id is null then 'logged'::public.delivery_notification_status
      else 'sent'::public.delivery_notification_status
    end,
    p_provider_message_id,
    now()
  );
end;
$$;

revoke all on function public.mark_driver_route_link_sent(uuid, text) from public;
grant execute on function public.mark_driver_route_link_sent(uuid, text) to authenticated;

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
  current_order integer;
  base_time timestamptz := now();
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
    and drr.route_id = route
  returning drr.stop_order into current_order;

  if not found then
    return false;
  end if;

  if p_delivery_status in ('delivered', 'skipped', 'unable_to_contact', 'delayed') then
    update public.dispatch_route_recipients later
    set
      eta_start = base_time + ((later.stop_order - current_order) * interval '15 minutes'),
      eta_end = base_time + (((later.stop_order - current_order) + 1) * interval '15 minutes')
    where later.route_id = route
      and later.stop_order > current_order
      and later.delivery_status not in ('delivered', 'skipped');
  end if;

  return true;
end;
$$;

revoke all on function public.update_driver_route_stop(text, uuid, public.delivery_stop_status, text) from public;
grant execute on function public.update_driver_route_stop(text, uuid, public.delivery_stop_status, text) to anon, authenticated;
