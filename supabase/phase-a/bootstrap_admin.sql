-- PREMIER ADMINISTRATEUR PCA — exécuter manuellement, une seule fois, sur TEST.
-- Remplacer l'UUID ci-dessous par l'id d'un utilisateur auth.users existant,
-- fourni explicitement par le propriétaire du projet. Ne pas utiliser d'email.
-- Ce script ne crée pas d'utilisateur Auth et n'utilise aucune clé service_role.
BEGIN;
DO $bootstrap$
DECLARE target_user_id uuid := '00000000-0000-0000-0000-000000000000'; -- À remplacer
BEGIN
  IF target_user_id = '00000000-0000-0000-0000-000000000000'::uuid THEN
    RAISE EXCEPTION 'Remplacer target_user_id par un utilisateur Auth existant.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = target_user_id) THEN
    RAISE EXCEPTION 'Cet UUID ne correspond pas à un utilisateur auth.users existant.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE role = 'admin_pca' AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Un admin_pca actif existe déjà. Bootstrap refusé.';
  END IF;

  INSERT INTO public.profiles (user_id, status)
  VALUES (target_user_id, 'active')
  ON CONFLICT (user_id) DO UPDATE SET status = 'active', updated_at = now();

  INSERT INTO public.organization_members (user_id, organization_id, role, status)
  VALUES (target_user_id, NULL, 'admin_pca', 'active');
END
$bootstrap$;
COMMIT;
