-- Désactive le bootstrap pour l’UUID fourni; aucune ligne n’est supprimée.
BEGIN;
DO $rollback$
DECLARE
  target_user_id uuid := '00000000-0000-0000-0000-000000000000';
  target_organization_id uuid := '00000000-0000-0000-0000-000000000000';
BEGIN
  IF target_user_id = '00000000-0000-0000-0000-000000000000'::uuid
     OR target_organization_id = '00000000-0000-0000-0000-000000000000'::uuid THEN
    RAISE EXCEPTION 'Remplacer les deux UUID placeholders.';
  END IF;
  UPDATE public.organization_members SET status = 'inactive', updated_at = now()
    WHERE user_id = target_user_id AND organization_id = target_organization_id
      AND role = 'admin_pca' AND status = 'active';
  UPDATE public.profiles SET status = 'suspended', updated_at = now()
    WHERE user_id = target_user_id;
END;
$rollback$;
COMMIT;
