-- PHASE A / 004_validation_triggers
-- À exécuter après 001, 002 et 003, uniquement sur TEST.
-- Les transitions de validation sont contrôlées côté base, y compris via PostgREST.

BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_business_validation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  validation_required boolean := false;
BEGIN
  IF TG_TABLE_NAME = 'plans' THEN
    validation_required := NEW.statut = 'Approuvé'
      AND (TG_OP = 'INSERT' OR OLD.statut IS DISTINCT FROM NEW.statut);
  ELSIF TG_TABLE_NAME = 'strategies_association' THEN
    validation_required := NEW.statut IN ('Retenue', 'Validée')
      AND (TG_OP = 'INSERT' OR OLD.statut IS DISTINCT FROM NEW.statut);
  ELSIF TG_TABLE_NAME = 'tests_pca' THEN
    validation_required := NEW.statut IN ('TERMINE', 'OBJECTIFS_NON_ATTEINTS')
      AND (TG_OP = 'INSERT' OR OLD.statut IS DISTINCT FROM NEW.statut);
  ELSIF TG_TABLE_NAME = 'incident_retex' THEN
    validation_required := nullif(btrim(NEW.valide_par), '') IS NOT NULL
      AND (TG_OP = 'INSERT' OR OLD.valide_par IS DISTINCT FROM NEW.valide_par);
  END IF;

  IF validation_required AND NOT public.can_validate() THEN
    RAISE EXCEPTION 'Cette validation est réservée à un administrateur PCA ou à un référent entité.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_business_validation() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enforce_business_validation() TO authenticated;

CREATE TRIGGER phase_a_validate_plan
  BEFORE INSERT OR UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.enforce_business_validation();

CREATE TRIGGER phase_a_validate_strategy_association
  BEFORE INSERT OR UPDATE ON public.strategies_association
  FOR EACH ROW EXECUTE FUNCTION public.enforce_business_validation();

CREATE TRIGGER phase_a_validate_test
  BEFORE INSERT OR UPDATE ON public.tests_pca
  FOR EACH ROW EXECUTE FUNCTION public.enforce_business_validation();

CREATE TRIGGER phase_a_validate_incident_retex
  BEFORE INSERT OR UPDATE ON public.incident_retex
  FOR EACH ROW EXECUTE FUNCTION public.enforce_business_validation();


-- Défense supplémentaire contre les suppressions indirectes par cascade FK :
-- les journaux restent immuables même lorsqu'une ligne parente est supprimée.
CREATE OR REPLACE FUNCTION public.reject_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION 'Les journaux sont en ajout seulement.'
    USING ERRCODE = '42501';
END;
$$;

REVOKE ALL ON FUNCTION public.reject_audit_mutation() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_audit_mutation() TO authenticated;

CREATE TRIGGER phase_a_append_only_incident_log
  BEFORE UPDATE OR DELETE ON public.incident_main_courante
  FOR EACH ROW EXECUTE FUNCTION public.reject_audit_mutation();

CREATE TRIGGER phase_a_append_only_plan_versions
  BEFORE UPDATE OR DELETE ON public.plan_versions
  FOR EACH ROW EXECUTE FUNCTION public.reject_audit_mutation();

COMMIT;
