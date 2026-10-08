-- PHASE A / 002_policies_phase_a
-- Migration atomique : supprime les anciennes policies métier, active RLS et
-- installe une policy explicite par table/opération. À exécuter sur TEST seulement.
BEGIN;

-- Retirer toutes les anciennes policies du schéma public, sauf celles des tables
-- identité. La transaction rend le remplacement atomique pour les autres sessions.
DO $drop_old_policies$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename NOT IN ('profiles', 'organization_members', 'member_entities')
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END
$drop_old_policies$;

-- Activer RLS sur toutes les tables ordinaires, partitionnées ou étrangères.
DO $enable_rls$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT n.nspname AS schema_name, c.relname AS table_name
    FROM pg_class AS c
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p', 'f')
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', t.schema_name, t.table_name);
  END LOOP;
END
$enable_rls$;

-- Les tables identité ne sont pas incluses dans la suppression dynamique ci-dessus.
-- SELECT : chacun ne voit que sa ligne. Écritures : admin sur les autres comptes;
-- aucune auto-attribution de rôle, statut ou entité. Les désactivations sont préférées
-- aux DELETE afin de préserver la traçabilité.
CREATE POLICY phase_a_profile_select_self ON public.profiles
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY phase_a_profile_insert_admin ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin()) AND user_id <> (SELECT auth.uid()));
CREATE POLICY phase_a_profile_update_admin_other ON public.profiles
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin()) AND user_id <> (SELECT auth.uid()))
  WITH CHECK ((SELECT public.is_admin()) AND user_id <> (SELECT auth.uid()));

CREATE POLICY phase_a_membership_select_self ON public.organization_members
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY phase_a_membership_insert_admin_other ON public.organization_members
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin()) AND user_id <> (SELECT auth.uid()));
CREATE POLICY phase_a_membership_update_admin_other ON public.organization_members
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin()) AND user_id <> (SELECT auth.uid()))
  WITH CHECK ((SELECT public.is_admin()) AND user_id <> (SELECT auth.uid()));

CREATE POLICY phase_a_member_entities_select_self ON public.member_entities
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members AS m
    WHERE m.id = membership_id AND m.user_id = (SELECT auth.uid())
  ));
CREATE POLICY phase_a_member_entities_insert_admin_other ON public.member_entities
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin()) AND (SELECT public.is_other_membership(membership_id)));
CREATE POLICY phase_a_member_entities_update_admin_other ON public.member_entities
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin()) AND (SELECT public.is_other_membership(membership_id)))
  WITH CHECK ((SELECT public.is_admin()) AND (SELECT public.is_other_membership(membership_id)));

-- Droit de lecture commun à toute table métier : session active + membership actif.
-- Les trois référentiels explicitement désignés sont globaux en phase A.
-- organisations : lecture pour un membre actif, écriture réservée à admin_pca.
-- Journaux : INSERT/SELECT seulement ; aucune policy UPDATE/DELETE.
-- Toutes les autres tables, y compris enfants : lecture active, écriture admin/référent,
-- suppression admin. Aucune isolation organisation/entité avant la phase B.
DO $create_business_policies$
DECLARE
  t record;
  is_identity boolean;
  is_global_reference boolean;
  is_organizations boolean;
  is_audit_log boolean;
BEGIN
  FOR t IN
    SELECT c.relname AS table_name
    FROM pg_class AS c
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p', 'f')
    ORDER BY c.relname
  LOOP
    is_identity := t.table_name IN ('profiles', 'organization_members', 'member_entities');
    IF is_identity THEN
      CONTINUE;
    END IF;

    is_global_reference := t.table_name IN ('menaces', 'parametres_risques', 'strategies_catalogue');
    is_organizations := t.table_name = 'organisations';
    is_audit_log := t.table_name IN ('incident_main_courante', 'plan_versions');

    EXECUTE format(
      'CREATE POLICY phase_a_select_active ON public.%I FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.is_active_member()))',
      t.table_name
    );

    IF is_global_reference OR is_organizations THEN
      EXECUTE format(
        'CREATE POLICY phase_a_insert_admin ON public.%I FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.is_admin()))',
        t.table_name
      );
      EXECUTE format(
        'CREATE POLICY phase_a_update_admin ON public.%I FOR UPDATE TO authenticated USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.is_admin())) WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.is_admin()))',
        t.table_name
      );
      EXECUTE format(
        'CREATE POLICY phase_a_delete_admin ON public.%I FOR DELETE TO authenticated USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.is_admin()))',
        t.table_name
      );
    ELSIF is_audit_log THEN
      EXECUTE format(
        'CREATE POLICY phase_a_insert_active_writer ON public.%I FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.can_write()))',
        t.table_name
      );
      -- Pas de policy UPDATE ni DELETE, même pour admin_pca.
    ELSE
      EXECUTE format(
        'CREATE POLICY phase_a_insert_writer ON public.%I FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.can_write()))',
        t.table_name
      );
      EXECUTE format(
        'CREATE POLICY phase_a_update_writer ON public.%I FOR UPDATE TO authenticated USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.can_write())) WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.can_write()))',
        t.table_name
      );
      EXECUTE format(
        'CREATE POLICY phase_a_delete_admin ON public.%I FOR DELETE TO authenticated USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.is_admin()))',
        t.table_name
      );
    END IF;
  END LOOP;
END
$create_business_policies$;

COMMIT;
