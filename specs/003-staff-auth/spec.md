# Feature Specification: Staff Authentication

**Feature Branch**: `003-staff-auth`

**Created**: 2026-06-27

**Updated**: 2026-07-31

**Status**: Shipped (v1 as-built)

**Input**: Invite-only email/password login for kitchen and coordinator staff

**Implementation note**: Matches [GitHub #17](https://github.com/sarina-aul/langar-seva/issues/17)
audit (full match). Extras beyond original stories: optional `?next=` redirect after login;
dev hint when Supabase is unreachable. Roles are read only from `app_metadata.role`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Staff sign in (Priority: P1)

A coordinator or kitchen admin signs in at `/login` and lands on `/staff`.

**Independent Test**: Login with seeded `coordinator@example.com` / `kitchen@example.com`; redirect to staff home.

**Acceptance Scenarios**:

1. **Given** valid credentials, **When** user submits login, **Then** session established and `/staff` loads.
2. **Given** invalid credentials, **When** user submits, **Then** clear error, no session.
3. **Given** no public signup enabled, **When** visitor tries to register, **Then** no signup path exists.

**Status**: Implemented.

---

### User Story 2 - Role-gated routes (Priority: P1)

Coordinators access recipient review and dispatch; kitchen admins access kitchen only.

**Independent Test**: Kitchen user navigating to `/staff/recipients` is blocked.

**Acceptance Scenarios**:

1. **Given** `kitchen_admin` JWT, **When** visiting `/staff/recipients`, **Then** access denied/redirect.
2. **Given** `coordinator` JWT, **When** visiting all staff routes, **Then** access granted per route rules.

**Status**: Implemented (`ProtectedRoute` + `roles.ts`).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Auth MUST use Supabase email/password. ✅
- **FR-002**: Roles MUST come from `app_metadata.role` only (`coordinator`, `kitchen_admin`). ✅
- **FR-003**: `ProtectedRoute` MUST guard `/staff/*` except login. ✅
- **FR-004**: Public intake at `/` MUST remain accessible without login. ✅
- **FR-005**: Optional `?next=` query on `/login` MUST redirect to a safe in-app path after sign-in. ✅ (extra)

### Non-Functional Requirements

- **NFR-SEC**: Never assign roles via `user_metadata`; RLS uses `is_coordinator()` / `is_staff()`.
- **NFR-UX**: Clear credential errors; no public self-registration.

## Success Criteria *(mandatory)*

- **SC-001**: Unauthorized roles cannot reach coordinator-only pages in manual test. ✅
- **SC-002**: Session persists across refresh until logout. ✅

## Assumptions

- Admins create users via Supabase Studio, seed script, or Admin API.
- Production role assignment uses Auth Admin API / Dashboard `app_metadata` only (see root `README.md`).

**Implementation**: `web/src/pages/LoginPage.tsx`, `web/src/pages/StaffHome.tsx`,
`ProtectedRoute.tsx`, `AuthProvider.tsx` / `AuthContext.tsx`, `hooks/useAuth.ts`, `lib/roles.ts`
