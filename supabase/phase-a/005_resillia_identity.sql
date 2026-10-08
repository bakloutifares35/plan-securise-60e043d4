-- 005_resillia_identity.sql
-- Resillia principal; application manuelle après sauvegarde et revue du schéma.
-- Cette migration ne constitue pas encore l’isolation multi-organisation.
-- Aucun trigger Auth, rôle ou membership automatique n’est créé.
BEGIN;
DO $preflight$
BEGIN
  IF to_regclass('auth.users') IS NULL OR to_regclass('public.organisations') IS NULL THEN
    RAISE EXCEPTION 'Tables Auth ou organisations absentes; arrêt sans modification.';
  END IF;
  IF to_regclass('public.profiles') IS NOT NULL
     OR to_regclass('public.organization_members') IS NOT NULL
     OR to_regclass('public.member_entities') IS NOT NULL
     OR to_regtype('public.app_role') IS NOT NULL THEN
    RAISE EXCEPTION 'Objet identité déjà présent; comparer son schéma avant de continuer.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN unnest(c.conkey) k(attnum) ON true
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
    WHERE n.nspname = 'public' AND t.relname = 'organisations'
      AND c.contype IN ('p', 'u') AND cardinality(c.conkey) = 1
      AND a.attname = 'id'
  ) THEN
    RAISE EXCEPTION 'organisations.id doit être une clé primaire ou unique.';
  END IF;
END;
$preflight$;
CREATE TYPE public.app_role AS ENUM
  ('admin_pca', 'referent_entite', 'auditeur', 'lecteur');
CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
  organization_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE RESTRICT,
  role public.app_role NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_members_user_org_unique UNIQUE (user_id, organization_id)
);
CREATE TABLE public.member_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id uuid NOT NULL
    REFERENCES public.organization_members(id) ON DELETE RESTRICT,
  entity_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT member_entities_membership_entity_unique
    UNIQUE (membership_id, entity_id)
);
CREATE INDEX organization_members_org_status_idx
  ON public.organization_members (organization_id, status);
CREATE INDEX member_entities_entity_idx ON public.member_entities (entity_id);
CREATE FUNCTION public.has_active_org_role(p_organization_id uuid, p_roles public.app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.organization_members m ON m.user_id = p.user_id
    WHERE p.user_id = (SELECT auth.uid())
      AND p.status = 'active' AND m.status = 'active'
      AND m.organization_id = p_organization_id AND m.role = ANY (p_roles)
  );
$function$;
REVOKE ALL ON FUNCTION public.has_active_org_role(uuid, public.app_role[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_active_org_role(uuid, public.app_role[])
  TO authenticated;
REVOKE ALL ON TABLE public.profiles, public.organization_members, public.member_entities
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.profiles, public.organization_members, public.member_entities
  TO authenticated;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY resillia_profiles_select_self ON public.profiles
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY resillia_memberships_select_self ON public.organization_members
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY resillia_member_entities_select_self ON public.member_entities
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.id = membership_id AND m.user_id = (SELECT auth.uid())
      AND m.status = 'active'
  ));
COMMIT;
