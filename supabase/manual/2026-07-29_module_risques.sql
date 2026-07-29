-- =====================================================================
-- RESILLIA — Module "Analyse des Risques" (refonte complète)
-- Projet Supabase cible : ipbfddubgzypgfkfkvbb
-- À exécuter dans l'éditeur SQL de votre projet Supabase.
-- Script idempotent : peut être rejoué sans risque.
-- =====================================================================

-- ---------- 0. Utilitaire updated_at ----------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ---------- 1. CONTEXTE D'ANALYSE ----------
CREATE TABLE IF NOT EXISTS public.contexte_analyse (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid REFERENCES public.organisations(id) ON DELETE SET NULL,
  nom text NOT NULL,
  perimetre text,
  objectifs text,
  criteres_acceptation text,
  methodologie text DEFAULT 'ISO 27005',
  parties_prenantes jsonb NOT NULL DEFAULT '[]'::jsonb,
  responsable text,
  date_analyse date DEFAULT current_date,
  date_revue date,
  version text DEFAULT '1.0',
  statut text NOT NULL DEFAULT 'Brouillon',
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contexte_analyse TO anon, authenticated;
GRANT ALL ON public.contexte_analyse TO service_role;
ALTER TABLE public.contexte_analyse ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Accès public contexte_analyse" ON public.contexte_analyse;
CREATE POLICY "Accès public contexte_analyse" ON public.contexte_analyse
  FOR ALL USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_contexte_analyse_updated ON public.contexte_analyse;
CREATE TRIGGER trg_contexte_analyse_updated BEFORE UPDATE ON public.contexte_analyse
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- 2. ACTIFS ----------
CREATE TABLE IF NOT EXISTS public.actifs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid REFERENCES public.organisations(id) ON DELETE SET NULL,
  processus_id uuid REFERENCES public.processus_metier(id) ON DELETE SET NULL,
  nom text NOT NULL,
  type text NOT NULL DEFAULT 'Information',
  description text,
  proprietaire text,
  localisation text,
  criticite integer NOT NULL DEFAULT 3 CHECK (criticite BETWEEN 1 AND 5),
  besoin_d integer NOT NULL DEFAULT 3 CHECK (besoin_d BETWEEN 1 AND 5), -- Disponibilité
  besoin_i integer NOT NULL DEFAULT 3 CHECK (besoin_i BETWEEN 1 AND 5), -- Intégrité
  besoin_c integer NOT NULL DEFAULT 3 CHECK (besoin_c BETWEEN 1 AND 5), -- Confidentialité
  besoin_t integer NOT NULL DEFAULT 3 CHECK (besoin_t BETWEEN 1 AND 5), -- Traçabilité
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.actifs TO anon, authenticated;
GRANT ALL ON public.actifs TO service_role;
ALTER TABLE public.actifs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Accès public actifs" ON public.actifs;
CREATE POLICY "Accès public actifs" ON public.actifs FOR ALL USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_actifs_updated ON public.actifs;
CREATE TRIGGER trg_actifs_updated BEFORE UPDATE ON public.actifs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- 3. MENACES ----------
CREATE TABLE IF NOT EXISTS public.menaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE,
  nom text NOT NULL,
  categorie text NOT NULL DEFAULT 'Cyber',
  origine text NOT NULL DEFAULT 'Externe',
  intention text NOT NULL DEFAULT 'Délibérée',
  description text,
  referentiel text DEFAULT 'ISO 27005',
  vulnerabilites_types text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menaces TO anon, authenticated;
GRANT ALL ON public.menaces TO service_role;
ALTER TABLE public.menaces ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Accès public menaces" ON public.menaces;
CREATE POLICY "Accès public menaces" ON public.menaces FOR ALL USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_menaces_updated ON public.menaces;
CREATE TRIGGER trg_menaces_updated BEFORE UPDATE ON public.menaces
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- 4. RISQUES (extension de la table existante) ----------
ALTER TABLE public.risques
  ADD COLUMN IF NOT EXISTS reference text,
  ADD COLUMN IF NOT EXISTS contexte_id uuid REFERENCES public.contexte_analyse(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS actif_id uuid REFERENCES public.actifs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS menace_id uuid REFERENCES public.menaces(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS processus_id uuid REFERENCES public.processus_metier(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vulnerabilite text,
  ADD COLUMN IF NOT EXISTS cause text,
  ADD COLUMN IF NOT EXISTS consequence text,
  ADD COLUMN IF NOT EXISTS probabilite integer DEFAULT 3,
  ADD COLUMN IF NOT EXISTS impact_financier integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS impact_operationnel integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS impact_juridique integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS impact_reputationnel integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS impact_humain integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS impact_environnemental integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS impact_global integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS score_brut integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS maitrise integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS mesures_existantes text,
  ADD COLUMN IF NOT EXISTS score_residuel integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS niveau text,
  ADD COLUMN IF NOT EXISTS decision text DEFAULT 'À décider',
  ADD COLUMN IF NOT EXISTS date_identification date DEFAULT current_date,
  ADD COLUMN IF NOT EXISTS date_revue date;

-- Numérotation automatique R-0001, R-0002, ...
CREATE SEQUENCE IF NOT EXISTS public.risques_reference_seq;
CREATE OR REPLACE FUNCTION public.set_risque_reference()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.reference IS NULL OR NEW.reference = '' THEN
    NEW.reference := 'R-' || lpad(nextval('public.risques_reference_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_risques_reference ON public.risques;
CREATE TRIGGER trg_risques_reference BEFORE INSERT ON public.risques
  FOR EACH ROW EXECUTE FUNCTION public.set_risque_reference();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.risques TO anon, authenticated;
GRANT ALL ON public.risques TO service_role;

-- ---------- 5. PLANS DE TRAITEMENT ----------
CREATE TABLE IF NOT EXISTS public.plans_traitement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  risque_id uuid NOT NULL REFERENCES public.risques(id) ON DELETE CASCADE,
  option_traitement text NOT NULL DEFAULT 'Réduire',
  mesure text NOT NULL,
  description text,
  type_mesure text DEFAULT 'Préventive',
  responsable text,
  echeance date,
  cout_estime numeric DEFAULT 0,
  charge_jh numeric DEFAULT 0,
  efficacite_attendue integer DEFAULT 3 CHECK (efficacite_attendue BETWEEN 1 AND 5),
  avancement integer NOT NULL DEFAULT 0 CHECK (avancement BETWEEN 0 AND 100),
  statut text NOT NULL DEFAULT 'À faire',
  commentaire text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plans_traitement TO anon, authenticated;
GRANT ALL ON public.plans_traitement TO service_role;
ALTER TABLE public.plans_traitement ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Accès public plans_traitement" ON public.plans_traitement;
CREATE POLICY "Accès public plans_traitement" ON public.plans_traitement FOR ALL USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_plans_traitement_updated ON public.plans_traitement;
CREATE TRIGGER trg_plans_traitement_updated BEFORE UPDATE ON public.plans_traitement
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- 6. PARAMÈTRES ----------
CREATE TABLE IF NOT EXISTS public.parametres_risques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cle text UNIQUE NOT NULL DEFAULT 'default',
  echelle_probabilite jsonb NOT NULL DEFAULT '[]'::jsonb,
  echelle_impact jsonb NOT NULL DEFAULT '[]'::jsonb,
  ponderation_axes jsonb NOT NULL DEFAULT '{}'::jsonb,
  seuil_acceptable integer NOT NULL DEFAULT 6,
  seuil_tolerable integer NOT NULL DEFAULT 12,
  periodicite_revue_mois integer NOT NULL DEFAULT 6,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parametres_risques TO anon, authenticated;
GRANT ALL ON public.parametres_risques TO service_role;
ALTER TABLE public.parametres_risques ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Accès public parametres_risques" ON public.parametres_risques;
CREATE POLICY "Accès public parametres_risques" ON public.parametres_risques FOR ALL USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_parametres_risques_updated ON public.parametres_risques;
CREATE TRIGGER trg_parametres_risques_updated BEFORE UPDATE ON public.parametres_risques
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.parametres_risques (cle, echelle_probabilite, echelle_impact, ponderation_axes)
VALUES (
  'default',
  '[{"n":1,"label":"Très improbable","desc":"Moins d''une fois tous les 10 ans"},
    {"n":2,"label":"Improbable","desc":"Une fois tous les 5 à 10 ans"},
    {"n":3,"label":"Possible","desc":"Une fois par an"},
    {"n":4,"label":"Probable","desc":"Plusieurs fois par an"},
    {"n":5,"label":"Quasi certain","desc":"Mensuel ou plus fréquent"}]'::jsonb,
  '[{"n":1,"label":"Négligeable","desc":"Aucun effet significatif"},
    {"n":2,"label":"Mineur","desc":"Effet limité, absorbé en interne"},
    {"n":3,"label":"Modéré","desc":"Effet notable sur les activités"},
    {"n":4,"label":"Majeur","desc":"Atteinte forte, remontée COMEX"},
    {"n":5,"label":"Catastrophique","desc":"Survie de l''organisation en jeu"}]'::jsonb,
  '{"financier":1,"operationnel":1,"juridique":1,"reputationnel":1,"humain":1,"environnemental":1}'::jsonb
)
ON CONFLICT (cle) DO NOTHING;

-- ---------- 7. RÉFÉRENTIEL DE MENACES (seed) ----------
INSERT INTO public.menaces (code, nom, categorie, origine, intention, description) VALUES
 ('M-01','Rançongiciel','Cyber','Externe','Délibérée','Chiffrement des données et demande de rançon'),
 ('M-02','Hameçonnage / ingénierie sociale','Cyber','Externe','Délibérée','Vol d''identifiants par manipulation des collaborateurs'),
 ('M-03','Déni de service (DDoS)','Cyber','Externe','Délibérée','Saturation des services exposés sur Internet'),
 ('M-04','Intrusion et exfiltration de données','Cyber','Externe','Délibérée','Compromission du SI et vol d''informations'),
 ('M-05','Malveillance interne','Cyber','Interne','Délibérée','Action nuisible d''un collaborateur ou prestataire'),
 ('M-06','Erreur humaine d''exploitation','Organisationnel','Interne','Accidentelle','Mauvaise manipulation entraînant une indisponibilité'),
 ('M-07','Panne matérielle serveur / stockage','Technique','Interne','Accidentelle','Défaillance d''un composant d''infrastructure'),
 ('M-08','Panne réseau / télécoms','Technique','Externe','Accidentelle','Perte de connectivité opérateur'),
 ('M-09','Corruption ou perte de données','Technique','Interne','Accidentelle','Altération de données, sauvegarde inexploitable'),
 ('M-10','Indisponibilité du cloud / SaaS','Technique','Externe','Accidentelle','Panne majeure chez un hébergeur ou éditeur'),
 ('M-11','Incendie','Physique','Externe','Accidentelle','Sinistre affectant un site ou un datacenter'),
 ('M-12','Dégât des eaux / inondation','Physique','Externe','Accidentelle','Sinistre lié à l''eau'),
 ('M-13','Coupure d''électricité prolongée','Physique','Externe','Accidentelle','Perte d''alimentation au-delà de l''autonomie'),
 ('M-14','Intrusion physique / vol','Physique','Externe','Délibérée','Accès non autorisé aux locaux'),
 ('M-15','Événement climatique extrême','Environnemental','Externe','Accidentelle','Tempête, canicule, séisme'),
 ('M-16','Pandémie / crise sanitaire','Humain','Externe','Accidentelle','Indisponibilité massive du personnel'),
 ('M-17','Grève / conflit social','Humain','Interne','Délibérée','Arrêt partiel ou total des activités'),
 ('M-18','Perte de compétences clés','Humain','Interne','Accidentelle','Départ d''un collaborateur irremplaçable à court terme'),
 ('M-19','Défaillance d''un fournisseur critique','Fournisseur','Externe','Accidentelle','Cessation ou dégradation de service d''un tiers'),
 ('M-20','Rupture de chaîne logistique','Fournisseur','Externe','Accidentelle','Approvisionnement interrompu'),
 ('M-21','Non-conformité réglementaire','Conformité','Interne','Accidentelle','Manquement RGPD, DORA, sectoriel'),
 ('M-22','Fraude externe','Conformité','Externe','Délibérée','Fraude au président, faux fournisseur'),
 ('M-23','Litige contractuel majeur','Conformité','Externe','Délibérée','Contentieux avec un client ou partenaire'),
 ('M-24','Atteinte à l''image / crise médiatique','Réputation','Externe','Délibérée','Campagne négative, bad buzz'),
 ('M-25','Obsolescence technologique','Technique','Interne','Accidentelle','Composants non maintenus, plus de support éditeur')
ON CONFLICT (code) DO NOTHING;

-- ---------- 8. Index utiles ----------
CREATE INDEX IF NOT EXISTS idx_risques_contexte ON public.risques(contexte_id);
CREATE INDEX IF NOT EXISTS idx_risques_actif ON public.risques(actif_id);
CREATE INDEX IF NOT EXISTS idx_risques_menace ON public.risques(menace_id);
CREATE INDEX IF NOT EXISTS idx_plans_risque ON public.plans_traitement(risque_id);
CREATE INDEX IF NOT EXISTS idx_actifs_processus ON public.actifs(processus_id);

-- Rafraîchit le cache de schéma PostgREST
NOTIFY pgrst, 'reload schema';
