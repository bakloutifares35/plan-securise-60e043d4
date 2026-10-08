-- Rollback local de 008. Conserve profils, e-mails, memberships et autres données.
-- Restaure la membership admin fournie avant de remettre organization_id NOT NULL.
BEGIN;
DO $rollback_preflight$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = '39a6cd37-285b-4603-9bf8-f72eb9b9fd15'
      AND organization_id IS NULL AND role = 'admin_pca' AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Membership globale attendue absente; rollback annulé.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id IS NULL
      AND user_id <> '39a6cd37-285b-4603-9bf8-f72eb9b9fd15'
  ) THEN
    RAISE EXCEPTION 'Autres memberships globales présentes; rollback annulé.';
  END IF;
END;
$rollback_preflight$;

DROP POLICY IF EXISTS resillia_admin_organizations_select ON public.organisations;
DROP POLICY IF EXISTS resillia_admin_memberships_update ON public.organization_members;
DROP POLICY IF EXISTS resillia_admin_memberships_insert ON public.organization_members;
DROP POLICY IF EXISTS resillia_admin_memberships_select ON public.organization_members;
DROP POLICY IF EXISTS resillia_admin_profiles_update ON public.profiles;
DROP POLICY IF EXISTS resillia_admin_profiles_insert ON public.profiles;
DROP POLICY IF EXISTS resillia_admin_profiles_select ON public.profiles;
REVOKE INSERT, UPDATE ON public.profiles, public.organization_members FROM authenticated;

DROP TRIGGER IF EXISTS resillia_sync_profile_email ON auth.users;
DROP FUNCTION IF EXISTS public.sync_auth_user_profile_email();
REVOKE ALL ON FUNCTION public.is_global_admin() FROM PUBLIC, anon, authenticated;
DROP FUNCTION IF EXISTS public.is_global_admin();

UPDATE public.organization_members
SET organization_id = '814b9dcc-ba20-4c09-b092-481150cfaa6f', updated_at = now()
WHERE user_id = '39a6cd37-285b-4603-9bf8-f72eb9b9fd15'
  AND organization_id IS NULL AND role = 'admin_pca';
ALTER TABLE public.organization_members
  DROP CONSTRAINT organization_members_global_admin_check;
DROP INDEX public.organization_members_one_global_admin_per_user_idx;
ALTER TABLE public.organization_members
  ALTER COLUMN organization_id SET NOT NULL;

-- profiles.email est conservé pour ne pas supprimer les données synchronisées.
COMMIT;
