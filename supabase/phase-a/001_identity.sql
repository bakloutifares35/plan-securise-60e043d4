-- PHASE A / 001_identity
-- À exécuter uniquement sur un projet Supabase de TEST après le snapshot 000.
-- Aucun rôle, profil ou membership n'est créé automatiquement à l'inscription.
-- organization_id et entity_id restent volontairement sans FK en phase A.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL
     OR to_regclass('public.organization_members') IS NOT NULL
     OR to_regclass('public.member_entities') IS NOT NULL THEN
    RAISE EXCEPTION 'Une table identité existe déjà. Arrêt : comparer son schéma avant toute migration.';
  END IF;
END
$preflight$;

DO $role_type$
BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin_pca', 'referent_entite', 'auditeur', 'lecteur');
EXCEPTION WHEN duplicate_object THEN
  RAISE EXCEPTION 'public.app_role existe déjà. Vérifier sa définition avant de continuer.';
END
$role_type$;

CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  -- Phase B ajoutera la relation réelle après inspection de public.organisations.
  organization_id uuid NULL,
  role public.app_role NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.member_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id uuid NOT NULL REFERENCES public.organization_members(id) ON DELETE CASCADE,
  -- Phase B raccrochera entity_id à la table d'entités après examen de son schéma réel.
  entity_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (membership_id, entity_id)
);

CREATE INDEX organization_members_user_status_idx
  ON public.organization_members (user_id, status);
CREATE INDEX organization_members_organization_idx
  ON public.organization_members (organization_id);
CREATE UNIQUE INDEX organization_members_active_null_org_idx
  ON public.organization_members (user_id)
  WHERE status = 'active' AND organization_id IS NULL;
CREATE UNIQUE INDEX organization_members_active_per_org_idx
  ON public.organization_members (user_id, organization_id)
  WHERE status = 'active' AND organization_id IS NOT NULL;
CREATE INDEX member_entities_membership_idx
  ON public.member_entities (membership_id);
CREATE INDEX member_entities_entity_idx
  ON public.member_entities (entity_id);

-- Fermer immédiatement les nouvelles tables durant l'intervalle avant 002/003.
REVOKE ALL PRIVILEGES ON public.profiles, public.organization_members, public.member_entities
  FROM anon, PUBLIC, authenticated;

-- Les fonctions SECURITY DEFINER lisent les tables identité comme leur propriétaire,
-- évitant la récursion RLS. Les fonctions n'acceptent aucun user_id fourni par le client.
CREATE FUNCTION public.is_active_member()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    JOIN public.organization_members AS m ON m.user_id = p.user_id
    WHERE p.user_id = (SELECT auth.uid())
      AND p.status = 'active'
      AND m.status = 'active'
  );
$$;

CREATE FUNCTION public.current_role_name()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN count(*) = 1 THEN min(m.role::text) ELSE NULL END
  FROM public.profiles AS p
  JOIN public.organization_members AS m ON m.user_id = p.user_id
  WHERE p.user_id = (SELECT auth.uid())
    AND p.status = 'active'
    AND m.status = 'active';
$$;

CREATE FUNCTION public.can_write()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(public.current_role_name() IN ('admin_pca', 'referent_entite'), false);
$$;

CREATE FUNCTION public.can_validate()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(public.current_role_name() IN ('admin_pca', 'referent_entite'), false);
$$;

CREATE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_role_name() = 'admin_pca';
$$;

-- Utilisée uniquement par les policies member_entities : un admin ne peut pas
-- s'attribuer lui-même une entité en écrivant sa propre ligne.
CREATE FUNCTION public.is_other_membership(p_membership_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members AS m
    WHERE m.id = p_membership_id
      AND m.user_id <> (SELECT auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION public.is_active_member() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_role_name() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_write() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_validate() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_other_membership(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_member() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_role_name() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_write() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_validate() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_other_membership(uuid) TO authenticated;

COMMIT;
