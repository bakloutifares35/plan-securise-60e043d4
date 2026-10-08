-- Bootstrap manuel du premier admin PCA Resillia.
-- Remplacer les UUID placeholders par un utilisateur Auth et une organisation réels.
-- Aucun autre compte ne reçoit de profil, rôle ou membership.
BEGIN;
DO $bootstrap$
DECLARE
  target_user_id uuid := '00000000-0000-0000-0000-000000000000';
  target_organization_id uuid := '00000000-0000-0000-0000-000000000000';
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('resillia:first-admin-bootstrap'));
  IF target_user_id = '00000000-0000-0000-0000-000000000000'::uuid
     OR target_organization_id = '00000000-0000-0000-0000-000000000000'::uuid THEN
    RAISE EXCEPTION 'Remplacer les deux UUID placeholders.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = target_user_id) THEN
    RAISE EXCEPTION 'UUID utilisateur absent de auth.users.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.organisations WHERE id = target_organization_id) THEN
    RAISE EXCEPTION 'UUID organisation absent de public.organisations.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.organization_members
    WHERE role = 'admin_pca' AND status = 'active') THEN
    RAISE EXCEPTION 'Un admin PCA actif existe déjà; bootstrap refusé.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = target_user_id)
     OR EXISTS (SELECT 1 FROM public.organization_members
       WHERE user_id = target_user_id AND organization_id = target_organization_id) THEN
    RAISE EXCEPTION 'Profil ou membership cible déjà présent; vérifier manuellement.';
  END IF;
  INSERT INTO public.profiles (user_id, status) VALUES (target_user_id, 'active');
  INSERT INTO public.organization_members (user_id, organization_id, role, status)
    VALUES (target_user_id, target_organization_id, 'admin_pca', 'active');
END;
$bootstrap$;
COMMIT;
