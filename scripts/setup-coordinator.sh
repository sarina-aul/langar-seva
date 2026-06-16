#!/usr/bin/env bash
# Create or reset the local coordinator test user.
# Uses direct SQL via docker exec because the GoTrue admin API is unavailable
# on older local Supabase CLI versions.
#
# Usage: ./scripts/setup-coordinator.sh [password]
set -euo pipefail

cd "$(dirname "$0")/.."

PASSWORD="${1:-coordinator123}"
EMAIL="coordinator@example.com"

CONTAINER="supabase_db_langar-seva"

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "Error: Supabase container '$CONTAINER' is not running. Run: supabase start"
  exit 1
fi

docker exec "$CONTAINER" psql -U postgres -d postgres -c "
  -- Upsert coordinator user with email_confirmed and coordinator role in app_metadata
  WITH existing AS (
    SELECT id FROM auth.users WHERE email = '$EMAIL'
  ),
  updated AS (
    UPDATE auth.users SET
      encrypted_password  = crypt('$PASSWORD', gen_salt('bf')),
      raw_app_meta_data   = '{\"provider\":\"email\",\"providers\":[\"email\"],\"role\":\"coordinator\"}'::jsonb,
      email_confirmed_at  = COALESCE(email_confirmed_at, now()),
      updated_at          = now()
    WHERE email = '$EMAIL'
    RETURNING id
  )
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    aud, role, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  )
  SELECT
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    '$EMAIL',
    crypt('$PASSWORD', gen_salt('bf')),
    now(),
    '{\"provider\":\"email\",\"providers\":[\"email\"],\"role\":\"coordinator\"}'::jsonb,
    '{\"email_verified\":true}'::jsonb,
    'authenticated', 'authenticated',
    now(), now(), '', '', '', ''
  WHERE NOT EXISTS (SELECT 1 FROM existing);
" > /dev/null

echo ""
echo "Coordinator ready:"
echo "  URL:      http://localhost:5173/login"
echo "  Email:    $EMAIL"
echo "  Password: $PASSWORD"
