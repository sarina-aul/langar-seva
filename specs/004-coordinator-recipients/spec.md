# Feature Specification: Coordinator Recipient Review

**Feature Branch**: `004-coordinator-recipients`

**Created**: 2026-06-27

**Status**: Shipped (v1 as-built)

**Input**: Coordinator dashboard to review, approve, and reject pending intake requests

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Review pending queue (Priority: P1)

Coordinator opens `/staff/recipients`, filters pending requests, and sees intake details.

**Independent Test**: Seed pending rows; login as coordinator; pending tab shows cards with address, meals, language.

**Acceptance Scenarios**:

1. **Given** pending recipients exist, **When** coordinator opens Pending tab, **Then** all pending rows visible.
2. **Given** coordinator selects Approve, **When** action completes, **Then** status becomes `approved`.
3. **Given** coordinator selects Reject, **When** action completes, **Then** status becomes `rejected`.

---

### User Story 2 - Pending count on staff home (Priority: P2)

Staff home shows pending count badge for coordinators.

**Independent Test**: Pending count updates when new intake submitted (Realtime/hook).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Page MUST be coordinator-only (`requiredRole="coordinator"`).
- **FR-002**: Filters MUST include pending, approved, rejected, all.
- **FR-003**: Labels MUST use `recipientLabels.ts` for window, language, frequency, status.
- **FR-004**: Approve/reject MUST update via authenticated Supabase client under RLS.

### Non-Functional Requirements

- **NFR-SEC**: Only coordinators SELECT/UPDATE recipients per RLS policies.
- **NFR-UX**: Plain display of address and contact info for callback.

## Success Criteria *(mandatory)*

- **SC-001**: Approve/reject reflected in DB within 5 seconds.
- **SC-002**: Non-coordinators cannot list recipients (RLS + UI).

## Assumptions

- Coordinator completes missing fields for partial intakes (future IVR) in same UI or edit flow.

**Implementation**: `web/src/pages/RecipientsPage.tsx`, `hooks/usePendingRecipientCount.ts`
