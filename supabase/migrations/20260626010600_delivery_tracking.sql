-- Privacy-preserving delivery tracking for client SMS links.
-- Clients see package-style progress and ETA windows, not raw route data.

create extension if not exists pgcrypto with schema extensions;

create type public.delivery_stop_status as enum (
  'pending',
  'on_the_way',
  'nearby',
  'delivered',
  'skipped',
  'unable_to_contact',
  'delayed'
);

create type public.delivery_notification_status as enum (
  'queued',
  'sent',
  'failed',
  'skipped',
  'logged'
);

alter table public.dispatch_route_recipients
  add column delivery_status public.delivery_stop_status not null default 'pending',
  add column eta_start timestamptz,
  add column eta_end timestamptz,
  add column status_updated_at timestamptz not null default now(),
  add column delivered_at timestamptz,
  add column skipped_at timestamptz,
  add column driver_note_internal text,
  add column client_visible_note text,
  add constraint dispatch_route_recipients_eta_order
    check (eta_start is null or eta_end is null or eta_start <= eta_end);

comment on column public.dispatch_route_recipients.delivery_status is
  'Per-stop delivery progress used for driver updates and redacted client tracking.';
comment on column public.dispatch_route_recipients.client_visible_note is
  'Optional note safe to show to the recipient through the tracking link.';

create index dispatch_route_recipients_delivery_status_idx
  on public.dispatch_route_recipients(delivery_status);

create table public.delivery_tracking_links (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  route_recipient_id uuid not null references public.dispatch_route_recipients(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  sent_at timestamptz,
  last_viewed_at timestamptz,
  created_by uuid,
  unique (route_recipient_id)
);

create index delivery_tracking_links_route_recipient_idx
  on public.delivery_tracking_links(route_recipient_id);
create index delivery_tracking_links_active_idx
  on public.delivery_tracking_links(route_recipient_id, expires_at)
  where revoked_at is null;

create table public.delivery_notifications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  route_recipient_id uuid not null references public.dispatch_route_recipients(id) on delete cascade,
  recipient_id uuid not null references public.recipients(id) on delete cascade,
  channel text not null default 'sms' check (channel in ('sms')),
  event_type text not null check (
    event_type in (
      'tracking_link_created',
      'tracking_link_sent',
      'delivery_status_update',
      'delivery_exception'
    )
  ),
  status public.delivery_notification_status not null default 'queued',
  provider_message_id text,
  error text,
  sent_at timestamptz
);

create index delivery_notifications_route_recipient_idx
  on public.delivery_notifications(route_recipient_id, created_at desc);
create index delivery_notifications_recipient_idx
  on public.delivery_notifications(recipient_id, created_at desc);

create or replace function public.stamp_dispatch_stop_status()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.delivery_status is distinct from old.delivery_status
    or new.eta_start is distinct from old.eta_start
    or new.eta_end is distinct from old.eta_end
    or new.client_visible_note is distinct from old.client_visible_note
  then
    new.status_updated_at := now();
  end if;

  if new.delivery_status = 'delivered' and old.delivery_status <> 'delivered' then
    new.delivered_at := coalesce(new.delivered_at, now());
  end if;

  if new.delivery_status in ('skipped', 'unable_to_contact')
    and old.delivery_status <> new.delivery_status
  then
    new.skipped_at := coalesce(new.skipped_at, now());
  end if;

  return new;
end;
$$;

create trigger dispatch_route_recipients_stamp_status
  before update on public.dispatch_route_recipients
  for each row execute function public.stamp_dispatch_stop_status();

create or replace function public.create_delivery_tracking_link(p_route_recipient_id uuid)
returns table (tracking_token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  raw_token text;
  token_digest text;
  stop_exists boolean;
begin
  if not public.is_coordinator() then
    raise exception 'Only coordinators can create delivery tracking links.';
  end if;

  select exists (
    select 1
    from public.dispatch_route_recipients drr
    join public.dispatch_routes dr on dr.id = drr.route_id
    where drr.id = p_route_recipient_id
      and dr.status <> 'cancelled'
  ) into stop_exists;

  if not stop_exists then
    raise exception 'Route stop is not available for tracking.';
  end if;

  raw_token := encode(extensions.gen_random_bytes(24), 'hex');
  token_digest := encode(extensions.digest(raw_token, 'sha256'), 'hex');
  expires_at := date_trunc('day', now()) + interval '2 days';

  insert into public.delivery_tracking_links (
    route_recipient_id,
    token_hash,
    expires_at,
    revoked_at,
    created_by
  )
  values (
    p_route_recipient_id,
    token_digest,
    expires_at,
    null,
    auth.uid()
  )
  on conflict (route_recipient_id) do update
    set token_hash = excluded.token_hash,
        expires_at = excluded.expires_at,
        revoked_at = null,
        sent_at = null,
        last_viewed_at = null,
        created_by = excluded.created_by;

  tracking_token := raw_token;
  return next;
end;
$$;

revoke all on function public.create_delivery_tracking_link(uuid) from public;
grant execute on function public.create_delivery_tracking_link(uuid) to authenticated;

create or replace function public.mark_delivery_tracking_link_sent(
  p_route_recipient_id uuid,
  p_provider_message_id text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient uuid;
begin
  if not public.is_coordinator() then
    raise exception 'Only coordinators can mark tracking links sent.';
  end if;

  select drr.recipient_id
  into recipient
  from public.dispatch_route_recipients drr
  where drr.id = p_route_recipient_id;

  if recipient is null then
    raise exception 'Route stop not found.';
  end if;

  update public.delivery_tracking_links
  set sent_at = now()
  where route_recipient_id = p_route_recipient_id
    and revoked_at is null;

  insert into public.delivery_notifications (
    route_recipient_id,
    recipient_id,
    event_type,
    status,
    provider_message_id,
    sent_at
  )
  values (
    p_route_recipient_id,
    recipient,
    'tracking_link_sent',
    case when p_provider_message_id is null then 'logged'::public.delivery_notification_status else 'sent'::public.delivery_notification_status end,
    p_provider_message_id,
    now()
  );
end;
$$;

revoke all on function public.mark_delivery_tracking_link_sent(uuid, text) from public;
grant execute on function public.mark_delivery_tracking_link_sent(uuid, text) to authenticated;

create or replace function public.get_delivery_tracking_status(p_tracking_token text)
returns table (
  delivery_status public.delivery_stop_status,
  status_label text,
  eta_start timestamptz,
  eta_end timestamptz,
  last_updated_at timestamptz,
  route_progress_label text,
  client_visible_note text,
  delivered_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  token_digest text;
begin
  if p_tracking_token is null or length(trim(p_tracking_token)) < 24 then
    return;
  end if;

  token_digest := encode(extensions.digest(trim(p_tracking_token), 'sha256'), 'hex');

  update public.delivery_tracking_links link
  set last_viewed_at = now()
  where link.token_hash = token_digest
    and link.revoked_at is null
    and link.expires_at > now();

  return query
  select
    drr.delivery_status,
    case drr.delivery_status
      when 'pending' then
        case dr.status
          when 'planned' then 'Preparing your delivery'
          when 'assigned' then 'Delivery assigned'
          when 'picked_up' then 'On the way'
          else 'Delivery pending'
        end
      when 'on_the_way' then 'On the way'
      when 'nearby' then 'Nearby'
      when 'delivered' then 'Delivered'
      when 'skipped' then 'Skipped'
      when 'unable_to_contact' then 'Unable to complete'
      when 'delayed' then 'Delayed'
    end,
    drr.eta_start,
    drr.eta_end,
    drr.status_updated_at,
    case
      when drr.delivery_status = 'delivered' then 'Delivered'
      when remaining.remaining_before is null then null
      when remaining.remaining_before <= 0 then 'Your stop is next'
      when remaining.remaining_before = 1 then '1 stop before you'
      else remaining.remaining_before::text || ' stops before you'
    end,
    drr.client_visible_note,
    drr.delivered_at
  from public.delivery_tracking_links link
  join public.dispatch_route_recipients drr on drr.id = link.route_recipient_id
  join public.dispatch_routes dr on dr.id = drr.route_id
  left join lateral (
    select count(*)::integer as remaining_before
    from public.dispatch_route_recipients prior
    where prior.route_id = drr.route_id
      and prior.stop_order < drr.stop_order
      and prior.delivery_status not in ('delivered', 'skipped', 'unable_to_contact')
  ) remaining on true
  where link.token_hash = token_digest
    and link.revoked_at is null
    and link.expires_at > now()
    and dr.status <> 'cancelled';
end;
$$;

revoke all on function public.get_delivery_tracking_status(text) from public;
grant execute on function public.get_delivery_tracking_status(text) to anon, authenticated;

alter table public.delivery_tracking_links enable row level security;
alter table public.delivery_notifications enable row level security;

grant select, insert, update on public.delivery_tracking_links to authenticated;
grant select, insert, update on public.delivery_notifications to authenticated;

create policy "staff_select_delivery_tracking_links"
  on public.delivery_tracking_links
  for select
  to authenticated
  using (public.is_staff());

create policy "coordinators_insert_delivery_tracking_links"
  on public.delivery_tracking_links
  for insert
  to authenticated
  with check (public.is_coordinator());

create policy "coordinators_update_delivery_tracking_links"
  on public.delivery_tracking_links
  for update
  to authenticated
  using (public.is_coordinator())
  with check (public.is_coordinator());

create policy "staff_select_delivery_notifications"
  on public.delivery_notifications
  for select
  to authenticated
  using (public.is_staff());

create policy "coordinators_insert_delivery_notifications"
  on public.delivery_notifications
  for insert
  to authenticated
  with check (public.is_coordinator());

create policy "coordinators_update_delivery_notifications"
  on public.delivery_notifications
  for update
  to authenticated
  using (public.is_coordinator())
  with check (public.is_coordinator());

alter publication supabase_realtime add table public.delivery_tracking_links;
alter publication supabase_realtime add table public.delivery_notifications;
