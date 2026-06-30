# Data Model: Phone-First IVR Intake

**Feature**: 001-ivr-intake | **Date**: 2026-06-27

## Schema changes

### Enum: `public.intake_channel`

```sql
create type public.intake_channel as enum ('web', 'ivr', 'staff');
```

### Table: `public.recipients` (alter)

| Column | Change | Notes |
|--------|--------|-------|
| `intake_channel` | ADD `intake_channel not null default 'web'` | Backfill existing rows as `'web'` |
| `sms_confirmation_status` | ADD nullable text | `'sent'`, `'failed'`, `'skipped'` — optional v1.1 column for coordinator visibility |

Existing columns unchanged. IVR inserts use RPC-controlled placeholders (see research.md).

### Table: `public.ivr_call_events` (new)

Audit log for FR-007; coordinators do not query in v1 UI.

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| `id` | uuid PK | ✓ | `gen_random_uuid()` |
| `created_at` | timestamptz | ✓ | default `now()` |
| `call_sid` | text | ✓ | Twilio CallSid, unique index |
| `from_phone` | text | ✓ | E.164 normalized |
| `language` | language_pref | ✓ | Selected menu language |
| `outcome` | text | ✓ | `completed`, `abandoned`, `failed`, `sms_failed` |
| `recipient_id` | uuid FK → recipients | — | Set on successful insert |
| `error_message` | text | — | RPC or SMS failure detail |

**RLS**: Enabled; no policies for `anon`/`authenticated`. Edge Function uses `service_role` only.

## RPC: `public.create_ivr_pending_recipient`

**Signature**:

```sql
create_ivr_pending_recipient(
  p_phone text,
  p_language public.language_pref,
  p_call_sid text
) returns uuid
```

**Behavior**:

1. Normalize `p_phone` to E.164 (strip non-digits; assume +1 if 10 digits — document in quickstart).
2. Insert `recipients` row with placeholders, `status = 'pending'`, `intake_channel = 'ivr'`.
3. Insert `ivr_call_events` with `outcome = 'completed'` and `recipient_id`.
4. Return new `recipients.id`.
5. On error: log `ivr_call_events` with `outcome = 'failed'`; re-raise.

**Security**: `SECURITY DEFINER`; `GRANT EXECUTE` to `service_role` only.

## Entity relationships

```text
Twilio Call (CallSid)
    │
    ▼
ivr_call_events ──optional FK──► recipients (pending)
                                      │
                                      ▼
                              coordinator approve/reject
                              (existing workflow)
```

## State transitions

### Recipient (IVR-created)

```text
[pending] ──coordinator completes address + approve──► [approved] ──► … (existing)
         └──coordinator reject────────────────────────► [rejected]
```

IVR never transitions status beyond initial `pending` insert.

### IVR call session (ephemeral → audit)

```text
inbound call → language select → main menu → (gather phone if blocked CID) → RPC insert → SMS → hangup
                    │                │
                    └── hangup ──────┴──► ivr_call_events.outcome = 'abandoned' (no recipient row)
```

## Validation rules

- `p_phone` MUST match `^\+[1-9]\d{6,14}$` after normalization.
- `p_language` MUST be one of `english`, `punjabi`, `hindi` for IVR MVP (reject `urdu`/`other` at menu).
- Duplicate `call_sid` completing twice MUST be idempotent (return existing `recipient_id`).
- `meals <= household_size` satisfied by both defaulting to 1.

## TypeScript updates

Add to `web/src/types/database.ts`:

```typescript
export type IntakeChannel = 'web' | 'ivr' | 'staff'
```

Extend `RecipientRow` / `RecipientInsert` with optional `intake_channel`.
