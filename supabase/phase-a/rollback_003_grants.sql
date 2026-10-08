-- ROLLBACK 003_grants — TEST UNIQUEMENT.
-- Nécessite le snapshot 000 ; restaure les ACL table/sequence et default ACL
-- initiales pour anon/authenticated/PUBLIC. À ne jamais utiliser en production.
BEGIN;
DO $restore$
DECLARE
  v_snapshot uuid;
  g record;
  target_role text;
BEGIN
  SELECT snapshot_id INTO v_snapshot
  FROM phase_a_backup.snapshot_runs ORDER BY captured_at DESC LIMIT 1;
  IF v_snapshot IS NULL THEN
    RAISE EXCEPTION 'Snapshot 000 absent : aucun rollback automatique possible.';
  END IF;

  REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon, authenticated, PUBLIC;
  REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated, PUBLIC;
  REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated, PUBLIC;

  FOR g IN
    SELECT object_kind, object_name, grantee, is_grantable,
           string_agg(DISTINCT privilege_type, ', ' ORDER BY privilege_type) AS privileges
    FROM phase_a_backup.acl_snapshot
    WHERE snapshot_id = v_snapshot AND object_kind IN ('table', 'sequence', 'function')
    GROUP BY object_kind, object_name, grantee, is_grantable
  LOOP
    target_role := CASE WHEN g.grantee = 'PUBLIC' THEN 'PUBLIC' ELSE format('%I', g.grantee) END;
    IF g.object_kind = 'table' THEN
      EXECUTE format('GRANT %s ON TABLE public.%I TO %s%s', g.privileges, g.object_name, target_role,
                     CASE WHEN g.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END);
    ELSIF g.object_kind = 'sequence' THEN
      EXECUTE format('GRANT %s ON SEQUENCE public.%I TO %s%s', g.privileges, g.object_name, target_role,
                     CASE WHEN g.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END);
    ELSE
      EXECUTE format('GRANT %s ON FUNCTION %s TO %s%s', g.privileges, g.object_name, target_role,
                     CASE WHEN g.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END);
    END IF;
  END LOOP;

  -- Conserver l'exécution explicite des helpers tant que 002 est encore installé.
  IF to_regprocedure('public.is_active_member()') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.is_active_member() TO authenticated;
    GRANT EXECUTE ON FUNCTION public.current_role_name() TO authenticated;
    GRANT EXECUTE ON FUNCTION public.can_write() TO authenticated;
    GRANT EXECUTE ON FUNCTION public.can_validate() TO authenticated;
    GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
    GRANT EXECUTE ON FUNCTION public.is_other_membership(uuid) TO authenticated;
  END IF;

  -- Rétablir les grants de schéma public pour les rôles modifiés par 003.
  REVOKE USAGE ON SCHEMA public FROM anon, PUBLIC;
  FOR g IN
    SELECT grantee, is_grantable,
           string_agg(DISTINCT privilege_type, ', ' ORDER BY privilege_type) AS privileges
    FROM phase_a_backup.acl_snapshot
    WHERE snapshot_id = v_snapshot AND object_kind = 'schema'
      AND grantee IN ('anon', 'PUBLIC') AND privilege_type = 'USAGE'
    GROUP BY grantee, is_grantable
  LOOP
    target_role := CASE WHEN g.grantee = 'PUBLIC' THEN 'PUBLIC' ELSE format('%I', g.grantee) END;
    EXECUTE format('GRANT %s ON SCHEMA public TO %s%s', g.privileges, target_role,
                   CASE WHEN g.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END);
  END LOOP;

  -- 003 ne modifie que les default privileges TABLES de l'exécuteur courant.
  ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL PRIVILEGES ON TABLES FROM anon, PUBLIC;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, PUBLIC;
  FOR g IN
    SELECT owner_name, object_type, grantee, is_grantable,
           string_agg(DISTINCT privilege_type, ', ' ORDER BY privilege_type) AS privileges
    FROM phase_a_backup.default_acl_snapshot
    WHERE snapshot_id = v_snapshot AND grantee IN ('anon', 'PUBLIC')
    GROUP BY owner_name, object_type, grantee, is_grantable
  LOOP
    target_role := CASE WHEN g.grantee = 'PUBLIC' THEN 'PUBLIC' ELSE format('%I', g.grantee) END;
    IF g.object_type = 'r' THEN
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT %s ON TABLES TO %s%s',
        g.owner_name, g.privileges, target_role,
        CASE WHEN g.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END
      );
    ELSIF g.object_type = 'f' THEN
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT %s ON FUNCTIONS TO %s%s',
        g.owner_name, g.privileges, target_role,
        CASE WHEN g.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END
      );
    END IF;
  END LOOP;
END
$restore$;
COMMIT;
