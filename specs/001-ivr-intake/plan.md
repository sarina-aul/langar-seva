# Implementation Plan: Phone-First IVR Intake

**Branch**: `001-ivr-intake` | **Date**: 2026-06-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-ivr-intake/spec.md`

## Summary

Add a Twilio Voice IVR hotline so elderly recipients can press 1 to request langar without a
browser. Inbound call webhooks hit a Supabase Edge Function that returns TwiML menus (language
select → main menu → confirm). On completion, a `SECURITY DEFINER` Postgres RPC inserts a
`pending` recipient with IVR placeholder fields and `intake_channel = 'ivr'`, then triggers
plain-language SMS confirmation via shared Twilio helpers. Coordinators see IVR rows in the
existing pending queue with a channel badge; no new approval workflow.

## Technical Context

**Language/Version**: TypeScript (Deno Edge Functions), SQL (Postgres 15 via Supabase), React 19
(minor staff UI label only)

**Primary Dependencies**: Twilio Voice + SMS (existing env vars), Supabase Edge Functions,
`@supabase/supabase-js` 2.x in Deno

**Storage**: Postgres `recipients` (extended), new `ivr_call_events` audit table

**Testing**: SQL scripts in `scripts/` for RPC + RLS; manual Twilio test call + SMS verification;
`npm run lint` / `npm run build` for staff UI touch

**Target Platform**: Twilio cloud (voice webhook) + Supabase hosted Edge Functions; staff web app

**Project Type**: Multi-channel web + serverless backend (existing stack)

**Performance Goals**: TwiML response < 2s; SMS within 2 minutes; pilot volume ~10 calls/day

**Constraints**: Menu depth ≤ 3; no address collection on call; service role only inside Edge
Function/RPC — never in client; post-pilot v1.1 per go-live checklist

**Scale/Scope**: Single hotline number; English/Punjabi/Hindi menus; after-hours same flow as
business hours

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Reference: `.specify/memory/constitution.md` (Langar Seva v1.0.0)

| Principle | Gate (must pass) | Phase 0 | Phase 1 |
|-----------|------------------|---------|---------|
| I. Security & Data Integrity | RPC insert-only path; no anon Twilio exposure; RLS unchanged for reads | ✅ | ✅ |
| II. Accessible Multi-Channel UX | Plain SMS templates; `INTake_CHANNEL_LABELS` in `recipientLabels.ts`; docs-aligned copy | ✅ | ✅ |
| III. Testing Standards | `scripts/test-ivr-intake.sql`; manual call-flow doc in quickstart | ✅ | ✅ |
| IV. Code Quality & Simplicity | Reuse Twilio SMS pattern; optional staff badge only; no new coordinator screens | ✅ | ✅ |
| V. Performance & Reliability | Stateless TwiML; SMS errors logged on recipient notes + `ivr_call_events` | ✅ | ✅ |

**Phase 0 exit**: All gates pass — no Complexity Tracking entries required.

**Phase 1 exit**: RPC + audit table reviewed; contracts document Twilio signature validation.

## Project Structure

### Documentation (this feature)

```text
specs/001-ivr-intake/
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1 validation guide
├── contracts/           # Twilio webhook + RPC contracts
└── tasks.md             # Phase 2 (/speckit-tasks — not yet created)
```

### Source Code (repository root)

```text
supabase/
├── migrations/
│   └── YYYYMMDD_ivr_intake.sql          # intake_channel enum, RPC, ivr_call_events
├── functions/
│   ├── _shared/
│   │   └── twilio.ts                    # sendSms, validateTwilioSignature (extracted)
│   ├── twilio-ivr-voice/
│   │   └── index.ts                     # TwiML state machine (language, menu, gather phone)
│   └── send-delivery-tracking-sms/
│       └── index.ts                     # refactor to use _shared/twilio.ts

web/src/
├── lib/
│   ├── recipientLabels.ts               # INTAKE_CHANNEL_LABELS
│   └── ivrSmsTemplates.ts               # EN/PA/HI confirmation strings (new)
├── pages/
│   └── RecipientsPage.tsx               # show intake channel on pending cards
└── types/
    └── database.ts                      # IntakeChannel type

scripts/
└── test-ivr-intake.sql                  # RPC + permission tests
```

**Structure Decision**: Voice logic lives entirely in Edge Functions + Postgres RPC; web changes
are limited to displaying intake channel on existing RecipientsPage pending cards.

## Complexity Tracking

> No constitution violations — table intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
