-- Annule le bootstrap en conservant les lignes pour la traçabilité.
-- Remplacer par le même UUID que dans bootstrap_admin.sql. TEST uniquement.
BEGIN;
DO $rollback$
DECLARE target_user_id uuid := '00000000-0000-0000-0000-000000000000'; -- À remplacer
BEGIN
  IF target_user_id = '00000000-0000-0000-0000-000000000000'::uuid THEN
    RAISE EXCEPTION 'Remplacer target_user_id par l’UUID du bootstrap.';
  END IF;
  UPDATE public.organization_members
  SET status = 'inactive', updated_at = now()
  WHERE user_id = target_user_id AND role = 'admin_pca' AND status = 'active';
  UPDATE public.profiles
  SET status = 'pending', updated_at = now()
  WHERE user_id = target_user_id;
END
$rollback$;
COMMIT;
