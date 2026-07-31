# Feature Specification: Kitchen Batch Workflow

**Feature Branch**: `005-kitchen-batch`

**Created**: 2026-06-27

**Updated**: 2026-07-31

**Status**: Shipped (v1 as-built)

**Input**: Kitchen staff advance batch stages and meal counts; coordinators notified when ready

**Implementation note**: Matches [GitHub #17](https://github.com/sarina-aul/langar-seva/issues/17)
(match + extras). Beyond core stages: prep readiness checkboxes, cooking timer, create-batch form
(coordinator), stage timeline/audit trail. Ready notification banner on staff home links toward
**dispatch** (not kitchen). UI copy states that sevadar SMS links are sent from Dispatch — kitchen
only notifies the coordinator when the batch is ready.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Advance batch stages (Priority: P1)

Kitchen admin opens `/staff/kitchen`, moves batch through prep → cooking → packing → ready → pickup → dispatched.

**Independent Test**: Advance each stage; verify DB `batch_status` and UI labels match `BATCH_STAGE_LABELS`.

**Acceptance Scenarios**:

1. **Given** a batch in `prep`, **When** kitchen clicks next stage action, **Then** status advances sequentially.
2. **Given** batch reaches `ready`, **When** coordinator is logged in, **Then** ready notification banner appears.
3. **Given** kitchen admin role, **When** accessing kitchen page, **Then** meal counts and stage controls available.

**Status**: Implemented.

---

### User Story 2 - Meal count tracking (Priority: P2)

Kitchen records planned vs packed counts and short-count reasons when applicable.

**Independent Test**: Update packed count; persists on refresh.

**Status**: Implemented.

---

### User Story 3 - Create today's batch (Priority: P2)

Coordinator can create the delivery-day batch (menu, planned meals, pickup window, location) when none exists.

**Independent Test**: Empty kitchen day → create batch → appears in `prep`.

**Status**: Implemented (coordinator create form on `KitchenPage`).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Batch stages MUST match enum: prep, cooking, packing, ready, pickup, dispatched. ✅
- **FR-002**: Kitchen page MUST be accessible to `kitchen_admin` and coordinators. ✅
- **FR-003**: Stage changes MUST write audit events where migration defines batch audit. ✅
- **FR-004**: Ready state MUST trigger coordinator notification (Realtime subscription). ✅
- **FR-005**: Ready-state UI MUST NOT claim sevadars were SMS-alerted; driver/client SMS happens in dispatch (`006`). ✅

### Non-Functional Requirements

- **NFR-PERF**: Realtime notification within seconds at pilot scale.
- **NFR-UX**: Clear stage labels from `BATCH_STAGE_LABELS` / descriptions in `database.ts`.

## Success Criteria *(mandatory)*

- **SC-001**: Full stage progression completable without errors in local dev. ✅
- **SC-002**: Coordinator notified when batch hits ready. ✅

## Assumptions

- One primary batch per delivery day for pilot.
- Coordinators can also operate kitchen page if needed.
- Pickup / dispatched transitions may also be driven from Dispatch console during delivery day.

**Implementation**: `web/src/pages/KitchenPage.tsx`, `hooks/useBatchReadyNotification.ts`,
`ReadyNotificationBanner.tsx`, batch migrations under `supabase/migrations/`
