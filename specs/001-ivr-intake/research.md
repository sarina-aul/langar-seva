# Research: Phone-First IVR Intake

**Feature**: 001-ivr-intake | **Date**: 2026-06-27

## 1. Voice platform

**Decision**: Twilio Programmable Voice with TwiML webhooks to Supabase Edge Function
`twilio-ivr-voice`.

**Rationale**: Project already uses Twilio SMS in `send-delivery-tracking-sms` with
`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`. Same account can provision a
Voice-enabled number. TwiML keeps IVR logic in-repo without a separate telephony server.

**Alternatives considered**:

| Option | Rejected because |
|--------|------------------|
| Telnyx / Vonage | New vendor, duplicate SMS integration |
| Twilio Studio | Visual flow harder to version-control and review in PRs |
| Coordinator-only phone intake | Does not scale after hours; spec requires automated capture |

## 2. Insert path security (not anon from Twilio)

**Decision**: `public.create_ivr_pending_recipient(phone, language, call_sid)` as
`SECURITY DEFINER` function; callable only by `service_role` from Edge Function.

**Rationale**: Twilio cannot hold Supabase anon keys safely. Anon RLS insert is correct for web
but IVR needs server-side validation of placeholder fields and call metadata. RPC restricts
inserts to fixed defaults + `status = 'pending'` + `intake_channel = 'ivr'`.

**Alternatives considered**:

| Option | Rejected because |
|--------|------------------|
| Anon key in Twilio Function | Secret exposure; broader attack surface |
| Direct service-role insert in Edge Function without RPC | Business rules duplicated; harder to SQL-test |
| New `ivr` DB role | Over-engineered for pilot |

## 3. Placeholder fields for incomplete IVR data

**Decision**: RPC sets required NOT NULL columns to coordinator-reviewable placeholders:

| Column | IVR default |
|--------|-------------|
| `name` | `'Phone request'` |
| `address` | `'Address pending — coordinator callback'` |
| `unit_buzz` | `'none'` |
| `household_size` | `1` |
| `meals` | `1` |
| `delivery_window` | `'flexible'` |
| `contact_pref` | `'phone'` |
| `notes` | `'IVR intake {ISO timestamp}. CallSid: {sid}'` |

**Rationale**: Existing schema requires all columns NOT NULL; relaxing constraints would affect
web validation. Placeholders match coordinator workflow in spec (call back for address).

**Alternatives considered**:

| Option | Rejected because |
|--------|------------------|
| Nullable address/name columns | Migration ripple across web form, types, RLS tests |
| Separate `ivr_requests` table | Splits coordinator queue; violates Principle II (same schema) |

## 4. IVR state management

**Decision**: Stateless TwiML with URL query params: `?step=lang|menu|confirm|gather_phone&lang=en|pa|hi`.

**Rationale**: Pilot call volume does not need Redis/session store. Twilio passes `CallSid` on
every request for idempotency checks.

**Alternatives considered**:

| Option | Rejected because |
|--------|------------------|
| `ivr_call_events` as session store only | Overload audit table with ephemeral state |
| Twilio `<Connect>` to live agent | Out of scope; after-hours requirement |

## 5. Language prompts (P3)

**Decision**: Phase 1 ship English TwiML `<Say>`; Punjabi/Hindi via `<Say language="hi-IN">` /
`<Say language="pa-IN">` Twilio Polly voices for pilot. SMS uses templates in
`web/src/lib/ivrSmsTemplates.ts` keyed by `language_pref`.

**Rationale**: Spec allows TTS for pilot; professional recordings deferred.

**Alternatives considered**:

| Option | Rejected because |
|--------|------------------|
| Pre-recorded audio files in Storage | CDN latency + upload workflow not ready for v1.1 |
| English-only launch | Violates User Story 3 priority (can ship US1+2 first in tasks) |

## 6. SMS confirmation

**Decision**: Edge Function invokes shared `sendTwilioSms()` after successful RPC; on failure,
append to `notes` and insert `ivr_call_events` row with `outcome = 'sms_failed'`.

**Rationale**: Matches constitution Principle V (no silent drops). Reuses proven pattern from
delivery tracking function.

## 7. Twilio request validation

**Decision**: Validate `X-Twilio-Signature` on every webhook using auth token + full URL +
POST body (Twilio helper algorithm in `_shared/twilio.ts`).

**Rationale**: Public Edge Function URL must reject forged requests that would create pending rows.

## 8. Staff UI scope

**Decision**: Add `intake_channel` badge on `RecipientsPage` pending cards only; no edit form
changes in v1.1 IVR MVP.

**Rationale**: Spec assumption — coordinators complete address in existing edit flow (future task
if edit UI missing fields today).
