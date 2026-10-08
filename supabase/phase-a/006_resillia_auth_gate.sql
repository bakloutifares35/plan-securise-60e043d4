-- 006_resillia_auth_gate.sql
-- Barrière de transition : retire les grants directs d’anon et active RLS
-- progressivement sur les tables confirmées dont RLS était désactivée.
-- Les anciennes policies ne sont ni supprimées ni remplacées.
-- Cette migration ne constitue pas encore l’isolation multi-organisation.
-- Les policies Auth reproduisent seulement les opérations déjà accordées à authenticated.
-- Aucune fonction SQL ni Edge Function n’est modifiée.
BEGIN;
DO $backup_preflight$
BEGIN
  IF to_regnamespace('resillia_006_backup') IS NOT NULL THEN
    RAISE EXCEPTION 'resillia_006_backup existe déjà; examiner avant toute reprise.';
  END IF;
END;
$backup_preflight$;
CREATE SCHEMA resillia_006_backup;
REVOKE ALL ON SCHEMA resillia_006_backup FROM PUBLIC, anon, authenticated;
CREATE TABLE resillia_006_backup.runs (
  snapshot_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  captured_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE resillia_006_backup.targets (
  snapshot_id uuid NOT NULL, table_name name NOT NULL, rls_enabled boolean NOT NULL,
  PRIMARY KEY (snapshot_id, table_name)
);
CREATE TABLE resillia_006_backup.anon_acl (
  snapshot_id uuid NOT NULL, table_name name NOT NULL,
  privilege_type text NOT NULL, is_grantable boolean NOT NULL
);
REVOKE ALL ON ALL TABLES IN SCHEMA resillia_006_backup
  FROM PUBLIC, anon, authenticated;
DO $apply_gate$
DECLARE
  v_snapshot uuid;
  t record;
  table_list name[] := ARRAY[
    'actifs', 'applications_it', 'bia_applications', 'bia_equipements',
    'bia_fournisseurs', 'bia_ressources_humaines', 'calendar_events',
    'contexte_analyse', 'contournements_crise', 'evaluations_bia',
    'fournisseurs', 'incident_actions', 'incident_communications',
    'incident_main_courante', 'incident_membres_cellule', 'incident_plans',
    'incident_processus', 'incident_retex', 'incidents', 'menaces',
    'montee_en_charge', 'organisations', 'parametres_risques',
    'plan_contacts', 'plan_etape_ressources', 'plan_etapes',
    'plan_procedures', 'plan_processus', 'plan_risques', 'plan_sections',
    'plan_strategies', 'plan_versions', 'plan_workflow', 'plans',
    'plans_traitement', 'processus_applications', 'processus_equipements',
    'processus_fournisseurs', 'processus_metier',
    'processus_ressources_humaines', 'ressources_critiques',
    'ressources_equipements', 'ressources_humaines', 'risques',
    'scenarios_risques', 'strategies_association', 'strategies_catalogue',
    'test_actions_correctives', 'test_injectables', 'test_objectifs',
    'test_participants', 'test_resultats', 'tests_pca'
  ];
  missing_count integer;
BEGIN
  INSERT INTO resillia_006_backup.runs DEFAULT VALUES
    RETURNING snapshot_id INTO v_snapshot;

  SELECT count(*) INTO missing_count
  FROM unnest(table_list) expected(table_name)
  WHERE to_regclass(format('public.%I', expected.table_name)) IS NULL;
  IF missing_count > 0 THEN
    RAISE EXCEPTION 'Une table de l’inventaire confirmé est absente; arrêt.';
  END IF;

  -- Un grant PUBLIC pourrait aussi être utilisé par authenticated/service_role.
  IF EXISTS (
    SELECT 1 FROM unnest(table_list) expected(table_name)
    JOIN pg_class c ON c.oid = to_regclass(format('public.%I', expected.table_name))
    CROSS JOIN LATERAL aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) acl
    WHERE acl.grantee = 0
  ) THEN
    RAISE EXCEPTION 'Grant à PUBLIC trouvé; revue ACL requise avant le retrait anon.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(table_list) expected(table_name)
    JOIN pg_class c ON c.oid = to_regclass(format('public.%I', expected.table_name))
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_policies p ON p.schemaname = n.nspname AND p.tablename = c.relname
    WHERE NOT c.relrowsecurity AND p.permissive = 'RESTRICTIVE'
  ) THEN
    RAISE EXCEPTION 'Policy restrictive dormante détectée; revue spécifique nécessaire.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(table_list) expected(table_name)
    JOIN pg_class c ON c.oid = to_regclass(format('public.%I', expected.table_name))
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_policies p ON p.schemaname = n.nspname AND p.tablename = c.relname
    WHERE p.policyname LIKE 'resillia_006_auth_%'
  ) THEN
    RAISE EXCEPTION 'Nom de policy resillia_006_auth_* déjà utilisé.';
  END IF;

  INSERT INTO resillia_006_backup.targets (snapshot_id, table_name, rls_enabled)
  SELECT v_snapshot, c.relname, c.relrowsecurity
  FROM unnest(table_list) expected(table_name)
  JOIN pg_class c ON c.oid = to_regclass(format('public.%I', expected.table_name))
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p');

  INSERT INTO resillia_006_backup.anon_acl
    (snapshot_id, table_name, privilege_type, is_grantable)
  SELECT v_snapshot, c.relname, acl.privilege_type, acl.is_grantable
  FROM unnest(table_list) expected(table_name)
  JOIN pg_class c ON c.oid = to_regclass(format('public.%I', expected.table_name))
  JOIN pg_namespace n ON n.oid = c.relnamespace
  CROSS JOIN LATERAL aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) acl
  JOIN pg_roles r ON r.oid = acl.grantee
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND r.rolname = 'anon';

  FOR t IN SELECT table_name FROM resillia_006_backup.targets
    WHERE snapshot_id = v_snapshot
  LOOP
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon', t.table_name);
  END LOOP;

  FOR t IN SELECT table_name FROM resillia_006_backup.targets
    WHERE snapshot_id = v_snapshot AND NOT rls_enabled
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.table_name);
    IF has_table_privilege('authenticated', format('public.%I', t.table_name), 'SELECT') THEN
      EXECUTE format('CREATE POLICY resillia_006_auth_select ON public.%I
        FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL)', t.table_name);
    END IF;
    IF has_table_privilege('authenticated', format('public.%I', t.table_name), 'INSERT') THEN
      EXECUTE format('CREATE POLICY resillia_006_auth_insert ON public.%I
        FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) IS NOT NULL)', t.table_name);
    END IF;
    IF has_table_privilege('authenticated', format('public.%I', t.table_name), 'UPDATE') THEN
      EXECUTE format('CREATE POLICY resillia_006_auth_update ON public.%I
        FOR UPDATE TO authenticated USING ((SELECT auth.uid()) IS NOT NULL)
        WITH CHECK ((SELECT auth.uid()) IS NOT NULL)', t.table_name);
    END IF;
    IF has_table_privilege('authenticated', format('public.%I', t.table_name), 'DELETE') THEN
      EXECUTE format('CREATE POLICY resillia_006_auth_delete ON public.%I
        FOR DELETE TO authenticated USING ((SELECT auth.uid()) IS NOT NULL)', t.table_name);
    END IF;
  END LOOP;
END;
$apply_gate$;
COMMIT;
