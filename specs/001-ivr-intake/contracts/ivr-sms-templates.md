# Contract: IVR Confirmation SMS Templates

Plain-language SMS sent immediately after successful `create_ivr_pending_recipient`.

**Sender**: `TWILIO_FROM_NUMBER` (same as delivery tracking)

## Template keys

| `language_pref` | Message |
|-----------------|---------|
| `english` | `Langar Seva: We received your meal request. A coordinator will call you soon to confirm your address. Questions? Call {HOTLINE}.` |
| `punjabi` | `Langar Seva: Asi tuhada langar request receive kar liya. Coordinator jald tuhade address di pushti lai call karega.` |
| `hindi` | `Langar Seva: Humne aapki langar request receive kar li. Coordinator jald aapke address ki pushti ke liye call karenge.` |

## Rules

- `{HOTLINE}` replaced with configured display number (env `LANGAR_HOTLINE_DISPLAY`, fallback to
  `TWILIO_FROM_NUMBER` formatted).
- No tracking URL in IVR confirmation (constitution: URL not required to understand status).
- Max 320 chars (single SMS segment target for GSM-7; verify length for Unicode scripts).
- On Twilio error: log full error; set `sms_confirmation_status = 'failed'` if column present;
  do not roll back recipient insert.

## Shared module

Extract `sendTwilioSms(to, body)` to `supabase/functions/_shared/twilio.ts` — used by
`send-delivery-tracking-sms` and `twilio-ivr-voice`.
