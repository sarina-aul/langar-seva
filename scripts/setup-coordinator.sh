#!/usr/bin/env bash
# Create or reset the local coordinator test user.
# Usage: ./scripts/setup-coordinator.sh [password]
set -euo pipefail

cd "$(dirname "$0")/.."

PASSWORD="${1:-coordinator123}"
EMAIL="coordinator@example.com"

eval "$(supabase status -o env 2>/dev/null)"

if [ -z "${API_URL:-}" ] || [ -z "${SERVICE_ROLE_KEY:-}" ]; then
  echo "Error: Supabase is not running. Run: supabase start"
  exit 1
fi

USER_ID=$(curl -s "$API_URL/auth/v1/admin/users" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  | python3 -c "
import sys, json
users = json.load(sys.stdin).get('users', [])
match = next((u['id'] for u in users if u.get('email') == '$EMAIL'), '')
print(match)
")

if [ -n "$USER_ID" ]; then
  echo "Updating existing user $EMAIL ..."
  curl -s -X PUT "$API_URL/auth/v1/admin/users/$USER_ID" \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -H "apikey: $SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"password\":\"$PASSWORD\",\"app_metadata\":{\"provider\":\"email\",\"providers\":[\"email\"],\"role\":\"coordinator\"}}" \
    > /dev/null
else
  echo "Creating user $EMAIL ..."
  curl -s -X POST "$API_URL/auth/v1/admin/users" \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -H "apikey: $SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"email_confirm\":true,\"app_metadata\":{\"role\":\"coordinator\"}}" \
    > /dev/null
fi

echo ""
echo "Coordinator ready:"
echo "  URL:      http://localhost:5173/login"
echo "  Email:    $EMAIL"
echo "  Password: $PASSWORD"
