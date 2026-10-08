-- Rollback 006 : restaure RLS et grants anon capturés.
-- Cela rétablit l’accès anonyme antérieur; examiner le risque avant usage.
BEGIN;
DO $restore$
DECLARE
  v_snapshot uuid;
  t record;
  g record;
BEGIN
  SELECT snapshot_id INTO v_snapshot
  FROM resillia_006_backup.runs ORDER BY captured_at DESC LIMIT 1;
  IF v_snapshot IS NULL THEN
    RAISE EXCEPTION 'Snapshot 006 absent; rollback impossible.';
  END IF;
  FOR t IN SELECT table_name, rls_enabled
    FROM resillia_006_backup.targets WHERE snapshot_id = v_snapshot
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS resillia_006_auth_select ON public.%I', t.table_name);
    EXECUTE format('DROP POLICY IF EXISTS resillia_006_auth_insert ON public.%I', t.table_name);
    EXECUTE format('DROP POLICY IF EXISTS resillia_006_auth_update ON public.%I', t.table_name);
    EXECUTE format('DROP POLICY IF EXISTS resillia_006_auth_delete ON public.%I', t.table_name);
    IF t.rls_enabled THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.table_name);
    ELSE
      EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t.table_name);
    END IF;
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon', t.table_name);
  END LOOP;
  FOR g IN SELECT table_name, privilege_type, is_grantable
    FROM resillia_006_backup.anon_acl WHERE snapshot_id = v_snapshot
  LOOP
    EXECUTE format('GRANT %s ON TABLE public.%I TO anon%s',
      g.privilege_type, g.table_name,
      CASE WHEN g.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END);
  END LOOP;
END;
$restore$;
COMMIT;
