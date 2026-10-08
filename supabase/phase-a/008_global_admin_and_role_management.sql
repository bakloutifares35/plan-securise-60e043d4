-- 008 : administrateur global et gestion contrôlée des profils/memberships.
-- Cette migration ne constitue pas encore l’isolation multi-organisation.
-- Exécution manuelle uniquement après contrôle du projet et sauvegarde.
-- UUID explicites fournis pour le bootstrap existant (ce ne sont pas des secrets).
BEGIN;

DO $preflight$
DECLARE
  v_user uuid := '39a6cd37-285b-4603-9bf8-f72eb9b9fd15';
  v_org uuid := '814b9dcc-ba20-4c09-b092-481150cfaa6f';
BEGIN
  IF to_regclass('auth.users') IS NULL
     OR to_regclass('public.profiles') IS NULL
     OR to_regclass('public.organization_members') IS NULL
     OR to_regclass('public.organisations') IS NULL THEN
    RAISE EXCEPTION 'Schéma Auth/identité/organisations incomplet; arrêt.';
  END IF;
  IF COALESCE((
    SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder)
    FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'app_role'
  ), ARRAY[]::text[]) <> ARRAY['admin_pca', 'referent_entite', 'auditeur', 'lecteur']::text[] THEN
    RAISE EXCEPTION 'Les valeurs du rôle public.app_role diffèrent des quatre rôles officiels.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_user)
     OR NOT EXISTS (SELECT 1 FROM public.organisations WHERE id = v_org)
     OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = v_user AND status = 'active')
     OR NOT EXISTS (
       SELECT 1 FROM public.organization_members
       WHERE user_id = v_user AND organization_id = v_org
         AND role = 'admin_pca' AND status = 'active'
     ) THEN
    RAISE EXCEPTION 'Le compte admin et sa membership active attendus sont introuvables.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id IS NULL AND user_id = v_user
  ) THEN
    RAISE EXCEPTION 'Une membership globale existe déjà pour le compte cible.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.organization_members'::regclass
      AND conname = 'organization_members_global_admin_check'
  ) OR to_regclass('public.organization_members_one_global_admin_per_user_idx') IS NOT NULL
     OR to_regprocedure('public.is_global_admin()') IS NOT NULL
     OR EXISTS (SELECT 1 FROM pg_attribute
       WHERE attrelid = 'public.profiles'::regclass AND attname = 'email' AND NOT attisdropped)
     OR EXISTS (SELECT 1 FROM pg_trigger
       WHERE tgrelid = 'auth.users'::regclass AND tgname = 'resillia_sync_profile_email') THEN
    RAISE EXCEPTION 'Objets 008 déjà présents; examiner avant toute reprise.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_attribute
    WHERE attrelid = 'auth.users'::regclass AND attname = 'email' AND NOT attisdropped) THEN
    RAISE EXCEPTION 'auth.users.email absent; synchronisation d''e-mail impossible.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname IN (
      'resillia_admin_profiles_select', 'resillia_admin_profiles_insert',
      'resillia_admin_profiles_update', 'resillia_admin_memberships_select',
      'resillia_admin_memberships_insert', 'resillia_admin_memberships_update',
      'resillia_admin_organizations_select'
    )
  ) THEN
    RAISE EXCEPTION 'Une policy portant un nom 008 existe déjà; examiner avant reprise.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id IS NULL AND user_id <> v_user
  ) THEN
    RAISE EXCEPTION 'Une autre membership globale doit être examinée avant 008.';
  END IF;
END;
$preflight$;

ALTER TABLE public.organization_members
  ALTER COLUMN organization_id DROP NOT NULL;
ALTER TABLE public.organization_members
  ADD CONSTRAINT organization_members_global_admin_check
  CHECK (organization_id IS NOT NULL OR role = 'admin_pca');
CREATE UNIQUE INDEX organization_members_one_global_admin_per_user_idx
  ON public.organization_members (user_id) WHERE organization_id IS NULL;

-- La membership existante est convertie en admin global sans supprimer de ligne.
DO $convert_admin$
DECLARE affected_rows integer;
BEGIN
  UPDATE public.organization_members
  SET organization_id = NULL, updated_at = now()
  WHERE user_id = '39a6cd37-285b-4603-9bf8-f72eb9b9fd15'
    AND organization_id = '814b9dcc-ba20-4c09-b092-481150cfaa6f'
    AND role = 'admin_pca' AND status = 'active';
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows <> 1 THEN
    RAISE EXCEPTION 'La conversion de la membership admin attendue a échoué.';
  END IF;
END;
$convert_admin$;

ALTER TABLE public.profiles ADD COLUMN email text;
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE u.id = p.user_id;

CREATE FUNCTION public.is_global_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.organization_members m ON m.user_id = p.user_id
    WHERE p.user_id = (SELECT auth.uid())
      AND p.status = 'active' AND m.status = 'active'
      AND m.role = 'admin_pca'
  );
$function$;
REVOKE ALL ON FUNCTION public.is_global_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_global_admin() TO authenticated;

CREATE FUNCTION public.sync_auth_user_profile_email()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, email, status)
  VALUES (NEW.id, NEW.email, 'pending')
  ON CONFLICT (user_id) DO UPDATE
    SET email = EXCLUDED.email, updated_at = now();
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.sync_auth_user_profile_email() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER resillia_sync_profile_email
AFTER INSERT OR UPDATE OF email ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.sync_auth_user_profile_email();

-- Un rôle applicatif ne peut lire/administrer les autres profils et memberships.
GRANT INSERT, UPDATE ON public.profiles, public.organization_members TO authenticated;
CREATE POLICY resillia_admin_profiles_select ON public.profiles
  FOR SELECT TO authenticated USING ((SELECT public.is_global_admin()));
CREATE POLICY resillia_admin_profiles_insert ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_global_admin()) AND user_id <> (SELECT auth.uid()));
CREATE POLICY resillia_admin_profiles_update ON public.profiles
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_global_admin()) AND user_id <> (SELECT auth.uid()))
  WITH CHECK ((SELECT public.is_global_admin()) AND user_id <> (SELECT auth.uid()));

CREATE POLICY resillia_admin_memberships_select ON public.organization_members
  FOR SELECT TO authenticated USING ((SELECT public.is_global_admin()));
CREATE POLICY resillia_admin_memberships_insert ON public.organization_members
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_global_admin()) AND user_id <> (SELECT auth.uid()));
CREATE POLICY resillia_admin_memberships_update ON public.organization_members
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_global_admin()) AND user_id <> (SELECT auth.uid()))
  WITH CHECK ((SELECT public.is_global_admin()) AND user_id <> (SELECT auth.uid()));

-- Si RLS est déjà active sur organisations, cette policy permet à l'admin global
-- de charger le référentiel dans l'interface. Le statut RLS n'est pas modifié ici.
CREATE POLICY resillia_admin_organizations_select ON public.organisations
  FOR SELECT TO authenticated USING ((SELECT public.is_global_admin()));

COMMIT;
