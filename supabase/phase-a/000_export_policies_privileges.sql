-- PHASE A / 000_export_policies_privileges
-- À exécuter sur le projet de TEST avant les migrations. Aucun dump de données.
-- Le script crée un schéma de sauvegarde non exposé par PostgREST et y conserve
-- le minimum nécessaire aux rollbacks exacts des policies, RLS et ACL modifiées.
-- Export lisible également disponible dans les SELECT de fin de fichier.
BEGIN;

DO $backup_schema_preflight$
BEGIN
  IF to_regnamespace('phase_a_backup') IS NOT NULL THEN
    RAISE EXCEPTION 'phase_a_backup existe déjà. Ne pas modifier ce schéma sans examiner son contenu.';
  END IF;
END
$backup_schema_preflight$;
CREATE SCHEMA phase_a_backup;
REVOKE ALL ON SCHEMA phase_a_backup FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS phase_a_backup.snapshot_runs (
  snapshot_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  captured_by name NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS phase_a_backup.rls_snapshot (
  snapshot_id uuid NOT NULL,
  table_name name NOT NULL,
  rls_enabled boolean NOT NULL,
  force_rls boolean NOT NULL,
  PRIMARY KEY (snapshot_id, table_name)
);
CREATE TABLE IF NOT EXISTS phase_a_backup.policy_snapshot (
  snapshot_id uuid NOT NULL,
  table_name name NOT NULL,
  policy_name name NOT NULL,
  permissive text NOT NULL,
  roles name[] NOT NULL,
  command text NOT NULL,
  using_expression text,
  check_expression text,
  PRIMARY KEY (snapshot_id, table_name, policy_name)
);
CREATE TABLE IF NOT EXISTS phase_a_backup.acl_snapshot (
  snapshot_id uuid NOT NULL,
  object_kind text NOT NULL,
  object_name text NOT NULL,
  grantee name NOT NULL,
  privilege_type text NOT NULL,
  is_grantable boolean NOT NULL
);
CREATE TABLE IF NOT EXISTS phase_a_backup.default_acl_snapshot (
  snapshot_id uuid NOT NULL,
  owner_name name NOT NULL,
  object_type text NOT NULL,
  privilege_type text NOT NULL,
  grantee name NOT NULL,
  is_grantable boolean NOT NULL
);
REVOKE ALL ON ALL TABLES IN SCHEMA phase_a_backup FROM PUBLIC, anon, authenticated;

DO $capture$
DECLARE v_snapshot uuid;
BEGIN
  INSERT INTO phase_a_backup.snapshot_runs (captured_by)
  VALUES (current_user) RETURNING snapshot_id INTO v_snapshot;

  INSERT INTO phase_a_backup.rls_snapshot
    (snapshot_id, table_name, rls_enabled, force_rls)
  SELECT v_snapshot, c.relname, c.relrowsecurity, c.relforcerowsecurity
  FROM pg_class AS c
  JOIN pg_namespace AS n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'f');

  INSERT INTO phase_a_backup.policy_snapshot
    (snapshot_id, table_name, policy_name, permissive, roles, command, using_expression, check_expression)
  SELECT v_snapshot, tablename, policyname, permissive, roles, cmd, qual, with_check
  FROM pg_policies WHERE schemaname = 'public';

  INSERT INTO phase_a_backup.acl_snapshot
    (snapshot_id, object_kind, object_name, grantee, privilege_type, is_grantable)
  SELECT v_snapshot, 'table', c.relname,
         CASE WHEN a.grantee = 0 THEN 'PUBLIC'::name ELSE r.rolname END,
         a.privilege_type, a.is_grantable
  FROM pg_class AS c
  JOIN pg_namespace AS n ON n.oid = c.relnamespace
  CROSS JOIN LATERAL aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) AS a
  LEFT JOIN pg_roles AS r ON r.oid = a.grantee
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'f')
    AND (a.grantee = 0 OR r.rolname IN ('anon', 'authenticated'));

  INSERT INTO phase_a_backup.acl_snapshot
    (snapshot_id, object_kind, object_name, grantee, privilege_type, is_grantable)
  SELECT v_snapshot, 'sequence', c.relname,
         CASE WHEN a.grantee = 0 THEN 'PUBLIC'::name ELSE r.rolname END,
         a.privilege_type, a.is_grantable
  FROM pg_class AS c
  JOIN pg_namespace AS n ON n.oid = c.relnamespace
  CROSS JOIN LATERAL aclexplode(coalesce(c.relacl, acldefault('S', c.relowner))) AS a
  LEFT JOIN pg_roles AS r ON r.oid = a.grantee
  WHERE n.nspname = 'public' AND c.relkind = 'S'
    AND (a.grantee = 0 OR r.rolname IN ('anon', 'authenticated'));

  INSERT INTO phase_a_backup.acl_snapshot
    (snapshot_id, object_kind, object_name, grantee, privilege_type, is_grantable)
  SELECT v_snapshot, 'function',
         format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)),
         CASE WHEN a.grantee = 0 THEN 'PUBLIC'::name ELSE r.rolname END,
         a.privilege_type, a.is_grantable
  FROM pg_proc AS p
  JOIN pg_namespace AS n ON n.oid = p.pronamespace
  CROSS JOIN LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) AS a
  LEFT JOIN pg_roles AS r ON r.oid = a.grantee
  WHERE n.nspname = 'public'
    AND (a.grantee = 0 OR r.rolname IN ('anon', 'authenticated'));

  INSERT INTO phase_a_backup.acl_snapshot
    (snapshot_id, object_kind, object_name, grantee, privilege_type, is_grantable)
  SELECT v_snapshot, 'schema', n.nspname,
         CASE WHEN a.grantee = 0 THEN 'PUBLIC'::name ELSE r.rolname END,
         a.privilege_type, a.is_grantable
  FROM pg_namespace AS n
  CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl, acldefault('n', n.nspowner))) AS a
  LEFT JOIN pg_roles AS r ON r.oid = a.grantee
  WHERE n.nspname = 'public'
    AND (a.grantee = 0 OR r.rolname IN ('anon', 'authenticated'));

  INSERT INTO phase_a_backup.default_acl_snapshot
    (snapshot_id, owner_name, object_type, privilege_type, grantee, is_grantable)
  SELECT v_snapshot, owner_role.rolname, d.defaclobjtype::text, a.privilege_type,
         CASE WHEN a.grantee = 0 THEN 'PUBLIC'::name ELSE grantee_role.rolname END,
         a.is_grantable
  FROM pg_default_acl AS d
  JOIN pg_roles AS owner_role ON owner_role.oid = d.defaclrole
  CROSS JOIN LATERAL aclexplode(d.defaclacl) AS a
  LEFT JOIN pg_roles AS grantee_role ON grantee_role.oid = a.grantee
  WHERE d.defaclnamespace = 'public'::regnamespace
    AND d.defaclobjtype IN ('r', 'f')
    AND d.defaclrole = (SELECT oid FROM pg_roles WHERE rolname = current_user)
    AND (a.grantee = 0 OR grantee_role.rolname IN ('anon', 'authenticated'));
END
$capture$;

COMMIT;

-- Conserver le snapshot_id le plus récent et télécharger/copier les résultats.
SELECT * FROM phase_a_backup.snapshot_runs ORDER BY captured_at DESC LIMIT 1;
SELECT * FROM phase_a_backup.rls_snapshot ORDER BY table_name;
SELECT * FROM phase_a_backup.policy_snapshot ORDER BY table_name, policy_name;
SELECT * FROM phase_a_backup.acl_snapshot ORDER BY object_kind, object_name, grantee, privilege_type;
SELECT * FROM phase_a_backup.default_acl_snapshot ORDER BY owner_name, object_type, grantee, privilege_type;

-- Vérification complémentaire : les SECURITY DEFINER distantes doivent être
-- examinées séparément avant de conclure à l'absence de voies de contournement.
SELECT n.nspname AS schema_name, p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       p.prosecdef AS security_definer, p.proacl AS privileges
FROM pg_proc AS p JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' ORDER BY p.proname;
