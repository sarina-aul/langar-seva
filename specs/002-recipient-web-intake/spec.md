# Feature Specification: Recipient Web Intake

**Feature Branch**: `002-recipient-web-intake`

**Created**: 2026-06-27

**Status**: Shipped (v1 as-built)

**Input**: Anonymous web form for langar meal requests at `/`

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Submit intake request (Priority: P1)

A recipient or caregiver opens the public site, completes the intake form, and receives a
“pending review” confirmation without signing in.

**Why this priority**: Core v1 intake path until IVR ships.

**Independent Test**: Visit `/` → Request langar → fill form → submit → confirmation screen;
verify `recipients` row with `status = pending`.

**Acceptance Scenarios**:

1. **Given** a visitor on `/`, **When** they complete required fields and consent, **Then** a
   pending recipient row is inserted via anon Supabase client.
2. **Given** a successful submit, **When** the page updates, **Then** confirmation shows pending
   status without exposing internal IDs unnecessarily.
3. **Given** a staff user logged in, **When** they try to submit the public form, **Then** RLS
   blocks insert (staff must use coordinator tools).

---

### User Story 2 - Return home from form (Priority: P3)

User can go back from the form to the recipient home screen without losing site navigation.

**Independent Test**: Back button on form returns to home; no submit.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Form MUST collect required fields: name, phone, address, unit/buzz, household size,
  meals, delivery window, language; optional frequency, contact preference, notes.
- **FR-002**: Submit MUST set `status = 'pending'` only.
- **FR-003**: `meals` MUST NOT exceed `household_size` (DB constraint + client validation).
- **FR-004**: Consent checkbox MUST be required before submit.
- **FR-005**: Errors MUST be user-friendly (no raw JWT/RLS messages).

### Non-Functional Requirements

- **NFR-SEC**: Anon insert only; no read of existing rows.
- **NFR-UX**: Known gaps documented in `docs/elderly-friendly-ui.md` (wizard, i18n, touch targets).

### Key Entities

- **Recipient** — see platform spec; web intake sets all required columns at submit time.

## Success Criteria *(mandatory)*

- **SC-001**: Submit completes in under 3 minutes for a typical user on mobile.
- **SC-002**: 100% of successful submits create exactly one pending row.
- **SC-003**: Build and lint pass in `web/`.

## Assumptions

- English UI; language field is for coordinator callback preference.
- No geocoding on intake (placeholder columns exist for future).

**Implementation**: `web/src/components/IntakeForm.tsx`, `RecipientHome.tsx`, `Confirmation.tsx`
