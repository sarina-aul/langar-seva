# Feature Specification: Phone-First IVR Intake

**Feature Branch**: `001-ivr-intake`

**Created**: 2026-06-27

**Status**: Draft

**Input**: User description: "Phone-first IVR intake that creates pending recipient rows and sends plain-language SMS confirmation"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Request langar by phone (Priority: P1)

An elderly recipient calls the langar hotline, hears a short menu in their language, presses 1 to
request a meal, and receives an SMS confirming the request was received. A coordinator later
calls to collect the full address — the caller does not need to type or use a browser.

**Why this priority**: Phone is the primary intake channel for seniors who cannot use the web form;
without this, they depend on a family member or coordinator manual entry.

**Independent Test**: Place a test call, press 1, verify a pending recipient record exists with
caller phone number and an SMS confirmation is delivered within 2 minutes.

**Acceptance Scenarios**:

1. **Given** a caller on the langar hotline during business hours, **When** they press 1 after
   the main prompt, **Then** a new recipient row is created with `status = pending`, caller phone
   captured, and default placeholders for address fields the IVR does not collect.
2. **Given** a successful IVR request, **When** the call ends, **Then** the caller receives SMS:
   plain-language confirmation that a coordinator will call to confirm their address.
3. **Given** a coordinator in the staff app, **When** they open pending recipients, **Then** the
   IVR-created row appears alongside web intake rows for the same review workflow.

---

### User Story 2 - After-hours request capture (Priority: P2)

A recipient calls outside coordinator hours, completes the IVR request, and receives SMS that
their request was received and a coordinator will follow up — without reaching a live person.

**Why this priority**: Many seniors call evenings or weekends; capturing intent prevents lost
requests without requiring 24/7 staffing.

**Independent Test**: Call after configured hours, complete press-1 flow, verify pending row and
SMS identical to business-hours behavior.

**Acceptance Scenarios**:

1. **Given** a call outside coordinator availability, **When** the caller presses 1, **Then** the
   same pending row and SMS confirmation flow runs (no “call back during hours” dead end).
2. **Given** an after-hours IVR request, **When** coordinators open the dashboard next business
   day, **Then** the pending row is visible with call timestamp for prioritization.

---

### User Story 3 - Language selection on IVR (Priority: P3)

A caller selects English, Punjabi, or Hindi at the start of the call; menu prompts and SMS
confirmation use that language (or bilingual plain wording where full translation is deferred).

**Why this priority**: Aligns with community language mix documented in elderly-friendly UI guidance;
reduces hang-ups from English-only menus.

**Independent Test**: Complete intake with each language option; verify prompts match selection
and SMS uses the chosen language template.

**Acceptance Scenarios**:

1. **Given** the opening language menu, **When** the caller selects Punjabi, **Then** subsequent
   menu prompts for the press-1 flow are spoken in Punjabi (or pre-recorded Punjabi clips).
2. **Given** Hindi language selection, **When** request completes, **Then** SMS confirmation uses
   the Hindi template stored in the language preference on the recipient row.

---

### Edge Cases

- What happens when the caller hangs up before pressing 1? No recipient row is created; no SMS sent.
- What happens when the same phone number requests again within 24 hours? System creates a new
  pending row OR surfaces duplicate warning to coordinator (default: allow duplicate pending rows
  with note — coordinator merges manually).
- What happens when SMS delivery fails (invalid number, carrier block)? Request row still created;
  coordinator sees SMS failure flag and calls recipient by phone.
- What happens when caller ID is blocked or unavailable? IVR prompts caller to enter phone number
  via keypad before completing request.
- What happens when database insert fails mid-call? Caller hears retry message; no SMS until insert
  succeeds.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST answer inbound calls to the langar hotline with a language selection
  menu followed by a main menu including “Press 1 to request langar.”
- **FR-002**: System MUST create a recipient record with `status = pending` when the caller
  completes the press-1 flow, capturing at minimum: phone number, language preference, intake
  channel marker (IVR), and timestamp.
- **FR-003**: System MUST send a plain-language SMS confirmation after successful pending row
  creation stating that the request was received and a coordinator will call to confirm address.
- **FR-004**: System MUST NOT require the caller to enter full street address, postal code, or
  household size during IVR (coordinator completes in staff app).
- **FR-005**: IVR-created pending rows MUST appear in the same coordinator review queue as web
  intake pending rows.
- **FR-006**: System MUST support after-hours operation without live coordinator pickup for the
  press-1 intake path.
- **FR-007**: System MUST log call outcome (completed, abandoned, failed) for coordinator audit.

### Key Entities *(include if feature involves data)*

- **Recipient (pending)**: Person requesting langar; IVR supplies phone, language, channel=IVR,
  status=pending; address and meal fields deferred to coordinator.
- **IVR call session**: Ephemeral call state (language choice, digits pressed, caller ID) linking
  to the created recipient row on completion.

### Non-Functional Requirements *(constitution-driven)*

- **NFR-SEC**: Public IVR path MAY only create `pending` rows; it MUST NOT read or modify
  existing recipient records. Staff roles unchanged.
- **NFR-UX**: Menu depth MUST NOT exceed 3 levels; SMS MUST match plain-language templates in
  `docs/elderly-friendly-ui.md`; terminology consistent with existing status SMS patterns.
- **NFR-TEST**: RLS verification extended for any new intake path; call-flow test plan documented;
  lint/build unaffected but SMS/Edge Function failure paths manually verified.
- **NFR-PERF**: Call menu response under 2 seconds; SMS sent within 2 minutes of call completion
  at pilot volume.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 90% of test callers complete press-1 request in under 60 seconds without human help.
- **SC-002**: 95% of completed IVR requests receive SMS confirmation within 2 minutes.
- **SC-003**: 100% of IVR-created rows appear in coordinator pending queue within 30 seconds of
  call completion.
- **SC-004**: Coordinator follow-up call resolves address for IVR pending rows at same rate as
  incomplete web submissions (qualitative pilot metric).

## Assumptions

- Twilio (or equivalent) provides both voice IVR and SMS; phone number is already provisioned for
  pilot.
- Coordinators continue to complete address and approve/reject in the existing staff app — no new
  coordinator UI required for v1 of IVR beyond optional “intake channel” label.
- Punjabi/Hindi prompts may use pre-recorded audio or text-to-speech; full professional voice
  recording is a polish item, not a pilot blocker.
- IVR is post-pilot Tier 3 per `docs/elderly-friendly-ui.md` but spec is ready for v1.1 scheduling.
- Duplicate pending rows from repeat callers are acceptable; coordinator deduplicates manually.
