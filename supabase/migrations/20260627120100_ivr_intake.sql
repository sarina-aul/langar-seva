-- IVR intake: intake_channel enum, audit table, secure insert RPC.

create type public.intake_channel as enum ('web', 'ivr', 'staff');

alter table public.recipients
  add column intake_channel public.intake_channel not null default 'web',
  add column sms_confirmation_status text;

comment on column public.recipients.intake_channel is
  'How the pending request was captured: web form, phone IVR, or staff entry.';
comment on column public.recipients.sms_confirmation_status is
  'IVR or outbound SMS outcome: sent, failed, skipped.';

create table public.ivr_call_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  call_sid text not null unique,
  from_phone text not null,
  language public.language_pref not null,
  outcome text not null check (
    outcome in ('completed', 'abandoned', 'failed', 'sms_failed')
  ),
  recipient_id uuid references public.recipients(id) on delete set null,
  error_message text
);

create index ivr_call_events_created_at_idx on public.ivr_call_events(created_at desc);

alter table public.ivr_call_events enable row level security;

create or replace function public.create_ivr_pending_recipient(
  p_phone text,
  p_language public.language_pref,
  p_call_sid text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_phone text;
  existing_recipient uuid;
  new_id uuid;
begin
  if p_call_sid is null or length(trim(p_call_sid)) = 0 then
    raise exception 'call_sid is required';
  end if;

  select e.recipient_id
  into existing_recipient
  from public.ivr_call_events e
  where e.call_sid = p_call_sid
    and e.outcome = 'completed'
    and e.recipient_id is not null;

  if existing_recipient is not null then
    return existing_recipient;
  end if;

  normalized_phone := regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g');
  if normalized_phone !~ '^\+' and length(normalized_phone) = 10 then
    normalized_phone := '+1' || normalized_phone;
  end if;

  if normalized_phone !~ '^\+[1-9][0-9]{6,14}$' then
    insert into public.ivr_call_events (call_sid, from_phone, language, outcome, error_message)
    values (p_call_sid, coalesce(p_phone, ''), p_language, 'failed', 'Invalid phone number');
    raise exception 'Invalid phone number';
  end if;

  if p_language not in ('english', 'punjabi', 'hindi') then
    raise exception 'Unsupported IVR language';
  end if;

  insert into public.recipients (
    name,
    phone,
    address,
    unit_buzz,
    household_size,
    meals,
    delivery_window,
    language,
    contact_pref,
    notes,
    status,
    intake_channel
  )
  values (
    'Phone request',
    normalized_phone,
    'Address pending — coordinator callback',
    'none',
    1,
    1,
    'flexible',
    p_language,
    'phone',
    'IVR intake ' || to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') || '. CallSid: ' || p_call_sid,
    'pending',
    'ivr'
  )
  returning id into new_id;

  insert into public.ivr_call_events (call_sid, from_phone, language, outcome, recipient_id)
  values (p_call_sid, normalized_phone, p_language, 'completed', new_id);

  return new_id;
exception
  when others then
    insert into public.ivr_call_events (call_sid, from_phone, language, outcome, error_message)
    values (
      p_call_sid,
      coalesce(normalized_phone, coalesce(p_phone, '')),
      p_language,
      'failed',
      sqlerrm
    )
    on conflict (call_sid) do update
      set outcome = 'failed',
          error_message = excluded.error_message;
    raise;
end;
$$;

revoke all on function public.create_ivr_pending_recipient(text, public.language_pref, text) from public;
grant execute on function public.create_ivr_pending_recipient(text, public.language_pref, text) to service_role;

create or replace function public.mark_ivr_sms_status(p_recipient_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.recipients
  set sms_confirmation_status = p_status
  where id = p_recipient_id;
end;
$$;

revoke all on function public.mark_ivr_sms_status(uuid, text) from public;
grant execute on function public.mark_ivr_sms_status(uuid, text) to service_role;
