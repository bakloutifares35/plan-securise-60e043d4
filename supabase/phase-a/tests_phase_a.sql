-- Tests d'intégration phase A — TEST uniquement, à exécuter en transaction.
-- Prérequis : remplacer les UUID ci-dessous par des utilisateurs Auth existants
-- dont les rôles/memberships de test ont été créés explicitement.
-- Le script ajoute des fixtures temporaires et termine par ROLLBACK.
BEGIN;

-- Vérifications structurelles : policies authentifiées uniquement, RLS exhaustif,
-- et WITH CHECK explicite pour chaque policy UPDATE (ou ALL).
DO $policy_check$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND ('anon' = ANY (roles) OR 'public' = ANY (roles))
  ) THEN RAISE EXCEPTION 'ÉCHEC: une policy public/anon subsiste.'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'f') AND NOT c.relrowsecurity
  ) THEN RAISE EXCEPTION 'ÉCHEC: une table public est sans RLS.'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND cmd IN ('UPDATE', 'ALL') AND with_check IS NULL
  ) THEN RAISE EXCEPTION 'ÉCHEC: une policy UPDATE n'a pas WITH CHECK.'; END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
      AND p.proname IN ('is_active_member', 'current_role_name', 'can_write', 'can_validate', 'is_admin', 'is_other_membership')
      AND NOT coalesce(p.proconfig, ARRAY[]::text[]) @> ARRAY['search_path=public']
  ) THEN RAISE EXCEPTION 'ÉCHEC: un helper SECURITY DEFINER n'a pas search_path fixé.'; END IF;
END
$policy_check$;

DO $setup$
DECLARE
  v_risk uuid;
  v_plan uuid;
  v_plan_version uuid;
  v_incident uuid;
  v_incident_log uuid;
BEGIN
  PERFORM set_config('phase_a.test.unassigned_uid', '00000000-0000-0000-0000-000000000001', true);
  PERFORM set_config('phase_a.test.reader_uid',     '00000000-0000-0000-0000-000000000002', true);
  PERFORM set_config('phase_a.test.referent_uid',   '00000000-0000-0000-0000-000000000003', true);
  PERFORM set_config('phase_a.test.auditor_uid',    '00000000-0000-0000-0000-000000000004', true);
  PERFORM set_config('phase_a.test.admin_uid',      '00000000-0000-0000-0000-000000000005', true);

  IF EXISTS (
    SELECT 1 FROM unnest(ARRAY[
      current_setting('phase_a.test.unassigned_uid'), current_setting('phase_a.test.reader_uid'),
      current_setting('phase_a.test.referent_uid'), current_setting('phase_a.test.auditor_uid'),
      current_setting('phase_a.test.admin_uid')
    ]) AS ids(uid)
    WHERE uid LIKE '00000000-0000-0000-0000-00000000000%'
  ) THEN
    RAISE EXCEPTION 'Remplacer les cinq UUID de test dans tests_phase_a.sql.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles AS p
    JOIN public.organization_members AS m ON m.user_id = p.user_id
    WHERE p.user_id = current_setting('phase_a.test.reader_uid')::uuid
      AND p.status = 'active' AND m.status = 'active' AND m.role = 'lecteur'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS p
    JOIN public.organization_members AS m ON m.user_id = p.user_id
    WHERE p.user_id = current_setting('phase_a.test.referent_uid')::uuid
      AND p.status = 'active' AND m.status = 'active' AND m.role = 'referent_entite'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS p
    JOIN public.organization_members AS m ON m.user_id = p.user_id
    WHERE p.user_id = current_setting('phase_a.test.auditor_uid')::uuid
      AND p.status = 'active' AND m.status = 'active' AND m.role = 'auditeur'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS p
    JOIN public.organization_members AS m ON m.user_id = p.user_id
    WHERE p.user_id = current_setting('phase_a.test.admin_uid')::uuid
      AND p.status = 'active' AND m.status = 'active' AND m.role = 'admin_pca'
  ) THEN
    RAISE EXCEPTION 'Les comptes de test doivent avoir les memberships actifs indiqués dans les commentaires.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.profiles AS p
    JOIN public.organization_members AS m ON m.user_id = p.user_id
    WHERE p.user_id = current_setting('phase_a.test.unassigned_uid')::uuid
      AND p.status = 'active' AND m.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Le compte unassigned ne doit avoir aucun membership actif.';
  END IF;

  INSERT INTO public.risques (title) VALUES ('fixture phase A') RETURNING id INTO v_risk;
  INSERT INTO public.plans (titre) VALUES ('fixture phase A') RETURNING id INTO v_plan;
  INSERT INTO public.plan_versions (plan_id) VALUES (v_plan) RETURNING id INTO v_plan_version;
  INSERT INTO public.incidents (titre) VALUES ('fixture phase A') RETURNING id INTO v_incident;
  INSERT INTO public.incident_main_courante (incident_id, contenu)
    VALUES (v_incident, 'fixture phase A') RETURNING id INTO v_incident_log;

  PERFORM set_config('phase_a.test.risk_id', v_risk::text, true);
  PERFORM set_config('phase_a.test.plan_version_id', v_plan_version::text, true);
  PERFORM set_config('phase_a.test.incident_log_id', v_incident_log::text, true);
END
$setup$;

-- ANON : privilège table refusé, indépendamment de toute policy.
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
DO $anon_denied$
DECLARE denied boolean := false;
BEGIN
  BEGIN
    PERFORM count(*) FROM public.risques;
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'ÉCHEC: anon peut lire risques.'; END IF;
END
$anon_denied$;
RESET ROLE;

-- Auth sans membership : aucune donnée métier et aucune écriture.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object(
  'sub', current_setting('phase_a.test.unassigned_uid'), 'role', 'authenticated')::text, true);
DO $unassigned$
DECLARE
  rows_seen bigint;
  denied boolean := false;
BEGIN
  IF public.is_active_member() THEN RAISE EXCEPTION 'ÉCHEC: compte sans membership actif.'; END IF;
  SELECT count(*) INTO rows_seen FROM public.risques;
  IF rows_seen <> 0 THEN RAISE EXCEPTION 'ÉCHEC: compte sans membership voit des risques.'; END IF;
  BEGIN
    INSERT INTO public.risques (title) VALUES ('must be denied');
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'ÉCHEC: compte sans membership peut écrire.'; END IF;
END
$unassigned$;
RESET ROLE;

-- Lecteur : lecture autorisée, écriture et self-escalation refusées.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object(
  'sub', current_setting('phase_a.test.reader_uid'), 'role', 'authenticated')::text, true);
DO $reader$
DECLARE
  rows_seen bigint;
  denied boolean := false;
  affected bigint;
BEGIN
  SELECT count(*) INTO rows_seen FROM public.risques;
  IF rows_seen < 1 THEN RAISE EXCEPTION 'ÉCHEC: lecteur ne voit pas la fixture.'; END IF;
  IF public.can_write() THEN RAISE EXCEPTION 'ÉCHEC: lecteur a can_write.'; END IF;
  BEGIN
    INSERT INTO public.risques (title) VALUES ('reader write must fail');
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'ÉCHEC: lecteur peut insérer.'; END IF;
  UPDATE public.organization_members SET role = 'admin_pca'
  WHERE user_id = (SELECT auth.uid());
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'ÉCHEC: self-escalation du rôle.'; END IF;
  UPDATE public.profiles SET status = 'suspended' WHERE user_id = (SELECT auth.uid());
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'ÉCHEC: le compte modifie son propre statut profile.'; END IF;
  UPDATE public.organization_members SET status = 'inactive' WHERE user_id = (SELECT auth.uid());
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'ÉCHEC: le compte modifie son propre statut membership.'; END IF;
END
$reader$;
RESET ROLE;

-- Référent : création/édition permises; suppression refusée.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object(
  'sub', current_setting('phase_a.test.referent_uid'), 'role', 'authenticated')::text, true);
DO $referent$
DECLARE
  affected bigint;
BEGIN
  IF NOT public.can_write() OR NOT public.can_validate() THEN
    RAISE EXCEPTION 'ÉCHEC: référent sans écriture/validation.';
  END IF;
  DELETE FROM public.risques WHERE id = current_setting('phase_a.test.risk_id')::uuid;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'ÉCHEC: référent peut supprimer.'; END IF;
END
$referent$;
RESET ROLE;

-- Auditeur : lecture seulement et aucune permission de validation.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object(
  'sub', current_setting('phase_a.test.auditor_uid'), 'role', 'authenticated')::text, true);
DO $auditor$
DECLARE denied boolean := false;
BEGIN
  IF public.can_write() OR public.can_validate() THEN
    RAISE EXCEPTION 'ÉCHEC: auditeur possède écriture ou validation.';
  END IF;
  BEGIN
    INSERT INTO public.risques (title) VALUES ('auditor write must fail');
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'ÉCHEC: auditeur peut écrire.'; END IF;
END
$auditor$;
RESET ROLE;

-- Admin : les journaux sont append-only même pour lui.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object(
  'sub', current_setting('phase_a.test.admin_uid'), 'role', 'authenticated')::text, true);
DO $admin_audit$
DECLARE
  affected bigint;
BEGIN
  IF NOT public.is_admin() OR NOT public.can_validate() THEN
    RAISE EXCEPTION 'ÉCHEC: admin sans rôle/validation attendus.';
  END IF;
  UPDATE public.profiles SET status = 'suspended' WHERE user_id = (SELECT auth.uid());
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'ÉCHEC: admin peut modifier son propre statut profile.'; END IF;
  UPDATE public.organization_members SET role = 'lecteur' WHERE user_id = (SELECT auth.uid());
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'ÉCHEC: admin peut modifier son propre rôle.'; END IF;
  UPDATE public.organization_members SET status = 'inactive' WHERE user_id = (SELECT auth.uid());
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'ÉCHEC: admin peut modifier son propre statut membership.'; END IF;
  UPDATE public.incident_main_courante SET contenu = 'tamper'
  WHERE id = current_setting('phase_a.test.incident_log_id')::uuid;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'ÉCHEC: modification du journal incident.'; END IF;
  DELETE FROM public.incident_main_courante
  WHERE id = current_setting('phase_a.test.incident_log_id')::uuid;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'ÉCHEC: suppression du journal incident.'; END IF;
  UPDATE public.plan_versions SET snapshot = '{}'::jsonb
  WHERE id = current_setting('phase_a.test.plan_version_id')::uuid;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'ÉCHEC: modification du journal des versions.'; END IF;
  DELETE FROM public.plan_versions
  WHERE id = current_setting('phase_a.test.plan_version_id')::uuid;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'ÉCHEC: suppression du journal des versions.'; END IF;
END
$admin_audit$;
RESET ROLE;

ROLLBACK;
