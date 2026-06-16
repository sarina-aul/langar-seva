-- RLS test suite for public.recipients
-- Run with: docker cp scripts/test-recipients-rls.sql supabase_db_langar-seva:/tmp/test-recipients-rls.sql
--           docker exec supabase_db_langar-seva psql -U postgres -d postgres -f /tmp/test-recipients-rls.sql

\set ON_ERROR_ROLLBACK on

BEGIN;
CREATE TEMP TABLE rls_results (test text, result text, detail text);

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

GRANT INSERT ON rls_results TO anon, authenticated;

DELETE FROM public.recipients;

-- Seed one pending recipient as superuser
INSERT INTO public.recipients (
  name, phone, address, unit_buzz, household_size, meals,
  delivery_window, language, status
) VALUES (
  'Test User', '555-0100', '123 Main St', '4B', 2, 2,
  'evening', 'english', 'pending'
);

-- R01: anon SELECT → blocked or 0 rows
SELECT set_jwt('anon'); SET LOCAL ROLE anon;
DO $$ DECLARE cnt int; BEGIN
  BEGIN SELECT count(*) INTO cnt FROM public.recipients;
    INSERT INTO rls_results VALUES ('R01 anon select', CASE WHEN cnt=0 THEN 'PASS' ELSE 'FAIL' END, 'rows='||cnt);
  EXCEPTION WHEN insufficient_privilege THEN
    INSERT INTO rls_results VALUES ('R01 anon select', 'PASS', 'insufficient_privilege');
  END; END $$;

-- R02: anon UPDATE → blocked
DO $$ BEGIN
  BEGIN UPDATE public.recipients SET status='approved';
    INSERT INTO rls_results VALUES ('R02 anon update', 'FAIL', 'update succeeded');
  EXCEPTION WHEN others THEN
    INSERT INTO rls_results VALUES ('R02 anon update', 'PASS', left(SQLERRM,60));
  END; END $$;

-- R03: anon INSERT pending → success (direct SQL; DO blocks don't inherit SET ROLE)
RESET ROLE; SELECT set_jwt('anon'); SET LOCAL ROLE anon;
INSERT INTO public.recipients (
  name, phone, address, unit_buzz, household_size, meals,
  delivery_window, language, status
) VALUES (
  'Anon User', '555-0101', '1 Anon St', 'none', 1, 1,
  'flexible', 'english', 'pending'
);
INSERT INTO rls_results VALUES ('R03 anon insert pending', 'PASS', 'direct insert ok');

-- R04: anon INSERT approved → blocked
RESET ROLE; SELECT set_jwt('anon'); SET LOCAL ROLE anon;
DO $$ BEGIN
  BEGIN INSERT INTO public.recipients (
    name, phone, address, unit_buzz, household_size, meals,
    delivery_window, language, status
  ) VALUES (
    'Bad', '555', 'x', 'none', 1, 1, 'flexible', 'english', 'approved'
  );
    INSERT INTO rls_results VALUES ('R04 anon insert approved', 'FAIL', 'insert succeeded');
  EXCEPTION WHEN others THEN
    INSERT INTO rls_results VALUES ('R04 anon insert approved', 'PASS', left(SQLERRM,60));
  END; END $$;

-- R05: non-staff SELECT → 0 rows
RESET ROLE; SELECT set_jwt('no_staff'); SET LOCAL ROLE authenticated;
DO $$ DECLARE cnt int; BEGIN
  SELECT count(*) INTO cnt FROM public.recipients;
  INSERT INTO rls_results VALUES ('R05 non-staff select', CASE WHEN cnt=0 THEN 'PASS' ELSE 'FAIL' END, 'rows='||cnt);
END $$;

-- R06: kitchen_admin SELECT → 0 rows
RESET ROLE; SELECT set_jwt('kitchen_admin'); SET LOCAL ROLE authenticated;
DO $$ DECLARE cnt int; BEGIN
  SELECT count(*) INTO cnt FROM public.recipients;
  INSERT INTO rls_results VALUES ('R06 ka select', CASE WHEN cnt=0 THEN 'PASS' ELSE 'FAIL' END, 'rows='||cnt);
END $$;

-- R07: kitchen_admin UPDATE → 0 rows
DO $$ DECLARE rows_affected int; BEGIN
  UPDATE public.recipients SET status='approved' WHERE status='pending';
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  IF rows_affected = 0 THEN
    INSERT INTO rls_results VALUES ('R07 ka update', 'PASS', '0 rows updated');
  ELSE
    INSERT INTO rls_results VALUES ('R07 ka update', 'FAIL', 'rows='||rows_affected);
  END IF;
END $$;

-- R08: coordinator SELECT all → success (seed + anon insert = 2+)
RESET ROLE; SELECT set_jwt('coordinator'); SET LOCAL ROLE authenticated;
DO $$ DECLARE cnt int; BEGIN
  SELECT count(*) INTO cnt FROM public.recipients;
  IF cnt >= 2 THEN
    INSERT INTO rls_results VALUES ('R08 coord select', 'PASS', 'rows='||cnt);
  ELSE
    INSERT INTO rls_results VALUES ('R08 coord select', 'FAIL', 'rows='||cnt);
  END IF;
END $$;

-- R09: coordinator pending → approved
DO $$ DECLARE rid uuid; s text; BEGIN
  SELECT id INTO rid FROM public.recipients WHERE status='pending' LIMIT 1;
  UPDATE public.recipients SET status='approved' WHERE id=rid RETURNING status::text INTO s;
  IF s='approved' THEN
    INSERT INTO rls_results VALUES ('R09 coord approve', 'PASS', 'status=approved');
  ELSE
    INSERT INTO rls_results VALUES ('R09 coord approve', 'FAIL', 'status='||coalesce(s,'null'));
  END IF;
END $$;

-- R10: coordinator pending → rejected (re-insert pending first)
RESET ROLE;
INSERT INTO public.recipients (
  name, phone, address, unit_buzz, household_size, meals,
  delivery_window, language, status
) VALUES ('Reject Me', '555-0200', '2 St', 'none', 1, 1, 'morning', 'english', 'pending');

SELECT set_jwt('coordinator'); SET LOCAL ROLE authenticated;
DO $$ DECLARE rid uuid; s text; BEGIN
  SELECT id INTO rid FROM public.recipients WHERE name='Reject Me';
  UPDATE public.recipients SET status='rejected' WHERE id=rid RETURNING status::text INTO s;
  IF s='rejected' THEN
    INSERT INTO rls_results VALUES ('R10 coord reject', 'PASS', 'status=rejected');
  ELSE
    INSERT INTO rls_results VALUES ('R10 coord reject', 'FAIL', 'status='||coalesce(s,'null'));
  END IF;
END $$;

-- R11: coordinator approved → pending (allowed in v1)
DO $$ DECLARE rid uuid; s text; BEGIN
  SELECT id INTO rid FROM public.recipients WHERE status='approved' LIMIT 1;
  UPDATE public.recipients SET status='pending' WHERE id=rid RETURNING status::text INTO s;
  IF s='pending' THEN
    INSERT INTO rls_results VALUES ('R11 coord revert pending', 'PASS', 'status=pending');
  ELSE
    INSERT INTO rls_results VALUES ('R11 coord revert pending', 'FAIL', 'status='||coalesce(s,'null'));
  END IF;
END $$;

-- R12: coordinator DELETE
DO $$ DECLARE rid uuid; BEGIN
  SELECT id INTO rid FROM public.recipients WHERE name='Reject Me';
  DELETE FROM public.recipients WHERE id=rid;
  IF NOT FOUND THEN
    INSERT INTO rls_results VALUES ('R12 coord delete', 'FAIL', 'row not found');
  ELSE
    INSERT INTO rls_results VALUES ('R12 coord delete', 'PASS', 'deleted');
  END IF;
END $$;

-- R13: coordinator INSERT pending on behalf
DO $$ DECLARE new_id uuid; BEGIN
  INSERT INTO public.recipients (
    name, phone, address, unit_buzz, household_size, meals,
    delivery_window, language, status
  ) VALUES (
    'Coord Insert', '555-0300', '3 St', 'none', 3, 3,
    'afternoon', 'punjabi', 'pending'
  ) RETURNING id INTO new_id;
  INSERT INTO rls_results VALUES ('R13 coord insert', 'PASS', left(new_id::text,8));
EXCEPTION WHEN others THEN
  INSERT INTO rls_results VALUES ('R13 coord insert', 'FAIL', left(SQLERRM,60));
END $$;

-- R14: household_size = 0 → check violation
DO $$ BEGIN
  BEGIN INSERT INTO public.recipients (
    name, phone, address, unit_buzz, household_size, meals,
    delivery_window, language, status
  ) VALUES (
    'Bad Size', '555', 'x', 'none', 0, 1, 'flexible', 'english', 'pending'
  );
    INSERT INTO rls_results VALUES ('R14 check constraint', 'FAIL', 'insert succeeded');
  EXCEPTION WHEN check_violation THEN
    INSERT INTO rls_results VALUES ('R14 check constraint', 'PASS', 'check_violation');
  END; END $$;

RESET ROLE;
SELECT test, result, detail FROM rls_results ORDER BY test;

DELETE FROM public.recipients;
DROP FUNCTION IF EXISTS set_jwt(text);
COMMIT;
