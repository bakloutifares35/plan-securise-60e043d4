-- ROLLBACK 004_validation_triggers — TEST UNIQUEMENT.
-- Retire uniquement les triggers et leur fonction; aucune donnée n'est supprimée.
BEGIN;
DROP TRIGGER IF EXISTS phase_a_validate_plan ON public.plans;
DROP TRIGGER IF EXISTS phase_a_validate_strategy_association ON public.strategies_association;
DROP TRIGGER IF EXISTS phase_a_validate_test ON public.tests_pca;
DROP TRIGGER IF EXISTS phase_a_validate_incident_retex ON public.incident_retex;
DROP TRIGGER IF EXISTS phase_a_append_only_incident_log ON public.incident_main_courante;
DROP TRIGGER IF EXISTS phase_a_append_only_plan_versions ON public.plan_versions;
DROP FUNCTION IF EXISTS public.reject_audit_mutation();
DROP FUNCTION IF EXISTS public.enforce_business_validation();
COMMIT;
