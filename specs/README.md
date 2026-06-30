# Langar Seva — Spec Index

Product and feature specs for the Langar Seva / Seva Eats platform. Generated and maintained with
[Spec Kit](https://github.com/github/spec-kit) (`/speckit.specify`, `/speckit.plan`, etc.).

**Governance:** [`.specify/memory/constitution.md`](../.specify/memory/constitution.md) — security,
UX, testing, and performance principles every feature must follow.

---

## Start here (recommended reading order)

Read in this order the first time you open the repo:

| Step | Document | Why read it |
|------|----------|-------------|
| 1 | [Platform overview](./000-langar-seva-platform/spec.md) | Actors, channels, v1 pilot scope, end-to-end flow |
| 2 | [Constitution](../.specify/memory/constitution.md) | Non-negotiable rules (RLS, roles, UX, testing) |
| 3 | [Recipient web intake](./002-recipient-web-intake/spec.md) | How requests enter the system (`/`) |
| 4 | [Staff auth](./003-staff-auth/spec.md) | Login, roles, protected routes |
| 5 | [Coordinator recipients](./004-coordinator-recipients/spec.md) | Approve/reject queue |
| 6 | [Kitchen batch](./005-kitchen-batch/spec.md) | Prep → ready workflow |
| 7 | [Dispatch & tracking](./006-dispatch-delivery-tracking/spec.md) | Routes, SMS, client + driver links |
| 8 | [IVR intake](./001-ivr-intake/spec.md) | **Planned v1.1** — phone-first intake (read last) |

---

## Follow the delivery-day flow

If you want to understand **one evening of operations**, read specs in runtime order:

```
002 Web intake          Someone submits at /
        ↓
004 Coordinator review  Approve households at /staff/recipients
        ↓
005 Kitchen batch       Advance stages at /staff/kitchen → ready
        ↓
006 Dispatch            Build routes, send SMS at /staff/dispatch
        ↓
006 Tracking            Recipient opens /track/:token
                        Sevadar opens /driver/route/:token
```

Auth (`003`) wraps all `/staff/*` steps. Platform spec (`000`) ties the whole loop together.

---

## Feature catalog

| ID | Spec | Status | Routes / surfaces |
|----|------|--------|-------------------|
| 000 | [langar-seva-platform](./000-langar-seva-platform/spec.md) | **Active reference** | All |
| 002 | [recipient-web-intake](./002-recipient-web-intake/spec.md) | **Shipped** (v1) | `/` |
| 003 | [staff-auth](./003-staff-auth/spec.md) | **Shipped** (v1) | `/login`, `/staff/*` |
| 004 | [coordinator-recipients](./004-coordinator-recipients/spec.md) | **Shipped** (v1) | `/staff/recipients` |
| 005 | [kitchen-batch](./005-kitchen-batch/spec.md) | **Shipped** (v1) | `/staff/kitchen` |
| 006 | [dispatch-delivery-tracking](./006-dispatch-delivery-tracking/spec.md) | **Shipped** (v1 pilot) | `/staff/dispatch`, `/track/:token`, `/driver/route/:token` |
| 001 | [ivr-intake](./001-ivr-intake/spec.md) | **Planned** (v1.1) | Twilio Voice → Supabase |

### IVR design artifacts (001 only)

When building phone intake, read these after the main IVR spec:

| File | Purpose |
|------|---------|
| [spec.md](./001-ivr-intake/spec.md) | User stories and requirements |
| [plan.md](./001-ivr-intake/plan.md) | Implementation plan |
| [research.md](./001-ivr-intake/research.md) | Twilio / design decisions |
| [data-model.md](./001-ivr-intake/data-model.md) | Schema changes |
| [quickstart.md](./001-ivr-intake/quickstart.md) | Local test steps |
| [contracts/twilio-voice-webhook.md](./001-ivr-intake/contracts/twilio-voice-webhook.md) | Voice webhook contract |
| [contracts/ivr-sms-templates.md](./001-ivr-intake/contracts/ivr-sms-templates.md) | SMS copy by language |
| [checklists/requirements.md](./001-ivr-intake/checklists/requirements.md) | Pre-ship checklist |

---

## How Spec Kit pieces fit

| Layer | Location | Purpose |
|-------|----------|---------|
| **Constitution** | `.specify/memory/constitution.md` | Principles all features must obey |
| **Platform spec** | `specs/000-*/spec.md` | Whole-product context |
| **Feature spec** | `specs/NNN-*/spec.md` | One shippable slice — stories, requirements, success criteria |
| **Plan / tasks** | `specs/NNN-*/plan.md`, `tasks.md` | From `/speckit.plan` and `/speckit.tasks` |
| **Contracts / research** | `specs/NNN-*/contracts/`, `research.md` | API and integration detail |

**Active feature pointer:** [`.specify/feature.json`](../.specify/feature.json) — currently
`specs/001-ivr-intake` (next major intake channel).

---

## Creating a new spec

In Cursor agent chat:

```
/speckit.specify <plain-language feature description>
/speckit.plan
/speckit.tasks
/speckit.implement
```

---

## Related docs (not Spec Kit specs)

| Doc | Purpose |
|-----|---------|
| [README.md](../README.md) | Setup, schema, RLS, local dev |
| [docs/elderly-friendly-ui.md](../docs/elderly-friendly-ui.md) | Multi-channel UX guidance |
| [docs/go-live-checklist.md](../docs/go-live-checklist.md) | Pilot scope and timeline |
| [docs/delivery-routing-plan.md](../docs/delivery-routing-plan.md) | Routing design notes |
| [GitHub #17](https://github.com/sarina-aul/langar-seva/issues/17) | Built app vs specs audit |
