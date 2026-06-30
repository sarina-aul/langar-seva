# Contract: Twilio Voice Webhook (`twilio-ivr-voice`)

**Endpoint**: `POST /functions/v1/twilio-ivr-voice`  
**Content-Type**: `application/x-www-form-urlencoded` (Twilio default)  
**Response**: `application/xml` (TwiML)

## Authentication

- MUST validate `X-Twilio-Signature` header before processing.
- Return `403` plain text on invalid signature.
- No Supabase JWT required (Twilio is the caller).

## Request parameters (Twilio standard)

| Param | Always present | Usage |
|-------|----------------|-------|
| `CallSid` | ✓ | Idempotency key for recipient creation |
| `From` | ✓ | Caller phone (may be blocked → trigger gather) |
| `To` | ✓ | Langar hotline number |
| `Digits` | On `<Gather>` | Menu selection |
| `CallStatus` | Status callbacks | Optional: log abandoned |

## Query string state (app-controlled)

| Param | Values | Description |
|-------|--------|-------------|
| `step` | `lang`, `menu`, `gather_phone`, `complete` | Flow position |
| `lang` | `en`, `pa`, `hi` | Selected language (maps to `language_pref`) |

## Flow contract

### Step: `lang` (default entry)

**Input**: No `Digits` → play language menu  
**Gather**: 1 digit, timeout 5s, 1 retry

```xml
<Gather action="?step=menu" numDigits="1">
  <Say>Press 1 for English. Press 2 for Punjabi. Press 3 for Hindi.</Say>
</Gather>
```

**Digits mapping**: `1→en`, `2→pa`, `3→hi` (redirect to `?step=menu&lang={code}`)

### Step: `menu`

**Gather**: 1 digit

```xml
<Gather action="?step=complete&lang={lang}" numDigits="1">
  <Say language="{twilio-locale}">Press 1 to request langar delivery.</Say>
</Gather>
```

- Digit `1` → proceed to `complete`
- Other / timeout → `Say` goodbye, `Hangup`

### Step: `gather_phone`

When `From` is empty, `anonymous`, or invalid E.164:

**Gather**: 10 digits + leading country code prompt

Redirect to `?step=complete&lang={lang}&phone={GatheredDigits}`

### Step: `complete`

**Server actions** (before TwiML response):

1. Resolve phone from `From` or `phone` query param
2. Call `create_ivr_pending_recipient(phone, language, CallSid)`
3. Send SMS via `sendTwilioSms` with template for `lang`
4. On SMS failure: update notes / event outcome `sms_failed` (recipient row still created)

**Response TwiML**:

```xml
<Response>
  <Say language="{twilio-locale}">
    Thank you. Your request has been received. A coordinator will call you to confirm your address.
  </Say>
  <Hangup/>
</Response>
```

## Error responses

| Condition | HTTP | Body |
|-----------|------|------|
| Invalid signature | 403 | `Forbidden` |
| RPC failure | 200 TwiML | `<Say>We could not save your request. Please try again later.</Say><Hangup/>` |
| Wrong method | 405 | JSON error |

## Status callback (optional phase)

`POST` with `CallStatus=completed|busy|no-answer` → insert/update `ivr_call_events` if no
recipient linked and outcome still open.
