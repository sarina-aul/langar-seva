# Seva Eats — Langar Delivery Platform (v1)

Free langar meal delivery intake for recipients. Built with **React (Vite + TypeScript)**, **Supabase**, and designed in **Magic Patterns**.

This repo contains:
- `web/` — recipient intake form + confirmation (no login required)
- `supabase/` — database schema, migrations, and RLS policies

> **Note:** The existing Expo app lives in `~/seva-eats`. This project is the new web + Supabase stack for the Magic Patterns PRD.

## Prerequisites

- Node.js 20+
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`brew install supabase/tap/supabase`)
- Docker Desktop (for local Supabase)

## Quick start

### 1. Supabase (local)

```bash
cd langar-seva
supabase start
supabase db reset   # applies migrations
```

Copy the **anon key** and **API URL** printed by `supabase start`.

### 2. Web app

```bash
cd web
cp .env.example .env.local
# For local Supabase, set in .env.local:
#   VITE_SUPABASE_URL=http://127.0.0.1:54321
#   VITE_SUPABASE_ANON_KEY=<anon key from `supabase status -o env`>

npm install
npm run dev
```

Open http://localhost:5173 — submit the intake form; rows land in `recipients` with `status = 'pending'`.

### 3. Remote Supabase (production)

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in your hosting provider (Vercel, Netlify, etc.).

## Database schema

Migration: `supabase/migrations/20240614000000_create_recipients_table.sql`

### `recipients` table

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| `name` | text | ✓ | |
| `phone` | text | ✓ | |
| `address` | text | ✓ | |
| `unit_buzz` | text | ✓ | Unit or buzzer (or "none") |
| `household_size` | smallint | ✓ | 1–20 |
| `meals` | smallint | ✓ | Defaults to `household_size` |
| `delivery_window` | enum | ✓ | morning, afternoon, evening, flexible |
| `language` | enum | ✓ | english, punjabi, hindi, urdu, other |
| `frequency` | enum | optional | one_time, weekly, biweekly, monthly |
| `contact_pref` | enum | optional | phone, text, either |
| `notes` | text | optional | |
| `status` | enum | ✓ | Defaults to `pending` on intake |
| `geocode_lat/lng` | float | — | Placeholder for future geocoding |
| `geocode_place_id` | text | — | Placeholder for map provider ID |

## Row Level Security (RLS)

All policies are on `public.recipients` with RLS enabled.

| Policy | Role | Operation | Rule |
|--------|------|-----------|------|
| `anon_insert_pending_recipients` | `anon` | INSERT | `status` must be `'pending'` |
| `authenticated_insert_pending_recipients` | `authenticated` | INSERT | `status = 'pending'` and user is **not** a coordinator |
| `coordinators_select_recipients` | `authenticated` | SELECT | `app_metadata.role = 'coordinator'` |
| `coordinators_update_recipients` | `authenticated` | UPDATE | coordinator only |
| `coordinators_delete_recipients` | `authenticated` | DELETE | coordinator only |

**Coordinator setup:** Assign via Supabase Auth Admin API (never `user_metadata`):

```json
{ "app_metadata": { "role": "coordinator" } }
```

The helper `public.is_coordinator()` reads this claim from the JWT.

**Public intake:** The web form uses the **anon** key — no sign-in. Inserts are restricted to `pending` rows only; anonymous users cannot read or update existing records.

## Scripts

```bash
# Web (from web/)
npm run dev      # local dev server
npm run build    # production build
npm run preview  # preview production build

# Supabase (from repo root)
supabase start
supabase stop
supabase db reset
supabase migration list
```

## Magic Patterns

See [INTEGRATION.md](./INTEGRATION.md) for designing screens in Magic Patterns and pulling components into this React app.

## Staff auth

Staff sign in at `/login` with email + password. There is **no public signup** — accounts are created by an admin.

### Create a local test user

After `supabase start`, create a coordinator via **Supabase Studio** or curl.

**Studio:** http://127.0.0.1:54323 → Authentication → Users → Add user. Then set **App metadata**:

```json
{ "role": "coordinator" }
```

**curl** (get `SERVICE_ROLE_KEY` from `supabase status -o env`):

```bash
curl -X POST 'http://127.0.0.1:54321/auth/v1/admin/users' \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "coordinator@example.com",
    "password": "your-local-password",
    "email_confirm": true,
    "app_metadata": { "role": "coordinator" }
  }'
```

> **Note:** `[auth].enable_signup = false` blocks public signup. `[auth.email].enable_signup` must stay `true` or email login is disabled entirely. After changing auth config, run `supabase stop && supabase start`.

Supported roles (via `app_metadata.role`):

| Role | Access |
|------|--------|
| `coordinator` | Staff dashboard, recipient management (RLS) |
| `kitchen_admin` | Reserved for kitchen batch workflow (future) |

**Production:** Assign roles via Supabase Auth Admin API or Dashboard — never `user_metadata`.

```json
{ "app_metadata": { "role": "coordinator" } }
```

### Staff routes

| Path | Access |
|------|--------|
| `/login` | Staff sign-in |
| `/staff` | Authenticated staff dashboard (batch-ready alerts for coordinators) |
| `/staff/kitchen` | Kitchen batch workflow |
| `/staff/recipients` | Coordinator only — review and approve pending requests |

Public intake at `/` remains anonymous — no login required for recipients.

## v1 scope

- ✅ Recipient intake form (required + optional fields)
- ✅ Confirmation screen (“Pending review”)
- ✅ Supabase insert with RLS
- ✅ Staff login (email/password, invite-only)
- ✅ Kitchen batch workflow (6 stages, meal counts)
- ✅ Ready in-app notification for coordinators
- ✅ Coordinator recipients dashboard (approve → `approved`, reject → `rejected`)
- ⏳ Batch recipient assignment (next step)
- ⏳ Email notifications (deferred)
- ⏳ Geocoding pipeline (placeholder columns ready)
