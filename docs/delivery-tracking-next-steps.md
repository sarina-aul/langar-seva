# Delivery Tracking Next Steps

## Goal

Turn the current delivery tracking demo into a real operating flow:

Coordinator assigns a route, the sevadar receives a private route link, the sevadar updates stop progress, and each client sees a private package-style status page with an ETA window.

## Phase status

| Phase | Status | Notes |
|-------|--------|-------|
| 1 Driver access | **Done** | Magic links, revoke/resend, scoped public page, staff fallback, SQL T09–T17 |
| 2 Real SMS | **Code done** | Edge Functions + failure logging + dispatch UI. Prod Twilio / deploy still ops |
| 3 Stop workflow polish | **Done (v1)** | Revoke client link, mark delayed, +15 ETA, driver ETA recalc on later stops |
| 4 Security / tests | **Expanded** | `scripts/test-delivery-tracking.sql` T01–T19 — run on staging before pilot |
| 5 Routing data quality | **Partial** | Postal fields + dispatch readiness warnings; zones/capacity deferred |
| 6 Route optimizer | **Deferred** | Out of pilot scope (v2) |

## Phase 1: Driver Access

Build a driver/sevadar route access model before exposing route updates outside staff accounts.

- [x] Add secure driver magic links for assigned routes.
- [x] Store route-link token hashes, expiry, revocation, and last viewed timestamps.
- [x] Scope driver access to one assigned route only.
- [x] Let coordinators resend or revoke driver route links.
- [x] Keep the existing staff-authenticated driver page as the coordinator fallback.

Acceptance criteria:

- A sevadar can open only their assigned route from a private link.
- Invalid, expired, or revoked driver links show no route data.
- A driver route page does not expose other routes or coordinator-only information.

## Phase 2: Real SMS Sending

Deploy the SMS provider boundary so coordinators can send real tracking links.

- [x] Configure Twilio helper for Edge Functions (secrets server-side only).
- [x] Send driver route links and client tracking links through server-side functions.
- [x] Log every send attempt in `delivery_notifications` (including driver route rows).
- [x] Surface SMS failures in the coordinator dispatch page (retryable).
- [ ] Configure Twilio env vars on **production** Supabase and deploy functions.

Acceptance criteria:

- Coordinator can send a real SMS for a route or delivery stop.
- Failed sends are visible and retryable.
- Development mode can still log links without sending SMS.

## Phase 3: Stop Workflow Polish

Make delivery updates operationally useful for sevadars and coordinators.

- [x] Coordinator: resend tracking link, revoke link, mark delayed, bump ETA (+15 min).
- [x] Driver actions: on the way, nearby, delivered, unable to contact, skipped, delayed.
- [x] Client-safe note validation so private notes do not leak to tracking pages.
- [x] ETA recalculation for later stops when a prior stop is completed or delayed.
- [x] Tracking page refreshes every 5s while visible.

Acceptance criteria:

- Updating a stop changes the client tracking page within seconds.
- Client pages never show driver phone, exact location, full route, or other stops.
- Coordinators can resolve common exceptions without editing database rows.

## Phase 4: Security And Test Coverage

Lock down the access model before any production rollout.

- [x] Expand `scripts/test-delivery-tracking.sql` (driver isolation + revoke client + driver SMS audit).
- [ ] Run suite against staging/prod before first live day.
- [x] Verify anonymous users cannot read raw recipients, sevadars, routes, route stops, or notification tables (T01+).
- [x] Verify tracking RPCs return only redacted fields.

Acceptance criteria:

- Local SQL tests pass against Supabase.
- No raw PII or route data is exposed through anonymous access.
- Token hashes are stored, but raw tokens are never persisted.

## Phase 5: Routing Data Quality

Prepare the app for real route planning instead of manual route bundles.

- [x] Add postal-code fields for recipients.
- [x] Add home postal-code fields for sevadars.
- [ ] Add service zones or postal-code area catalog.
- [ ] Add sevadar capacity and availability.
- [x] Coordinator data-quality warnings for missing postal code, phone, or text consent.

Acceptance criteria:

- Every approved delivery can be evaluated for routing readiness.
- Coordinators can see why a recipient or sevadar cannot be included in route planning.

## Phase 6: Route Optimizer

Build the route suggestion engine after tracking and access are stable. **Out of pilot scope.**

- Generate suggested route bundles from Glidden Gurdwara to delivery stops.
- Group stops by postal area and delivery window.
- Respect sevadar capacity and availability.
- Keep coordinator review and manual override before routes are finalized.
- Add rebalance suggestions for driver cancellation before pickup.

## Immediate recommendation (ops)

Code for the end-to-end loop is in place. Finish production readiness via [go-live-checklist.md](go-live-checklist.md):

1. Apply delivery + notification migrations to production.
2. Deploy `send-delivery-tracking-sms` and `send-driver-route-sms`.
3. Set Twilio secrets on Supabase.
4. Bug bash the nine-step path with test phones.
5. Run `scripts/test-delivery-tracking.sql` on staging.
