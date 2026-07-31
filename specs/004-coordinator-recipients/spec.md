# Feature Specification: Coordinator Recipient Review

**Feature Branch**: `004-coordinator-recipients`

**Created**: 2026-06-27

**Updated**: 2026-07-31

**Status**: Shipped (v1 as-built)

**Input**: Coordinator dashboard to review, approve, and reject pending intake requests

**Implementation note**: Matches [GitHub #17](https://github.com/sarina-aul/langar-seva/issues/17)
(match + extras). Beyond core approve/reject: staff-assisted create/edit via
`StaffRecipientForm`, intake channel badges (`web` / `ivr` / `staff`), IVR SMS failure flag on
cards, and Realtime list updates. Postal code fields supported for routing readiness.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Review pending queue (Priority: P1)

Coordinator opens `/staff/recipients`, filters pending requests, and sees intake details.

**Independent Test**: Seed pending rows; login as coordinator; pending tab shows cards with address, meals, language.

**Acceptance Scenarios**:

1. **Given** pending recipients exist, **When** coordinator opens Pending tab, **Then** all pending rows visible.
2. **Given** coordinator selects Approve, **When** action completes, **Then** status becomes `approved`.
3. **Given** coordinator selects Reject, **When** action completes, **Then** status becomes `rejected`.

**Status**: Implemented.

---

### User Story 2 - Pending count on staff home (Priority: P2)

Staff home shows pending count badge for coordinators.

**Independent Test**: Pending count updates when new intake submitted (Realtime/hook).

**Status**: Implemented (`usePendingRecipientCount`).

---

### User Story 3 - Staff-assisted intake (Priority: P2)

Coordinator creates or edits a pending recipient without using the public form (phone call / walk-in).

**Independent Test**: From `/staff/recipients`, add recipient with `intake_channel = staff`; appears in pending.

**Acceptance Scenarios**:

1. **Given** coordinator on recipients page, **When** they submit staff intake form, **Then** pending row is created with `intake_channel = staff`.
2. **Given** a pending row, **When** coordinator edits fields, **Then** updates persist under RLS.

**Status**: Implemented (`StaffRecipientForm.tsx`).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Page MUST be coordinator-only (`requiredRole="coordinator"`). ✅
- **FR-002**: Filters MUST include pending, approved, rejected, all. ✅
- **FR-003**: Labels MUST use `recipientLabels.ts` for window, language, frequency, status, intake channel. ✅
- **FR-004**: Approve/reject MUST update via authenticated Supabase client under RLS. ✅
- **FR-005**: Coordinators MUST be able to create/edit pending recipients for phone-assisted intake. ✅
- **FR-006**: Non-web intake channels MUST show a channel badge; IVR SMS failure MAY surface on the card. ✅

### Non-Functional Requirements

- **NFR-SEC**: Only coordinators SELECT/UPDATE recipients per RLS policies.
- **NFR-UX**: Plain display of address and contact info for callback; Realtime refresh preferred.

## Success Criteria *(mandatory)*

- **SC-001**: Approve/reject reflected in DB within 5 seconds. ✅
- **SC-002**: Non-coordinators cannot list recipients (RLS + UI). ✅

## Assumptions

- Coordinator completes missing fields for partial intakes (future IVR) in the same staff form.
- Full IVR hotline remains v1.1; staff form covers phone callback capture today.

**Implementation**: `web/src/pages/RecipientsPage.tsx`, `StaffRecipientForm.tsx`,
`hooks/usePendingRecipientCount.ts`, `lib/recipientLabels.ts`
