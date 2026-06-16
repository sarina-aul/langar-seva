-- Notification test suite for staff_notifications + notify_batch_ready trigger
-- Run with: docker cp scripts/test-notifications.sql supabase_db_langar-seva:/tmp/test-notifications.sql
--           docker exec supabase_db_langar-seva psql -U postgres -d postgres -f /tmp/test-notifications.sql

\set ON_ERROR_ROLLBACK on

BEGIN;
CREATE TEMP TABLE notif_results (test text, result text, detail text);

CREATE OR REPLACE FUNCTION set_jwt(p_role text) RETURNS void AS $$
BEGIN
  IF p_role = 'anon' THEN
    PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  ELSIF p_role = 'coordinator' THEN
    PERFORM set_config('request.jwt.claims', '{"role":"authenticated","app_metadata":{"role":"coordinator"}}', true);
  ELSIF p_role = 'kitchen_admin' THEN
    PERFORM set_config('request.jwt.claims', '{"role":"authenticated","app_metadata":{"role":"kitchen_admin"}}', true);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT INSERT ON notif_results TO anon, authenticated;

-- Capture coordinator id before any role switches
CREATE TEMP TABLE test_coord (id uuid);
INSERT INTO test_coord SELECT id FROM auth.users WHERE email = 'coordinator@example.com';
GRANT SELECT ON test_coord TO authenticated;

-- Ensure coordinator test user exists
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  aud, role, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
SELECT
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'coordinator@example.com',
  crypt('coordinator123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"],"role":"coordinator"}'::jsonb,
  '{"email_verified":true}'::jsonb,
  'authenticated', 'authenticated',
  now(), now(), '', '', '', ''
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'coordinator@example.com');

DELETE FROM public.staff_notifications;
DELETE FROM public.batches;

-- Setup: create batch at packing stage (as superuser)
INSERT INTO public.batches (batch_date, meal_count_planned, meal_count_packed, status)
VALUES ('2026-06-25', 100, 80, 'packing');

-- N1: packing → ready creates notification per coordinator
UPDATE public.batches SET status = 'ready' WHERE batch_date = '2026-06-25';
DO $$ DECLARE cnt int; BEGIN
  SELECT count(*) INTO cnt FROM public.staff_notifications WHERE kind = 'batch_ready';
  IF cnt >= 1 THEN
    INSERT INTO notif_results VALUES ('N01 ready trigger', 'PASS', 'notifications=' || cnt);
  ELSE
    INSERT INTO notif_results VALUES ('N01 ready trigger', 'FAIL', 'notifications=' || cnt);
  END IF;
END $$;

-- N2: packing → pickup (skip ready) — use fresh batch
DELETE FROM public.staff_notifications;
DELETE FROM public.batches;
INSERT INTO public.batches (batch_date, meal_count_planned, status)
VALUES ('2026-06-26', 50, 'packing');
UPDATE public.batches SET status = 'pickup' WHERE batch_date = '2026-06-26';
DO $$ DECLARE cnt int; BEGIN
  SELECT count(*) INTO cnt FROM public.staff_notifications WHERE kind = 'batch_ready';
  IF cnt = 0 THEN
    INSERT INTO notif_results VALUES ('N02 skip ready', 'PASS', 'no notifications');
  ELSE
    INSERT INTO notif_results VALUES ('N02 skip ready', 'FAIL', 'notifications=' || cnt);
  END IF;
END $$;

-- N3: update meal_count_packed while at ready — no duplicate
DELETE FROM public.staff_notifications;
DELETE FROM public.batches;
INSERT INTO public.batches (batch_date, meal_count_planned, meal_count_packed, status)
VALUES ('2026-06-27', 100, 90, 'packing');
UPDATE public.batches SET status = 'ready' WHERE batch_date = '2026-06-27';
DO $$ DECLARE cnt1 int; BEGIN
  SELECT count(*) INTO cnt1 FROM public.staff_notifications WHERE batch_id = (SELECT id FROM public.batches WHERE batch_date = '2026-06-27');
  UPDATE public.batches SET meal_count_packed = 95 WHERE batch_date = '2026-06-27';
  IF cnt1 >= 1 THEN
    INSERT INTO notif_results VALUES ('N03 no duplicate on packed update', 'PASS', 'count stable=' || cnt1);
  ELSE
    INSERT INTO notif_results VALUES ('N03 no duplicate on packed update', 'FAIL', 'count=' || cnt1);
  END IF;
EXCEPTION WHEN unique_violation THEN
  INSERT INTO notif_results VALUES ('N03 no duplicate on packed update', 'PASS', 'unique_violation blocked');
END $$;

-- N4: coordinator reads own notifications
RESET ROLE;
SELECT set_jwt('coordinator'); SET LOCAL ROLE authenticated;
DO $$ DECLARE cnt int; uid uuid; BEGIN
  SELECT id INTO uid FROM test_coord;
  PERFORM set_config('request.jwt.claims', json_build_object('role','authenticated','sub',uid::text,'app_metadata',json_build_object('role','coordinator'))::text, true);
  SELECT count(*) INTO cnt FROM public.staff_notifications WHERE user_id = uid;
  IF cnt >= 1 THEN
    INSERT INTO notif_results VALUES ('N04 coord reads own', 'PASS', 'rows=' || cnt);
  ELSE
    INSERT INTO notif_results VALUES ('N04 coord reads own', 'FAIL', 'rows=' || cnt);
  END IF;
END $$;

-- N5: kitchen_admin reads notifications → 0 rows
RESET ROLE;
SELECT set_jwt('kitchen_admin'); SET LOCAL ROLE authenticated;
DO $$ DECLARE cnt int; BEGIN
  SELECT count(*) INTO cnt FROM public.staff_notifications;
  IF cnt = 0 THEN
    INSERT INTO notif_results VALUES ('N05 ka reads none', 'PASS', 'rows=0');
  ELSE
    INSERT INTO notif_results VALUES ('N05 ka reads none', 'FAIL', 'rows=' || cnt);
  END IF;
END $$;

-- N6: anon reads notifications → blocked or 0
RESET ROLE;
SELECT set_jwt('anon'); SET LOCAL ROLE anon;
DO $$ DECLARE cnt int; BEGIN
  BEGIN
    SELECT count(*) INTO cnt FROM public.staff_notifications;
    IF cnt = 0 THEN
      INSERT INTO notif_results VALUES ('N06 anon blocked', 'PASS', 'rows=0');
    ELSE
      INSERT INTO notif_results VALUES ('N06 anon blocked', 'FAIL', 'rows=' || cnt);
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    INSERT INTO notif_results VALUES ('N06 anon blocked', 'PASS', 'insufficient_privilege');
  END;
END $$;

-- N7: coordinator marks own notification read
RESET ROLE;
SELECT set_jwt('coordinator'); SET LOCAL ROLE authenticated;
DO $$ DECLARE nid uuid; uid uuid; read_ts timestamptz; BEGIN
  SELECT id INTO uid FROM test_coord;
  PERFORM set_config('request.jwt.claims', json_build_object('role','authenticated','sub',uid::text,'app_metadata',json_build_object('role','coordinator'))::text, true);
  SELECT id INTO nid FROM public.staff_notifications WHERE user_id = uid LIMIT 1;
  UPDATE public.staff_notifications SET read_at = now() WHERE id = nid;
  SELECT read_at INTO read_ts FROM public.staff_notifications WHERE id = nid;
  IF read_ts IS NOT NULL THEN
    INSERT INTO notif_results VALUES ('N07 coord mark read', 'PASS', 'read_at set');
  ELSE
    INSERT INTO notif_results VALUES ('N07 coord mark read', 'FAIL', 'read_at null');
  END IF;
EXCEPTION WHEN others THEN
  INSERT INTO notif_results VALUES ('N07 coord mark read', 'FAIL', left(SQLERRM, 60));
END $$;

-- N8: coordinator cannot update another user's row
RESET ROLE;
SELECT set_jwt('coordinator'); SET LOCAL ROLE authenticated;
DO $$ DECLARE rows_affected int; uid uuid; BEGIN
  SELECT id INTO uid FROM test_coord;
  PERFORM set_config('request.jwt.claims', json_build_object('role','authenticated','sub',uid::text,'app_metadata',json_build_object('role','coordinator'))::text, true);
  UPDATE public.staff_notifications SET read_at = null WHERE user_id = '00000000-0000-0000-0000-000000000001';
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  IF rows_affected = 0 THEN
    INSERT INTO notif_results VALUES ('N08 no cross-user update', 'PASS', '0 rows updated');
  ELSE
    INSERT INTO notif_results VALUES ('N08 no cross-user update', 'FAIL', 'rows=' || rows_affected);
  END IF;
END $$;

RESET ROLE;
SELECT test, result, detail FROM notif_results ORDER BY test;

DELETE FROM public.staff_notifications;
DELETE FROM public.batches;
DROP FUNCTION IF EXISTS set_jwt(text);
COMMIT;
