# Delivery Tracking Next Steps

## Goal

Turn the current delivery tracking demo into a real operating flow:

Coordinator assigns a route, the sevadar receives a private route link, the sevadar updates stop progress, and each client sees a private package-style status page with an ETA window.

## Phase 1: Driver Access

Build a driver/sevadar route access model before exposing route updates outside staff accounts.

- Add secure driver magic links for assigned routes.
- Store route-link token hashes, expiry, revocation, and last viewed timestamps.
- Scope driver access to one assigned route only.
- Let coordinators resend or revoke driver route links.
- Keep the existing staff-authenticated driver page as the coordinator fallback.

Acceptance criteria:

- A sevadar can open only their assigned route from a private link.
- Invalid, expired, or revoked driver links show no route data.
- A driver route page does not expose other routes or coordinator-only information.

## Phase 2: Real SMS Sending

Deploy the SMS provider boundary so coordinators can send real tracking links.

- Configure Twilio or another SMS provider for Edge Functions.
- Keep provider secrets server-side only.
- Send driver route links and client tracking links through server-side functions.
- Log every send attempt in notification/audit tables.
- Surface SMS failures in the coordinator dispatch page.

Acceptance criteria:

- Coordinator can send a real SMS for a route or delivery stop.
- Failed sends are visible and retryable.
- Development mode can still log links without sending SMS.

## Phase 3: Stop Workflow Polish

Make delivery updates operationally useful for sevadars and coordinators.

- Add coordinator actions for resend tracking link, revoke link, mark delayed, and update ETA.
- Add driver actions for on the way, nearby, delivered, unable to contact, skipped, and delayed.
- Add client-safe note validation so private notes do not leak to tracking pages.
- Add simple ETA recalculation when a previous stop is completed or delayed.

Acceptance criteria:

- Updating a stop changes the client tracking page within seconds.
- Client pages never show driver phone, exact location, full route, or other stops.
- Coordinators can resolve common exceptions without editing database rows.

## Phase 4: Security And Test Coverage

Lock down the access model before any production rollout.

- Run and expand `scripts/test-delivery-tracking.sql`.
- Add tests for driver route token isolation.
- Add tests for expired and revoked client tracking links.
- Verify anonymous users cannot read raw recipients, sevadars, routes, route stops, or notification tables.
- Verify tracking RPCs return only redacted fields.

Acceptance criteria:

- Local SQL tests pass against Supabase.
- No raw PII or route data is exposed through anonymous access.
- Token hashes are stored, but raw tokens are never persisted.

## Phase 5: Routing Data Quality

Prepare the app for real route planning instead of manual route bundles.

- Add postal-code fields for recipients.
- Add home postal-code or service-area fields for sevadars.
- Add service zones or postal-code area catalog.
- Add sevadar capacity and availability.
- Add coordinator data-quality warnings for missing postal code, phone, or text consent.

Acceptance criteria:

- Every approved delivery can be evaluated for routing readiness.
- Coordinators can see why a recipient or sevadar cannot be included in route planning.

## Phase 6: Route Optimizer

Build the route suggestion engine after tracking and access are stable.

- Generate suggested route bundles from Glidden Gurdwara to delivery stops.
- Group stops by postal area and delivery window.
- Respect sevadar capacity and availability.
- Keep coordinator review and manual override before routes are finalized.
- Add rebalance suggestions for driver cancellation before pickup.

Acceptance criteria:

- Coordinator can generate suggested routes for a batch.
- Suggested routes explain why stops were assigned.
- Manual route creation remains available as a fallback.

## Immediate Recommendation

Build driver magic links and real SMS next. That completes the end-to-end loop:

1. Coordinator creates a route.
2. Sevadar receives a route link by SMS.
3. Sevadar updates pickup and stop progress.
4. Client receives private tracking updates by SMS link.
5. Coordinator can monitor exceptions from dispatch.
