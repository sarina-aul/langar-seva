# Feature Specification: Dispatch & Delivery Tracking

**Feature Branch**: `006-dispatch-delivery-tracking`

**Created**: 2026-06-27

**Status**: Shipped (v1 pilot — production Twilio / go-live ops remaining)

**Input**: Manual route bundles, sevadar route magic links, client tracking SMS and status pages

**Implementation note**: Public driver magic link (`/driver/route/:token`), client tracking
(`/track/:token`), `send-driver-route-sms`, `send-delivery-tracking-sms`, driver/client revoke,
SMS failure surfacing in dispatch, and migrations through
`20260731170000_delivery_notification_route_and_revoke.sql` are implemented. Remaining pilot work
is operational: apply migrations + Edge Functions in production and configure Twilio
(see [docs/go-live-checklist.md](../../docs/go-live-checklist.md) and
[GitHub #17](https://github.com/sarina-aul/langar-seva/issues/17)).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Build and assign routes (Priority: P1)

Coordinator assigns approved recipients to routes/sevadars from `/staff/dispatch`.

**Independent Test**: Create route bundle; assign stops; route appears for coordinator.

**Acceptance Scenarios**:

1. **Given** approved recipients, **When** coordinator builds a route, **Then** stops linked to route.
2. **Given** assigned route, **When** coordinator sends driver SMS, **Then** notification logged (sent/failed).

---

### User Story 2 - Client tracking link (Priority: P1)

Recipient receives SMS with private tracking link; opening `/track/:token` shows plain-language status.

**Independent Test**: Send tracking SMS; open token URL; status matches stop state.

**Acceptance Scenarios**:

1. **Given** valid tracking token, **When** client opens link, **Then** only their delivery status shown (no other stops).
2. **Given** invalid/expired token, **When** client opens link, **Then** safe error state, no data leak.

---

### User Story 3 - Sevadar stop updates (Priority: P1)

Driver opens route magic link, marks stops on the way / delivered / unable to contact.

**Independent Test**: Update stop from driver page; tracking page updates.

**Acceptance Scenarios**:

1. **Given** driver link, **When** sevadar opens, **Then** only assigned route visible.
2. **Given** stop marked delivered, **When** client refreshes tracking, **Then** status reflects delivery.

**Status**: Implemented (`PublicDriverRoutePage.tsx`, `driver_route_links`, `send-driver-route-sms`).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Dispatch MUST remain manual (no auto optimizer in v1).
- **FR-002**: Edge Function `send-delivery-tracking-sms` / `send-driver-route-sms` MUST send SMS via Twilio when configured.
- **FR-003**: SMS failures MUST log to `delivery_notifications` and surface in dispatch UI (retryable).
- **FR-004**: Tracking page MUST NOT expose driver phone, full route, or other recipients' stops.
- **FR-005**: Stop statuses MUST include: pending, on_the_way, nearby, delivered, skipped, unable_to_contact, delayed.
- **FR-006**: Coordinators MUST be able to resend/revoke client tracking links and driver route links, mark delayed, and bump ETA from dispatch.

### Non-Functional Requirements

- **NFR-SEC**: Token-based access scoped to single stop/route; run `scripts/test-delivery-tracking.sql`.
- **NFR-UX**: Plain-language status on tracking page and SMS.
- **NFR-TEST**: Expand delivery tracking SQL tests before production pilot (T01–T19).

## Success Criteria *(mandatory)*

- **SC-001**: End-to-end path in go-live checklist completes on staging.
- **SC-002**: SMS send success/failure visible to coordinator on dispatch.
- **SC-003**: Tracking page refreshes within seconds of stop change (5s poll while visible).

## Assumptions

- Twilio env vars on Supabase for production; dev logs SMS when not configured.
- See `docs/delivery-tracking-next-steps.md` for phased hardening checklist.

**Implementation**: `DispatchPage.tsx`, `DriverRoutePage.tsx`, `PublicDriverRoutePage.tsx`,
`TrackingPage.tsx`, `supabase/functions/send-delivery-tracking-sms/`,
`supabase/functions/send-driver-route-sms/`
