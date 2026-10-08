-- Rollback non destructif de 005 : ferme l’accès client et conserve tables/données.
BEGIN;
DROP POLICY IF EXISTS resillia_member_entities_select_self ON public.member_entities;
DROP POLICY IF EXISTS resillia_memberships_select_self ON public.organization_members;
DROP POLICY IF EXISTS resillia_profiles_select_self ON public.profiles;
REVOKE ALL ON TABLE public.profiles, public.organization_members, public.member_entities
  FROM PUBLIC, anon, authenticated;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_entities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON FUNCTION public.has_active_org_role(uuid, public.app_role[])
  FROM PUBLIC, anon, authenticated;
DROP FUNCTION IF EXISTS public.has_active_org_role(uuid, public.app_role[]);
-- Les tables, données et enum restent en place; ne pas rejouer 005 sans revue.
COMMIT;
