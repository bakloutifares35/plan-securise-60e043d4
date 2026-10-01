-- Module M7 — Exercices PCA (à exécuter dans l'éditeur SQL du projet Resillia)
DO $$ BEGIN
  CREATE TYPE test_type AS ENUM ('TEST_PROCEDURE','EXERCICE_TABLE','TEST_IT','SIMULATION_COMPLETE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE test_statut AS ENUM ('PLANIFIE','EN_COURS','TERMINE','OBJECTIFS_NON_ATTEINTS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE test_confirmation AS ENUM ('INVITE','CONFIRME','DECLINE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE test_priorite AS ENUM ('FAIBLE','MOYENNE','HAUTE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE test_action_statut AS ENUM ('A_FAIRE','EN_COURS','FAIT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE SEQUENCE IF NOT EXISTS tests_pca_ref_seq;

CREATE TABLE IF NOT EXISTS public.tests_pca (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text UNIQUE,
  type test_type NOT NULL DEFAULT 'TEST_PROCEDURE',
  titre text NOT NULL,
  description text,
  date_planifiee timestamptz,
  date_debut_reelle timestamptz,
  date_fin_reelle timestamptz,
  processus_id uuid REFERENCES public.processus_metier(id) ON DELETE SET NULL,
  scenario_risque_id uuid REFERENCES public.risques(id) ON DELETE SET NULL,
  strategie_id uuid REFERENCES public.strategies_association(id) ON DELETE SET NULL,
  statut test_statut NOT NULL DEFAULT 'PLANIFIE',
  est_tlpt boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.test_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES public.tests_pca(id) ON DELETE CASCADE,
  nom text NOT NULL, email text, role text,
  statut_confirmation test_confirmation NOT NULL DEFAULT 'INVITE'
);

CREATE TABLE IF NOT EXISTS public.test_injectables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES public.tests_pca(id) ON DELETE CASCADE,
  ordre int NOT NULL DEFAULT 0,
  offset_minutes int NOT NULL DEFAULT 0,
  titre text NOT NULL, description text,
  revele boolean NOT NULL DEFAULT false,
  heure_revelation_reelle timestamptz
);

CREATE TABLE IF NOT EXISTS public.test_objectifs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES public.tests_pca(id) ON DELETE CASCADE,
  ordre int NOT NULL DEFAULT 0,
  libelle text NOT NULL,
  atteint boolean,
  observation text
);

CREATE TABLE IF NOT EXISTS public.test_resultats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL UNIQUE REFERENCES public.tests_pca(id) ON DELETE CASCADE,
  rto_reel_heures numeric, rto_cible_heures numeric, rto_atteignable_heures numeric,
  synthese text, lecons_apprises text
);

CREATE TABLE IF NOT EXISTS public.test_actions_correctives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES public.tests_pca(id) ON DELETE CASCADE,
  objectif_id uuid REFERENCES public.test_objectifs(id) ON DELETE SET NULL,
  description text NOT NULL, responsable text, echeance date,
  priorite test_priorite NOT NULL DEFAULT 'MOYENNE',
  statut test_action_statut NOT NULL DEFAULT 'A_FAIRE'
);

-- Référence PCA-YYYY-NNN + updated_at
CREATE OR REPLACE FUNCTION public.tests_pca_before_write() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.reference IS NULL THEN
    NEW.reference := 'PCA-' || to_char(now(),'YYYY') || '-' || lpad(nextval('tests_pca_ref_seq')::text, 3, '0');
  END IF;
  NEW.updated_at := now();
  -- Blocage de clôture (défense en profondeur)
  IF NEW.statut IN ('TERMINE','OBJECTIFS_NON_ATTEINTS') THEN
    IF EXISTS (SELECT 1 FROM test_objectifs WHERE test_id = NEW.id AND atteint IS NULL) THEN
      RAISE EXCEPTION 'Clôture impossible : tous les objectifs doivent être évalués.';
    END IF;
    IF EXISTS (
      SELECT 1 FROM test_objectifs o WHERE o.test_id = NEW.id AND o.atteint = false
      AND NOT EXISTS (SELECT 1 FROM test_actions_correctives a WHERE a.test_id = NEW.id)
    ) THEN
      RAISE EXCEPTION 'Clôture impossible : objectif non atteint sans action corrective.';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_tests_pca_before_write ON public.tests_pca;
CREATE TRIGGER trg_tests_pca_before_write BEFORE INSERT OR UPDATE ON public.tests_pca
FOR EACH ROW EXECUTE FUNCTION public.tests_pca_before_write();

-- Accès (convention du projet : RLS activée, policies ouvertes, pas de multi-tenant)
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['tests_pca','test_participants','test_injectables','test_objectifs','test_resultats','test_actions_correctives'] LOOP
    EXECUTE format('GRANT ALL ON public.%I TO anon, authenticated, service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "full_access" ON public.%I', t);
    EXECUTE format('CREATE POLICY "full_access" ON public.%I FOR ALL USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;
GRANT USAGE ON SEQUENCE tests_pca_ref_seq TO anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';
