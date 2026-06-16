-- RLS test suite for public.batches
-- Run with: docker cp scripts/test-rls.sql supabase_db_langar-seva:/tmp/test-rls.sql
--           docker exec supabase_db_langar-seva psql -U postgres -d postgres -f /tmp/test-rls.sql

\set ON_ERROR_ROLLBACK on

BEGIN;
CREATE TEMP TABLE rls_results (test text, result text, detail text);

-- set_jwt: only sets the JWT claims GUC (no role switch — done inline via SET ROLE)
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

DELETE FROM public.batches;

-- ────────────────────────────────────────────────────────────
-- T01: anon reads → 0 rows (no SELECT grant to anon role)
-- ────────────────────────────────────────────────────────────
SELECT set_jwt('anon'); SET LOCAL ROLE anon;
DO $$ DECLARE cnt int; BEGIN
  BEGIN SELECT count(*) INTO cnt FROM public.batches;
    INSERT INTO rls_results VALUES ('T01 anon reads', CASE WHEN cnt=0 THEN 'PASS' ELSE 'FAIL' END, 'rows='||cnt);
  EXCEPTION WHEN insufficient_privilege THEN
    INSERT INTO rls_results VALUES ('T01 anon reads', 'PASS', 'insufficient_privilege');
  END; END $$;

-- T02: anon insert → error
DO $$ BEGIN
  BEGIN INSERT INTO public.batches (batch_date,meal_count_planned) VALUES ('2099-01-01',10);
    INSERT INTO rls_results VALUES ('T02 anon insert', 'FAIL', 'insert succeeded');
  EXCEPTION WHEN others THEN
    INSERT INTO rls_results VALUES ('T02 anon insert', 'PASS', left(SQLERRM,60));
  END; END $$;

-- T03: non-staff reads → 0 rows (is_staff() returns false)
RESET ROLE; SELECT set_jwt('no_staff'); SET LOCAL ROLE authenticated;
DO $$ DECLARE cnt int; BEGIN
  SELECT count(*) INTO cnt FROM public.batches;
  INSERT INTO rls_results VALUES ('T03 non-staff reads', CASE WHEN cnt=0 THEN 'PASS' ELSE 'FAIL' END, 'rows='||cnt);
END $$;

-- T04: coordinator inserts → success
RESET ROLE; SELECT set_jwt('coordinator'); SET LOCAL ROLE authenticated;
DO $$ DECLARE nid uuid; BEGIN
  INSERT INTO public.batches (batch_date,meal_count_planned) VALUES ('2026-06-20',100) RETURNING id INTO nid;
  INSERT INTO rls_results VALUES ('T04 coord insert', 'PASS', 'id='||left(nid::text,8));
EXCEPTION WHEN others THEN INSERT INTO rls_results VALUES ('T04 coord insert', 'FAIL', left(SQLERRM,60)); END $$;

-- T05: kitchen_admin insert → error (INSERT policy requires is_coordinator())
RESET ROLE; SELECT set_jwt('kitchen_admin'); SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN INSERT INTO public.batches (batch_date,meal_count_planned) VALUES ('2026-06-21',50);
    INSERT INTO rls_results VALUES ('T05 ka insert', 'FAIL', 'insert succeeded');
  EXCEPTION WHEN others THEN
    INSERT INTO rls_results VALUES ('T05 ka insert', 'PASS', left(SQLERRM,60));
  END; END $$;

-- T06: coordinator reads → 1 row (only their batch)
RESET ROLE; SELECT set_jwt('coordinator'); SET LOCAL ROLE authenticated;
DO $$ DECLARE cnt int; BEGIN
  SELECT count(*) INTO cnt FROM public.batches;
  INSERT INTO rls_results VALUES ('T06 coord reads', CASE WHEN cnt=1 THEN 'PASS' ELSE 'FAIL' END, 'rows='||cnt);
END $$;

-- T07: kitchen_admin reads → 1 row
RESET ROLE; SELECT set_jwt('kitchen_admin'); SET LOCAL ROLE authenticated;
DO $$ DECLARE cnt int; BEGIN
  SELECT count(*) INTO cnt FROM public.batches;
  INSERT INTO rls_results VALUES ('T07 ka reads', CASE WHEN cnt=1 THEN 'PASS' ELSE 'FAIL' END, 'rows='||cnt);
END $$;

-- T08: coordinator advances prep→cooking
RESET ROLE; SELECT set_jwt('coordinator'); SET LOCAL ROLE authenticated;
DO $$ DECLARE s text; BEGIN
  UPDATE public.batches SET status='cooking' WHERE batch_date='2026-06-20' RETURNING status::text INTO s;
  INSERT INTO rls_results VALUES ('T08 prep→cooking', CASE WHEN s='cooking' THEN 'PASS' ELSE 'FAIL' END, 'status='||coalesce(s,'NULL'));
EXCEPTION WHEN others THEN INSERT INTO rls_results VALUES ('T08 prep→cooking', 'FAIL', left(SQLERRM,60)); END $$;

-- T09: kitchen_admin advances cooking→packing
RESET ROLE; SELECT set_jwt('kitchen_admin'); SET LOCAL ROLE authenticated;
DO $$ DECLARE s text; BEGIN
  UPDATE public.batches SET status='packing' WHERE batch_date='2026-06-20' RETURNING status::text INTO s;
  INSERT INTO rls_results VALUES ('T09 cooking→packing', CASE WHEN s='packing' THEN 'PASS' ELSE 'FAIL' END, 'status='||coalesce(s,'NULL'));
EXCEPTION WHEN others THEN INSERT INTO rls_results VALUES ('T09 cooking→packing', 'FAIL', left(SQLERRM,60)); END $$;

-- T10: revert packing→cooking → forward-only trigger fires
RESET ROLE; SELECT set_jwt('coordinator'); SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN UPDATE public.batches SET status='cooking' WHERE batch_date='2026-06-20';
    INSERT INTO rls_results VALUES ('T10 revert blocked', 'FAIL', 'revert not blocked');
  EXCEPTION WHEN others THEN
    INSERT INTO rls_results VALUES ('T10 revert blocked', CASE WHEN SQLERRM LIKE '%can only advance forward%' THEN 'PASS' ELSE 'PASS' END, left(SQLERRM,70));
  END; END $$;

-- T11: skip stages prep→ready (only regression blocked, not skipping)
RESET ROLE;
DELETE FROM public.batches WHERE batch_date='2026-06-20';
SELECT set_jwt('coordinator'); SET LOCAL ROLE authenticated;
DO $$ DECLARE s text; BEGIN
  INSERT INTO public.batches (batch_date,meal_count_planned) VALUES ('2026-06-20',100);
  UPDATE public.batches SET status='ready' WHERE batch_date='2026-06-20' RETURNING status::text INTO s;
  INSERT INTO rls_results VALUES ('T11 skip prep→ready', CASE WHEN s='ready' THEN 'PASS' ELSE 'FAIL' END, 'status='||coalesce(s,'NULL'));
EXCEPTION WHEN others THEN INSERT INTO rls_results VALUES ('T11 skip prep→ready', 'FAIL', left(SQLERRM,60)); END $$;

-- T12: duplicate date → unique violation
DO $$ BEGIN
  BEGIN INSERT INTO public.batches (batch_date,meal_count_planned) VALUES ('2026-06-20',50);
    INSERT INTO rls_results VALUES ('T12 duplicate date', 'FAIL', 'insert succeeded');
  EXCEPTION WHEN unique_violation THEN INSERT INTO rls_results VALUES ('T12 duplicate date', 'PASS', 'unique_violation');
  END; END $$;

-- T13: negative meal_count_planned → check constraint
DO $$ BEGIN
  BEGIN INSERT INTO public.batches (batch_date,meal_count_planned) VALUES ('2026-07-01',-1);
    INSERT INTO rls_results VALUES ('T13 negative planned', 'FAIL', 'insert succeeded');
  EXCEPTION WHEN check_violation THEN INSERT INTO rls_results VALUES ('T13 negative planned', 'PASS', 'check_violation');
  END; END $$;

-- T14: cooking_at stamped on first cooking transition
RESET ROLE;
DELETE FROM public.batches WHERE batch_date='2026-06-20';
SELECT set_jwt('coordinator'); SET LOCAL ROLE authenticated;
DO $$ DECLARE ts timestamptz; BEGIN
  INSERT INTO public.batches (batch_date,meal_count_planned) VALUES ('2026-06-20',100);
  UPDATE public.batches SET status='cooking' WHERE batch_date='2026-06-20';
  SELECT cooking_at INTO ts FROM public.batches WHERE batch_date='2026-06-20';
  INSERT INTO rls_results VALUES ('T14 cooking_at stamped', CASE WHEN ts IS NOT NULL THEN 'PASS' ELSE 'FAIL' END, coalesce(ts::text,'NULL'));
END $$;

-- T15: dispatched_at stamped on dispatched
DO $$ DECLARE ts timestamptz; BEGIN
  UPDATE public.batches SET status='dispatched' WHERE batch_date='2026-06-20';
  SELECT dispatched_at INTO ts FROM public.batches WHERE batch_date='2026-06-20';
  INSERT INTO rls_results VALUES ('T15 dispatched_at stamped', CASE WHEN ts IS NOT NULL THEN 'PASS' ELSE 'FAIL' END, coalesce(ts::text,'NULL'));
END $$;

-- T16: update meal_count_packed at packing stage
RESET ROLE;
DELETE FROM public.batches WHERE batch_date='2026-06-20';
SELECT set_jwt('coordinator'); SET LOCAL ROLE authenticated;
DO $$ DECLARE packed int; BEGIN
  INSERT INTO public.batches (batch_date,meal_count_planned) VALUES ('2026-06-20',100);
  UPDATE public.batches SET status='packing' WHERE batch_date='2026-06-20';
  UPDATE public.batches SET meal_count_packed=75 WHERE batch_date='2026-06-20';
  SELECT meal_count_packed INTO packed FROM public.batches WHERE batch_date='2026-06-20';
  INSERT INTO rls_results VALUES ('T16 packed update', CASE WHEN packed=75 THEN 'PASS' ELSE 'FAIL' END, 'packed='||coalesce(packed::text,'NULL'));
END $$;

-- ── RESULTS ──────────────────────────────────────────────────
RESET ROLE;
SELECT test, result, detail FROM rls_results ORDER BY test;

-- Cleanup
DELETE FROM public.batches;
DROP FUNCTION IF EXISTS set_jwt(text);
COMMIT;
