-- In-app staff notifications: coordinator alerted when a batch becomes Ready.
-- v1: batch_ready only. Trigger inserts rows; clients read/update via RLS.

-- ─── Table ───────────────────────────────────────────────────────────────────

create table public.staff_notifications (
  id         uuid        primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  user_id    uuid        not null references auth.users (id) on delete cascade,
  batch_id   uuid        not null references public.batches (id) on delete cascade,

  kind       text        not null check (kind in ('batch_ready')),
  title      text        not null,
  body       text,
  read_at    timestamptz,

  unique (batch_id, user_id, kind)
);

comment on table public.staff_notifications is
  'In-app alerts for staff. v1: coordinators notified when batch hits ready.';

create index staff_notifications_user_unread_idx
  on public.staff_notifications (user_id, read_at);

-- ─── Trigger: batch → ready → notify all coordinators ────────────────────────

create or replace function public.notify_batch_ready()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'ready' and old.status is distinct from 'ready' then
    insert into public.staff_notifications (user_id, batch_id, kind, title, body)
    select
      u.id,
      new.id,
      'batch_ready',
      'Tonight''s batch is ready',
      format(
        '%s of %s meals packed — delivery can start',
        new.meal_count_packed,
        new.meal_count_planned
      )
    from auth.users u
    where u.raw_app_meta_data->>'role' = 'coordinator';
  end if;
  return new;
end;
$$;

comment on function public.notify_batch_ready() is
  'Inserts batch_ready notifications for all coordinator users when status becomes ready.';

revoke all on function public.notify_batch_ready() from public;

create trigger batches_notify_ready
  after update on public.batches
  for each row execute function public.notify_batch_ready();

-- ─── Grants + RLS ────────────────────────────────────────────────────────────

alter table public.staff_notifications enable row level security;

grant select, update on public.staff_notifications to authenticated;

create policy "coordinators_select_own_notifications"
  on public.staff_notifications
  for select
  to authenticated
  using (public.is_coordinator() and user_id = auth.uid());

create policy "coordinators_update_own_notifications"
  on public.staff_notifications
  for update
  to authenticated
  using (public.is_coordinator() and user_id = auth.uid())
  with check (public.is_coordinator() and user_id = auth.uid());

-- ─── Realtime ────────────────────────────────────────────────────────────────

alter publication supabase_realtime add table public.staff_notifications;
