# Feature Specification: Langar Seva Platform (v1 Pilot)

**Feature Branch**: `000-langar-seva-platform` (reference — not a git branch)

**Created**: 2026-06-27

**Updated**: 2026-07-31

**Status**: Active reference (as-built + pilot scope)

**Input**: Platform overview for the Seva Eats / Langar Seva web + Supabase stack

**Implementation note**: Feature specs `002`–`006` are **shipped in code**. Pilot go-live is
blocked on ops: production migrations, Edge Function deploys, and **Twilio secrets on Supabase**
(see [docs/go-live-checklist.md](../../docs/go-live-checklist.md)). Built-vs-specs audit:
[GitHub #17](https://github.com/sarina-aul/langar-seva/issues/17). IVR (`001`) has Edge Function
+ migration locally but is **not live** (v1.1).

## Product summary

Langar Seva is a **multi-channel operations platform** for free langar meal delivery. Coordinators
run intake review, kitchen batches, manual dispatch, and delivery-day SMS from a staff web app.
Recipients request meals via web (today) or phone IVR (planned v1.1); sevadars use SMS magic
links for route sheets without staff login.

**Framing:** *Operations platform for coordinators, with phone-first intake for seniors and
web/SMS for everyone else.* (see `docs/elderly-friendly-ui.md`)

## Actors

| Actor | Primary channel | Goal |
|-------|-----------------|------|
| Elderly recipient | Phone (future IVR) or caregiver web | Request langar with minimal friction |
| Caregiver / family | Web intake `/` | Submit full details on someone's behalf |
| Coordinator | Staff app `/staff/*` | Approve requests, dispatch routes, handle exceptions |
| Kitchen staff | `/staff/kitchen` | Advance batch stages, meal counts |
| Sevadar (driver) | SMS route magic link `/driver/route/:token` | Deliver stops, update status |
| Recipient (delivery day) | SMS + `/track/:token` | Plain-language delivery status |

## End-to-end flow (v1 pilot)

```mermaid
flowchart LR
  intake[Intake web or staff] --> pending[pending recipients]
  pending --> approve[Coordinator approves]
  approve --> kitchen[Kitchen batch to ready]
  kitchen --> dispatch[Manual route bundles]
  dispatch --> driverSms[Sevadar route SMS]
  dispatch --> clientSms[Client tracking SMS]
  driverSms --> stops[Stop updates]
  stops --> tracking[Client tracking page]
```

**Pilot constraints** (`docs/go-live-checklist.md`): manual dispatch, 10–20 stops, 2–3 sevadars,
one batch; no auto route optimizer, no live GPS.

**As-built readiness (2026-07-31):** Coordinator UI loop works in local/dev. SMS Edge Functions
use Twilio when configured and fall back to `logged` / clipboard when not. Dispatch surfaces
SMS failures as retryable. Production Twilio + deploys still required before live recipients.

## User Scenarios & Testing *(platform-level)*

### User Story 1 - Recipient requests a meal (Priority: P1)

A community member submits an intake request without creating an account and sees confirmation
that a coordinator will review it.

**Independent Test**: Submit web form at `/`; row in `recipients` with `status = pending`; confirmation UI.

**Linked spec**: [002-recipient-web-intake](../002-recipient-web-intake/spec.md) — **Shipped**

---

### User Story 2 - Coordinator runs delivery day (Priority: P1)

A coordinator logs in, approves pending households, marks kitchen ready, builds routes, sends
SMS links, and monitors delivery progress (including failed SMS retries).

**Independent Test**: Full path login → recipients → kitchen → dispatch → tracking SMS.

**Linked specs**: [004-coordinator-recipients](../004-coordinator-recipients/spec.md),
[005-kitchen-batch](../005-kitchen-batch/spec.md),
[006-dispatch-delivery-tracking](../006-dispatch-delivery-tracking/spec.md) — **Shipped (ops remaining)**

---

### User Story 3 - Kitchen tracks tonight's batch (Priority: P2)

Kitchen admin advances batch stages and meal counts; coordinator receives ready notification.

**Independent Test**: Login as `kitchen@example.com`; advance batch; coordinator sees banner.

**Linked spec**: [005-kitchen-batch](../005-kitchen-batch/spec.md) — **Shipped**

---

### User Story 4 - Sevadar delivers without staff login (Priority: P2)

Driver opens route from SMS link, updates stops; recipients see status on tracking page.

**Independent Test**: Magic link opens single route only; stop update reflects on `/track/:token`.

**Linked spec**: [006-dispatch-delivery-tracking](../006-dispatch-delivery-tracking/spec.md) — **Shipped**

---

### User Story 5 - Phone-first intake (Priority: P3 — v1.1)

Elderly caller presses 1 on hotline; pending row + SMS; coordinator completes address by phone.

**Independent Test**: See [001-ivr-intake](../001-ivr-intake/spec.md)

**Status**: Spec + local code (`twilio-ivr-voice`, `ivr_intake` migration) exist; **not production-validated**.

## Requirements *(platform)*

### Functional Requirements

- **FR-P01**: System MUST support anonymous recipient intake with RLS limiting anon to `pending` INSERT only. ✅
- **FR-P02**: System MUST support invite-only staff auth with roles `coordinator` and `kitchen_admin` via `app_metadata.role`. ✅
- **FR-P03**: All intake channels MUST write to the same `recipients` table and share coordinator review (`web` / `staff` live; `ivr` ready, not live). ✅ / ⏳
- **FR-P04**: Coordinators MUST approve or reject pending requests before dispatch assignment. ✅
- **FR-P05**: Kitchen MUST expose batch stage workflow through ready/dispatched lifecycle. ✅
- **FR-P06**: Dispatch MUST support manual route bundles and SMS for driver + client tracking links. ✅ (code)
- **FR-P07**: SMS MUST use plain language; failures MUST be logged to `delivery_notifications` **and surfaced in dispatch UI** (retryable). ✅ (code; prod Twilio pending)

### Non-Functional Requirements *(constitution-driven)*

- **NFR-P-SEC**: RLS on all tables; service role only in Edge Functions; see constitution Principle I.
- **NFR-P-UX**: Recipient UX follows `docs/elderly-friendly-ui.md`; shared labels in `recipientLabels.ts`.
- **NFR-P-TEST**: `npm run lint` + `npm run build`; SQL scripts under `scripts/` for RLS and tracking (T01–T19).
- **NFR-P-PERF**: Responsive at pilot scale (10–20 stops); client tracking refreshes within seconds while visible.

### Key Entities

- **Recipient** — intake + approval lifecycle (`pending` → `approved` / `rejected` → delivery); `intake_channel`
- **Batch** — kitchen production run for a date
- **Dispatch route** — coordinator-built bundle assigned to a sevadar
- **Route stop / delivery tracking** — per-recipient delivery state and client token
- **Driver route link** — hashed magic link scoped to one route
- **Delivery notification** — SMS audit (`sent` / `failed` / `skipped` / `logged`)

## Success Criteria *(pilot)*

- **SC-P01**: Coordinator completes intake → dispatch → tracking loop in one session without DB edits. ✅ (local)
- **SC-P02**: Anonymous users cannot read or modify existing recipient rows (verified by SQL tests). ✅ (suite present)
- **SC-P03**: Real SMS sends succeed for pilot test phones when Twilio configured. ⏳ ops
- **SC-P04**: Go-live checklist Week 1–2 items pass on staging before production pilot. ⏳ ops

## Technology stack

| Layer | Choice |
|-------|--------|
| Frontend | React 19, Vite, TypeScript (`web/`) |
| Backend | Supabase Postgres, Auth, Realtime, Edge Functions |
| SMS / Voice | Twilio (SMS Edge Functions shipped; Voice in 001-ivr-intake, not live) |
| Design | Magic Patterns handoff per `INTEGRATION.md` |

## Out of scope (v1 pilot)

- Auto route optimizer
- Live driver GPS map
- Full postal-code routing catalog / capacity engine (postal fields + readiness warnings exist)
- Multi-gurdwara / multi-city
- Public staff signup
- Full recipient UI i18n (language preference captured for coordinator callback)
- Live IVR hotline (v1.1)

## Assumptions

- Single gurdwara / local pilot geography
- Coordinators available to complete IVR-incomplete records by phone (when IVR ships)
- Supabase local dev uses Docker; production on linked Supabase project
- Twilio Account SID / Auth Token / From number set as Edge Function secrets before real SMS

## Feature spec map

See [`specs/README.md`](../README.md) for the full catalog and Speckit workflow.
