-- IVR intake smoke checks (run after 20260627120100_ivr_intake.sql).
-- Requires service_role for create_ivr_pending_recipient.

\set ON_ERROR_STOP on

-- I01: create pending IVR recipient
select public.create_ivr_pending_recipient(
  '+15555550123',
  'punjabi'::public.language_pref,
  'CA-test-call-001'
) as ivr_recipient_id \gset

select status, intake_channel, address, language
from public.recipients
where id = :'ivr_recipient_id';

-- I02: idempotent by call_sid
select public.create_ivr_pending_recipient(
  '+15555550123',
  'punjabi'::public.language_pref,
  'CA-test-call-001'
) = :'ivr_recipient_id'::uuid as idempotent_replay;

-- I03: mark SMS status
select public.mark_ivr_sms_status(:'ivr_recipient_id'::uuid, 'sent');

select sms_confirmation_status
from public.recipients
where id = :'ivr_recipient_id';

-- I04: audit row exists
select outcome, recipient_id
from public.ivr_call_events
where call_sid = 'CA-test-call-001';
