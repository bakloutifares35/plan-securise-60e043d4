-- ROLLBACK 001_identity — TEST UNIQUEMENT.
-- Non destructif : conserve les profils, memberships, entités et l'enum pour
-- préserver les données. Les tables sont laissées RLS-on sans policy : accès fermé.
-- Exécuter d'abord rollback_002_policies_phase_a.sql et rollback_003_grants.sql.
BEGIN;
DO $guard$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND policyname LIKE 'phase_a_%'
  ) THEN
    RAISE EXCEPTION 'Rollback 002 requis avant de retirer les fonctions identité.';
  END IF;
END
$guard$;

ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.member_entities ENABLE ROW LEVEL SECURITY;

DROP FUNCTION IF EXISTS public.is_other_membership(uuid);
DROP FUNCTION IF EXISTS public.is_admin();
DROP FUNCTION IF EXISTS public.can_validate();
DROP FUNCTION IF EXISTS public.can_write();
DROP FUNCTION IF EXISTS public.current_role_name();
DROP FUNCTION IF EXISTS public.is_active_member();
-- Pas de DROP TABLE ni de suppression de lignes : le schéma identité est conservé.
COMMIT;
