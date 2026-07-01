-- RLS/RPC test suite for privacy-preserving delivery tracking.
-- Run with: docker cp scripts/test-delivery-tracking.sql supabase_db_langar-seva:/tmp/test-delivery-tracking.sql
--           docker exec supabase_db_langar-seva psql -U postgres -d postgres -f /tmp/test-delivery-tracking.sql

\set ON_ERROR_ROLLBACK on

BEGIN;
CREATE TEMP TABLE tracking_results (test text, result text, detail text);
CREATE TEMP TABLE tracking_context (route_stop_id uuid, tracking_token text);

CREATE OR REPLACE FUNCTION set_jwt(p_role text) RETURNS void AS $$
BEGIN
  IF p_role = 'anon' THEN
    PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  ELSIF p_role = 'no_staff' THEN
    PERFORM set_config('request.jwt.claims', '{"role":"authenticated","app_metadata":{}}', true);
  ELSIF p_role = 'coordinator' THEN
    PERFORM set_config('request.jwt.claims', '{"role":"authenticated","app_metadata":{"role":"coordinator"}}', true);
  ELSIF p_role = 'kitchen_admin' THEN
    PERFORM set_config('request.jwt.claims', '{"role":"authenticated","app_metadata":{"role":"kitchen_admin"}}', true);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT INSERT ON tracking_results TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON tracking_context TO anon, authenticated;

RESET ROLE;
DELETE FROM public.batches WHERE batch_date='2099-02-01';
DELETE FROM public.recipients WHERE phone='5550001234';

-- Seed one routable stop as a coordinator.
SELECT set_jwt('coordinator'); SET LOCAL ROLE authenticated;
DO $$ DECLARE
  batch_id uuid;
  recipient_id uuid;
  sevadar_id uuid;
  route_id uuid;
  route_stop_id uuid;
  token text;
BEGIN
  INSERT INTO public.batches (batch_date, meal_count_planned, meal_count_packed, status)
  VALUES ('2099-02-01', 4, 4, 'ready')
  RETURNING id INTO batch_id;

  INSERT INTO public.recipients (
    name,
    phone,
    address,
    unit_buzz,
    household_size,
    meals,
    delivery_window,
    language,
    frequency,
    contact_pref,
    status
  )
  VALUES (
    'Tracking Test Recipient',
    '5550001234',
    '1 Test Street',
    '101',
    2,
    2,
    'evening',
    'english',
    'one_time',
    'text',
    'pending'
  )
  RETURNING id INTO recipient_id;

  UPDATE public.recipients SET status='approved' WHERE id=recipient_id;

  INSERT INTO public.sevadars (name, phone)
  VALUES ('Tracking Test Sevadar', '5550005678')
  RETURNING id INTO sevadar_id;

  INSERT INTO public.dispatch_routes (batch_id, sevadar_id, route_name, status)
  VALUES (batch_id, sevadar_id, 'Tracking Test Route', 'assigned')
  RETURNING id INTO route_id;

  INSERT INTO public.dispatch_route_recipients (
    route_id,
    recipient_id,
    stop_order,
    meals,
    eta_start,
    eta_end,
    client_visible_note
  )
  VALUES (
    route_id,
    recipient_id,
    1,
    2,
    now() + interval '20 minutes',
    now() + interval '40 minutes',
    'Test client-safe note'
  )
  RETURNING id INTO route_stop_id;

  SELECT tracking_token INTO token
  FROM public.create_delivery_tracking_link(route_stop_id);

  INSERT INTO tracking_context VALUES (route_stop_id, token);
  INSERT INTO tracking_results VALUES ('T01 coordinator creates token', 'PASS', 'stop='||left(route_stop_id::text,8));
EXCEPTION WHEN others THEN
  INSERT INTO tracking_results VALUES ('T01 coordinator creates token', 'FAIL', left(SQLERRM,80));
END $$;

-- Valid anonymous token returns one redacted row.
RESET ROLE; SELECT set_jwt('anon'); SET LOCAL ROLE anon;
DO $$ DECLARE cnt int; BEGIN
  SELECT count(*) INTO cnt
  FROM public.get_delivery_tracking_status((SELECT tracking_token FROM tracking_context LIMIT 1));
  INSERT INTO tracking_results VALUES ('T02 anon valid token', CASE WHEN cnt=1 THEN 'PASS' ELSE 'FAIL' END, 'rows='||cnt);
END $$;

-- Invalid token reveals no data.
DO $$ DECLARE cnt int; BEGIN
  SELECT count(*) INTO cnt
  FROM public.get_delivery_tracking_status('not-a-real-token');
  INSERT INTO tracking_results VALUES ('T03 anon invalid token', CASE WHEN cnt=0 THEN 'PASS' ELSE 'FAIL' END, 'rows='||cnt);
END $$;

-- Anonymous users cannot read raw operational/PII tables.
DO $$ DECLARE cnt int; BEGIN
  BEGIN
    SELECT count(*) INTO cnt FROM public.dispatch_routes;
    INSERT INTO tracking_results VALUES ('T04 anon raw routes blocked', CASE WHEN cnt=0 THEN 'PASS' ELSE 'FAIL' END, 'rows='||cnt);
  EXCEPTION WHEN insufficient_privilege THEN
    INSERT INTO tracking_results VALUES ('T04 anon raw routes blocked', 'PASS', 'insufficient_privilege');
  END;
END $$;

DO $$ DECLARE cnt int; BEGIN
  SELECT count(*) INTO cnt FROM public.recipients WHERE phone='5550001234';
  INSERT INTO tracking_results VALUES ('T05 anon recipient PII hidden', CASE WHEN cnt=0 THEN 'PASS' ELSE 'FAIL' END, 'rows='||cnt);
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO tracking_results VALUES ('T05 anon recipient PII hidden', 'PASS', 'insufficient_privilege');
END $$;

-- Raw tokens are never stored directly.
RESET ROLE;
DO $$ DECLARE cnt int; BEGIN
  SELECT count(*) INTO cnt
  FROM public.delivery_tracking_links
  WHERE token_hash = (SELECT tracking_token FROM tracking_context LIMIT 1);
  INSERT INTO tracking_results VALUES ('T06 token stored hashed', CASE WHEN cnt=0 THEN 'PASS' ELSE 'FAIL' END, 'raw_matches='||cnt);
END $$;

-- Expired links reveal no data.
UPDATE public.delivery_tracking_links
SET expires_at = now() - interval '1 minute'
WHERE route_recipient_id = (SELECT route_stop_id FROM tracking_context LIMIT 1);

RESET ROLE; SELECT set_jwt('anon'); SET LOCAL ROLE anon;
DO $$ DECLARE cnt int; BEGIN
  SELECT count(*) INTO cnt
  FROM public.get_delivery_tracking_status((SELECT tracking_token FROM tracking_context LIMIT 1));
  INSERT INTO tracking_results VALUES ('T07 expired token hidden', CASE WHEN cnt=0 THEN 'PASS' ELSE 'FAIL' END, 'rows='||cnt);
END $$;

-- Revoked links reveal no data.
RESET ROLE; SELECT set_jwt('coordinator'); SET LOCAL ROLE authenticated;
DO $$ DECLARE token text; BEGIN
  SELECT tracking_token INTO token
  FROM public.create_delivery_tracking_link((SELECT route_stop_id FROM tracking_context LIMIT 1));
  UPDATE tracking_context SET tracking_token = token;
END $$;

RESET ROLE;
UPDATE public.delivery_tracking_links
SET revoked_at = now()
WHERE route_recipient_id = (SELECT route_stop_id FROM tracking_context LIMIT 1);

SELECT set_jwt('anon'); SET LOCAL ROLE anon;
DO $$ DECLARE cnt int; BEGIN
  SELECT count(*) INTO cnt
  FROM public.get_delivery_tracking_status((SELECT tracking_token FROM tracking_context LIMIT 1));
  INSERT INTO tracking_results VALUES ('T08 revoked token hidden', CASE WHEN cnt=0 THEN 'PASS' ELSE 'FAIL' END, 'rows='||cnt);
END $$;

-- Driver route magic links
CREATE TEMP TABLE driver_context (route_id uuid, route_token text);

RESET ROLE; SELECT set_jwt('coordinator'); SET LOCAL ROLE authenticated;
DO $$ DECLARE
  route_id uuid;
  token text;
BEGIN
  SELECT dr.id INTO route_id
  FROM public.dispatch_routes dr
  JOIN public.batches b ON b.id = dr.batch_id
  WHERE b.batch_date = '2099-02-01'
  LIMIT 1;

  SELECT route_token INTO token
  FROM public.create_driver_route_link(route_id);

  INSERT INTO driver_context VALUES (route_id, token);
  INSERT INTO tracking_results VALUES ('T09 coordinator creates driver link', 'PASS', 'route='||left(route_id::text,8));
EXCEPTION WHEN others THEN
  INSERT INTO tracking_results VALUES ('T09 coordinator creates driver link', 'FAIL', left(SQLERRM,80));
END $$;

RESET ROLE; SELECT set_jwt('anon'); SET LOCAL ROLE anon;
DO $$ DECLARE payload json; BEGIN
  SELECT public.get_driver_route_for_token((SELECT route_token FROM driver_context LIMIT 1)) INTO payload;
  INSERT INTO tracking_results VALUES (
    'T10 anon driver route payload',
    CASE WHEN payload IS NOT NULL AND payload->>'route_name' IS NOT NULL THEN 'PASS' ELSE 'FAIL' END,
    coalesce(payload->>'route_name', 'null')
  );
END $$;

RESET ROLE; SELECT set_jwt('coordinator'); SET LOCAL ROLE authenticated;
DO $$ BEGIN
  PERFORM public.revoke_driver_route_link((SELECT route_id FROM driver_context LIMIT 1));
  INSERT INTO tracking_results VALUES ('T11 revoke driver link', 'PASS', 'revoked');
EXCEPTION WHEN others THEN
  INSERT INTO tracking_results VALUES ('T11 revoke driver link', 'FAIL', left(SQLERRM,80));
END $$;

RESET ROLE; SELECT set_jwt('anon'); SET LOCAL ROLE anon;
DO $$ DECLARE payload json; BEGIN
  SELECT public.get_driver_route_for_token((SELECT route_token FROM driver_context LIMIT 1)) INTO payload;
  INSERT INTO tracking_results VALUES (
    'T12 revoked driver link hidden',
    CASE WHEN payload IS NULL THEN 'PASS' ELSE 'FAIL' END,
    coalesce(payload->>'route_name', 'null')
  );
END $$;

RESET ROLE; SELECT set_jwt('coordinator'); SET LOCAL ROLE authenticated;
DO $$ DECLARE
  route_id uuid;
  token text;
BEGIN
  SELECT route_id INTO route_id FROM driver_context LIMIT 1;

  SELECT route_token INTO token
  FROM public.create_driver_route_link(route_id);

  UPDATE driver_context SET route_token = token WHERE route_id = driver_context.route_id;
  INSERT INTO tracking_results VALUES ('T13 recreate driver link after revoke', 'PASS', 'route='||left(route_id::text,8));
EXCEPTION WHEN others THEN
  INSERT INTO tracking_results VALUES ('T13 recreate driver link after revoke', 'FAIL', left(SQLERRM,80));
END $$;

RESET ROLE; SELECT set_jwt('anon'); SET LOCAL ROLE anon;
DO $$ DECLARE ok boolean; BEGIN
  SELECT public.mark_driver_route_picked_up((SELECT route_token FROM driver_context LIMIT 1)) INTO ok;
  INSERT INTO tracking_results VALUES (
    'T14 driver marks picked up',
    CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END,
    'picked_up='||ok::text
  );
END $$;

DO $$ DECLARE
  stop_id uuid;
  ok boolean;
BEGIN
  SELECT (payload->'stops'->0->>'id')::uuid INTO stop_id
  FROM (
    SELECT public.get_driver_route_for_token((SELECT route_token FROM driver_context LIMIT 1)) AS payload
  ) route_payload;

  SELECT public.update_driver_route_stop(
    (SELECT route_token FROM driver_context LIMIT 1),
    stop_id,
    'delivered'::public.delivery_stop_status,
    'Left at door'
  ) INTO ok;

  INSERT INTO tracking_results VALUES (
    'T15 driver updates stop',
    CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END,
    'stop='||left(stop_id::text,8)
  );
END $$;

DO $$ DECLARE payload json; BEGIN
  SELECT public.get_driver_route_for_token((SELECT route_token FROM driver_context LIMIT 1)) INTO payload;
  INSERT INTO tracking_results VALUES (
    'T16 driver stop status persisted',
    CASE WHEN payload->'stops'->0->>'delivery_status' = 'delivered' THEN 'PASS' ELSE 'FAIL' END,
    coalesce(payload->'stops'->0->>'delivery_status', 'null')
  );
END $$;

DO $$ DECLARE payload json; BEGIN
  SELECT public.get_driver_route_for_token('not-a-real-driver-token') INTO payload;
  INSERT INTO tracking_results VALUES (
    'T17 invalid driver token hidden',
    CASE WHEN payload IS NULL THEN 'PASS' ELSE 'FAIL' END,
    coalesce(payload->>'route_name', 'null')
  );
END $$;

RESET ROLE;
SELECT test, result, detail FROM tracking_results ORDER BY test;

DELETE FROM public.batches WHERE batch_date='2099-02-01';
DELETE FROM public.recipients WHERE phone='5550001234';
DROP FUNCTION IF EXISTS set_jwt(text);
COMMIT;
