# Quickstart: Validate IVR Intake

End-to-end validation for feature 001-ivr-intake. See [data-model.md](./data-model.md) and
[contracts/](./contracts/) for details.

## Prerequisites

- Supabase local: `supabase start && supabase db reset`
- Twilio account with Voice + SMS on one number
- ngrok or Supabase deployed project URL for webhook
- Env secrets on Edge Functions:
  - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
  - `LANGAR_HOTLINE_DISPLAY` (optional)

## 1. Apply migration

```bash
cd ~/langar-seva
supabase db reset   # or supabase migration up after adding ivr migration
```

Verify enum and RPC:

```bash
psql "$DATABASE_URL" -f scripts/test-ivr-intake.sql
```

Expected: all tests PASS (RPC creates pending row; anon cannot execute RPC).

## 2. Deploy Edge Function locally

```bash
supabase functions serve twilio-ivr-voice --env-file supabase/.env.local
```

Note the local URL: `http://127.0.0.1:54321/functions/v1/twilio-ivr-voice`

## 3. Configure Twilio number

In Twilio Console → Phone Number → Voice:

- **A call comes in**: Webhook `POST` → `{PUBLIC_URL}/functions/v1/twilio-ivr-voice`
- Method: POST

For local dev, run `ngrok http 54321` and use ngrok HTTPS URL.

## 4. Happy-path test call (User Story 1)

1. Call the Twilio number from a mobile phone.
2. Press `1` (English) → `1` (request langar).
3. Within 2 minutes, receive SMS confirmation.
4. Open staff app → Recipients → Pending.
5. Confirm new row:
   - Phone matches caller
   - `intake_channel` shows **Phone (IVR)** badge
   - Address shows placeholder text
   - Language = English

**Pass criteria**: SC-001 (< 60s call), SC-002 (SMS < 2 min), SC-003 (row visible < 30s).

## 5. After-hours test (User Story 2)

Repeat step 4 outside coordinator hours (or any time — flow is identical).

**Pass**: Same behavior; no “call back during business hours” message.

## 6. Language test (User Story 3)

Call again; select Punjabi (`2`) then `1`. Verify SMS uses Punjabi template.

## 7. Edge case spot checks

| Scenario | Steps | Expected |
|----------|-------|----------|
| Hang up early | Disconnect at language menu | No recipient row; optional `abandoned` event |
| Blocked caller ID | Call from blocked number | Prompt to enter phone digits |
| SMS failure | Unset Twilio creds temporarily | Row created; coordinator sees failure in notes |
| Duplicate call | Complete twice same CallSid | Single recipient row (idempotent) |

## 8. Frontend regression

```bash
cd web
npm run lint
npm run build
```

## 9. Coordinator completion

1. Open pending IVR row.
2. Update name, address, household size via staff workflow.
3. Approve → verify existing approve flow unchanged.

## Troubleshooting

- **403 on webhook**: Check Twilio signature validation URL matches public URL exactly.
- **RLS error on insert**: RPC must use service role — never anon from Edge Function.
- **No SMS**: Check function logs; verify `TWILIO_*` env vars in `supabase secrets list`.
