<!--
Sync Impact Report
- Version change: (none) → 1.0.0
- Modified principles: template placeholders → five Langar Seva principles (initial ratification)
- Added sections: Technology Constraints, Development Workflow
- Removed sections: none
- Templates: plan-template.md ✅ updated | spec-template.md ✅ updated | tasks-template.md ✅ updated
- Follow-up TODOs: Vitest unit-test framework adoption (tracked in Principle III)
-->

# Langar Seva Constitution

## Core Principles

### I. Security & Data Integrity

All data access MUST be enforced at the database layer via Supabase Row Level Security (RLS),
not only in the UI.

- Every new table MUST have RLS enabled with explicit policies before merge.
- Anonymous (public) intake MUST only INSERT rows with `status = 'pending'`; anon MUST NOT
  SELECT, UPDATE, or DELETE existing recipient records.
- Staff roles MUST be assigned via `app_metadata.role` only — never `user_metadata`.
- Supported roles (`coordinator`, `kitchen_admin`) MUST be checked in SQL helpers such as
  `public.is_coordinator()`, not duplicated only in React route guards.
- Service-role keys MUST NOT appear in client bundles or committed env files.

**Rationale**: Recipients submit PII without login; coordinators manage sensitive delivery data.
A UI-only permission check is insufficient for this threat model.

### II. Accessible Multi-Channel UX

Langar Seva is a multi-channel operations platform. Elderly recipients MUST have a phone-first
path; caregivers and coordinators use web; drivers and recipients receive plain-language SMS.

- Recipient-facing flows MUST follow guidance in `docs/elderly-friendly-ui.md` (large targets,
  plain language, minimal typing, language support).
- SMS copy MUST be plain language — no jargon, no URLs required to understand status.
- Shared terminology (delivery windows, languages, status labels) MUST use
  `web/src/lib/recipientLabels.ts` (or equivalent central label map) across staff and recipient
  surfaces — no duplicated label strings.
- New intake channels (IVR, web, staff entry) MUST write to the same Supabase schema and
  produce `pending` rows coordinators already review.
- Accessibility regressions on the public intake form MUST be treated as release blockers for
  pilot-facing changes.

**Rationale**: Many recipients are elderly Punjabi/Hindi speakers uncomfortable with mobile
browsers; consistency across channels reduces coordinator confusion and recipient anxiety.

### III. Testing Standards

Quality gates MUST be verifiable before merge. The project currently relies on build/lint checks
and SQL RLS scripts; unit tests are a planned increment.

- `npm run build` and `npm run lint` (from `web/`) MUST pass on every PR touching frontend code.
- New or changed RLS policies MUST include or extend SQL verification scripts under `scripts/`
  (e.g., `scripts/test-rls.sql`, `scripts/test-recipients-rls.sql`).
- New auth paths, Edge Functions, or data mutations MUST have a documented manual or automated
  verification step in the feature spec/plan.
- TODO(VITEST): Adopt Vitest for unit tests on new business logic in `web/src/lib/` and hooks;
  retroactive coverage of existing code is not required for v1 pilot but new non-trivial logic
  SHOULD include unit tests once Vitest is configured.

**Rationale**: Pilot go-live depends on RLS correctness and coordinator trust; SQL scripts are
the current automated safety net until a JS test runner is added.

### IV. Code Quality & Simplicity

Changes MUST be minimal, readable, and aligned with existing patterns.

- TypeScript strict mode MUST remain enabled; no `any` without inline justification.
- Prefer extending existing hooks, components, and Supabase migrations over new abstractions.
- Scope diffs to the feature — no drive-by refactors or unrelated formatting.
- Pilot scope in `docs/go-live-checklist.md` MUST be respected: manual dispatch, no auto route
  optimizer, no live GPS in v1 unless constitution is amended.
- ESLint warnings introduced by a change MUST be fixed in the same PR.

**Rationale**: Small volunteer-driven codebase; YAGNI keeps pilot delivery on schedule.

### V. Performance & Reliability

The platform MUST remain responsive at pilot scale (10–20 stops, 2–3 sevadars, one batch).

- Recipient intake and staff list views MUST load and submit without perceptible hang on typical
  mobile connections at pilot scale.
- Coordinator notifications SHOULD use Supabase Realtime where immediate awareness is required.
- Edge Functions (e.g., Twilio SMS) MUST log failures and return explicit error responses —
  silent SMS drops are unacceptable.
- Database queries on staff dashboards MUST use indexes or scoped filters; avoid unbounded full-
  table fetches on hot paths.
- Performance optimizations beyond pilot scale MAY be deferred unless a constitution violation
  is documented in plan.md Complexity Tracking.

**Rationale**: Coordinators act on realtime kitchen/dispatch signals during live delivery windows.

## Technology Constraints

- **Frontend**: React 19, Vite, TypeScript (`web/`).
- **Backend**: Supabase Postgres, Auth, Realtime, Edge Functions (`supabase/`).
- **SMS**: Twilio via Edge Functions for recipient and driver notifications.
- **Design handoff**: Magic Patterns per `INTEGRATION.md` — generated UI MUST be adapted to
  existing CSS tokens and `recipientLabels` conventions before merge.
- **Local dev**: Supabase CLI + Docker; Node.js 20+.

## Development Workflow

- Features follow Spec Kit SDD: `/speckit.specify` → `/speckit.clarify` (recommended) →
  `/speckit.plan` → `/speckit.tasks` → `/speckit.analyze` → `/speckit.implement`.
- Every feature plan MUST pass the Constitution Check gate before Phase 0 research and again
  after Phase 1 design.
- Delivery/routing/SMS/pilot changes MUST update `docs/go-live-checklist.md` in the same session
  per `.cursor/rules/go-live-checklist-maintenance.mdc`.
- Specs live under `specs/[###-feature-name]/`; branch names SHOULD match feature branches.

## Governance

This constitution supersedes ad-hoc practices for Langar Seva development.

- **Amendments**: Use `/speckit.constitution` with a clear rationale; bump version per semver
  (MAJOR = principle removal/redefinition, MINOR = new principle/section, PATCH = clarifications).
- **Compliance**: PR reviewers MUST verify Constitution Check items in `plan.md` and confirm RLS
  scripts or lint/build evidence for applicable changes.
- **Complexity**: Violations of Principle IV (simplicity) or pilot scope MUST be documented in
  plan.md Complexity Tracking with rejected simpler alternatives.
- **Runtime guidance**: `README.md`, `docs/elderly-friendly-ui.md`, and `docs/go-live-checklist.md`
  supplement this document; conflicts MUST be resolved by amending the constitution or the doc.

**Version**: 1.0.0 | **Ratified**: 2026-06-27 | **Last Amended**: 2026-06-27
