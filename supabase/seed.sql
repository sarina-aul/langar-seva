-- Local dev seed — staff test users (no secrets; local only).
-- Password for both: coordinator123
--
-- coordinator@example.com  → role: coordinator
-- kitchen@example.com      → role: kitchen_admin

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DELETE FROM auth.identities
WHERE user_id IN (
  SELECT id FROM auth.users
  WHERE email IN ('coordinator@example.com', 'kitchen@example.com')
);

DELETE FROM auth.users
WHERE email IN ('coordinator@example.com', 'kitchen@example.com');

-- ─── Coordinator ─────────────────────────────────────────────────────────────

INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  aud,
  role,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
)
VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  '00000000-0000-0000-0000-000000000000',
  'coordinator@example.com',
  crypt('coordinator123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"],"role":"coordinator"}'::jsonb,
  '{"email_verified":true}'::jsonb,
  'authenticated',
  'authenticated',
  now(),
  now(),
  '',
  '',
  '',
  ''
);

INSERT INTO auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  '{"sub":"a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11","email":"coordinator@example.com"}'::jsonb,
  'email',
  now(),
  now(),
  now()
);

-- ─── Kitchen admin ───────────────────────────────────────────────────────────

INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  aud,
  role,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
)
VALUES (
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  '00000000-0000-0000-0000-000000000000',
  'kitchen@example.com',
  crypt('coordinator123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"],"role":"kitchen_admin"}'::jsonb,
  '{"email_verified":true}'::jsonb,
  'authenticated',
  'authenticated',
  now(),
  now(),
  '',
  '',
  '',
  ''
);

INSERT INTO auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
VALUES (
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  '{"sub":"b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22","email":"kitchen@example.com"}'::jsonb,
  'email',
  now(),
  now(),
  now()
);
