-- ROLLBACK 002_policies_phase_a — TEST UNIQUEMENT.
-- Nécessite le snapshot 000 dans phase_a_backup. Ce rollback restaure exactement
-- les anciennes policies et flags RLS, y compris les anciennes configurations
-- ouvertes/désactivées. Ne jamais l'utiliser pour remettre l'application en service.
BEGIN;
DO $restore$
DECLARE
  v_snapshot uuid;
  p record;
  role_clause text;
  condition_sql text;
  r record;
BEGIN
  SELECT snapshot_id INTO v_snapshot
  FROM phase_a_backup.snapshot_runs ORDER BY captured_at DESC LIMIT 1;
  IF v_snapshot IS NULL THEN
    RAISE EXCEPTION 'Snapshot 000 absent : aucun rollback automatique possible.';
  END IF;

  -- Retirer toutes les policies ajoutées à l'ensemble des tables public.
  FOR p IN SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;

  -- Recréer les policies observées dans le snapshot avant migration.
  FOR p IN
    SELECT * FROM phase_a_backup.policy_snapshot
    WHERE snapshot_id = v_snapshot ORDER BY table_name, policy_name
  LOOP
    SELECT string_agg(
      CASE WHEN lower(x.role_name::text) = 'public' THEN 'PUBLIC'
           ELSE format('%I', x.role_name) END, ', '
    ) INTO role_clause
    FROM unnest(p.roles) AS x(role_name);

    condition_sql := '';
    IF p.using_expression IS NOT NULL THEN
      condition_sql := condition_sql || format(' USING (%s)', p.using_expression);
    END IF;
    IF p.check_expression IS NOT NULL THEN
      condition_sql := condition_sql || format(' WITH CHECK (%s)', p.check_expression);
    END IF;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS %s FOR %s TO %s%s',
      p.policy_name, p.table_name, p.permissive, p.command,
      coalesce(role_clause, 'PUBLIC'), condition_sql
    );
  END LOOP;

  -- Restaurer l'état RLS initial pour les tables présentes au snapshot.
  FOR r IN SELECT * FROM phase_a_backup.rls_snapshot WHERE snapshot_id = v_snapshot
  LOOP
    IF r.rls_enabled THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.table_name);
    ELSE
      EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', r.table_name);
    END IF;
    IF r.force_rls THEN
      EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', r.table_name);
    ELSE
      EXECUTE format('ALTER TABLE public.%I NO FORCE ROW LEVEL SECURITY', r.table_name);
    END IF;
  END LOOP;
END
$restore$;
COMMIT;
