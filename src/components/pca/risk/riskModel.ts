// Modèle de données pour le module « Analyse des Risques »

export type ContexteAnalyse = {
  id: string;
  organisation_id: string | null;
  nom: string;
  perimetre: string | null;
  objectifs: string | null;
  criteres_acceptation: string | null;
  methodologie: string | null;
  parties_prenantes: string[];
  responsable: string | null;
  date_analyse: string | null;
  date_revue: string | null;
  version: string | null;
  statut: string;
  actif: boolean;
};

export type Actif = {
  id: string;
  organisation_id: string | null;
  processus_id: string | null;
  nom: string;
  type: string;
  description: string | null;
  proprietaire: string | null;
  localisation: string | null;
  criticite: number;
  besoin_d: number;
  besoin_i: number;
  besoin_c: number;
  besoin_t: number;
};

export type Menace = {
  id: string;
  code: string | null;
  nom: string;
  categorie: string;
  origine: string;
  intention: string;
  description: string | null;
  referentiel: string | null;
};

export type Risque = {
  id: string;
  reference: string | null;
  title: string;
  description: string | null;
  category: string | null;
  owner: string | null;
  status: string | null;
  contexte_id: string | null;
  actif_id: string | null;
  menace_id: string | null;
  processus_id: string | null;
  vulnerabilite: string | null;
  cause: string | null;
  consequence: string | null;
  probabilite: number;
  impact: number;  // Simplifié : un seul impact au lieu de 6 axes
  impact_global: number;
  score_brut: number;
  maitrise: number;
  mesures_existantes: string | null;
  score_residuel: number;
  niveau: string | null;
  decision: string | null;
  date_identification: string | null;
  date_revue: string | null;
  updated_at?: string | null;
  direction?: string | null;
  [key: string]: any;
};

export type PlanTraitement = {
  id: string;
  risque_id: string;
  option_traitement: OptionTraitement;
  mesure: string;
  description: string | null;
  type_mesure: string | null;
  responsable: string | null;
  echeance: string | null;
  cout_estime: number | null;
  charge_jh: number | null;
  efficacite_attendue: number;
  avancement: number;
  statut: StatutMesure;
  commentaire: string | null;
};

export type ParametresRisques = {
  id?: string;
  cle: string;
  echelle_probabilite: EchelonEchelle[];
  echelle_impact: EchelonEchelle[];
  ponderation_axes: Partial<Record<AxeImpact, number>>;
  seuil_acceptable: number;
  seuil_tolerable: number;
  periodicite_revue_mois: number;
};

export type EchelonEchelle = { n: number; label: string; desc: string };

export type AxeImpact =
  | "financier"
  | "operationnel"
  | "juridique"
  | "reputationnel"
  | "humain"
  | "environnemental";

export const AXES_IMPACT: { id: AxeImpact; col: string; label: string; icon: string }[] = [
  { id: "financier", col: "impact_financier", label: "Financier", icon: "💶" },
  { id: "operationnel", col: "impact_operationnel", label: "Opérationnel", icon: "⚙️" },
  { id: "juridique", col: "impact_juridique", label: "Juridique / Conformité", icon: "⚖️" },
  { id: "reputationnel", col: "impact_reputationnel", label: "Réputationnel", icon: "📣" },
  { id: "humain", col: "impact_humain", label: "Humain", icon: "🧑" },
  { id: "environnemental", col: "impact_environnemental", label: "Environnemental", icon: "🌱" },
];

export type NiveauRisque = "Faible" | "Modéré" | "Élevé" | "Critique";

export const STATUTS_RISQUE = ["À analyser", "En cours", "Évalué", "Traité", "Clôturé"] as const;
export const CATEGORIES_RISQUE = ["Cyber", "Physique", "Technique", "Humain", "Fournisseur", "Réglementaire", "Stratégique"] as const;
export const CATEGORIES_MENACE = ["Cyber", "Technique", "Physique", "Humain", "Organisationnel", "Fournisseur", "Conformité", "Réputation", "Environnemental"] as const;
export const ORIGINES_MENACE = ["Interne", "Externe"] as const;
export const INTENTIONS_MENACE = ["Délibérée", "Accidentelle"] as const;
export const TYPES_ACTIF = ["Information", "Application", "Infrastructure", "Personne", "Site", "Fournisseur", "Processus"] as const;

export type OptionTraitement = "Réduire" | "Transférer" | "Accepter" | "Éviter";
export const OPTIONS_TRAITEMENT: OptionTraitement[] = ["Réduire", "Transférer", "Accepter", "Éviter"];

export type StatutMesure = "À faire" | "En cours" | "Terminé" | "Acceptée";
export const STATUTS_MESURE: StatutMesure[] = ["À faire", "En cours", "Terminé", "Acceptée"];

export const emptyRisque = (): Partial<Risque> => ({
  title: "",
  description: "",
  category: "Cyber",
  owner: "",
  status: "À analyser",
  probabilite: 3,
  impact: 3,
  score_brut: 9,
  maitrise: 1,
  score_residuel: 9,
  niveau: "Faible",
  mesures_existantes: "",
  date_identification: new Date().toISOString().split('T')[0],
});

export const emptyActif = (): Partial<Actif> => ({
  nom: "",
  type: "Information",
  description: "",
  proprietaire: "",
  localisation: "",
  criticite: 3,
  besoin_d: 3,
  besoin_i: 3,
  besoin_c: 3,
  besoin_t: 3,
});

export const emptyMenace = (): Partial<Menace> => ({
  nom: "",
  code: "",
  categorie: "Cyber",
  origine: "Externe",
  intention: "Délibérée",
  description: "",
  referentiel: "",
});

export const scoreToNiveau = (score: number, _params?: any): NiveauRisque => {
  if (score <= 6) return "Faible";
  if (score <= 12) return "Modéré";
  if (score <= 18) return "Élevé";
  return "Critique";
};

export const NIVEAU_STYLE: Record<NiveauRisque, { badge: string; dot: string; hex: string }> = {
  Faible: { 
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200", 
    dot: "bg-emerald-500", 
    hex: "#10b981" 
  },
  Modéré: { 
    badge: "bg-amber-50 text-amber-700 border-amber-200", 
    dot: "bg-amber-500", 
    hex: "#f59e0b" 
  },
  Élevé: { 
    badge: "bg-orange-50 text-orange-700 border-orange-200", 
    dot: "bg-orange-500", 
    hex: "#f97316" 
  },
  Critique: { 
    badge: "bg-rose-50 text-rose-700 border-rose-200", 
    dot: "bg-rose-500", 
    hex: "#e11d48" 
  },
};

export const recompute = (r: Partial<Risque>) => {
  const proba = r.probabilite ?? 3;
  const impact = r.impact ?? 3;
  const score_brut = proba * impact;
  const maitrise = r.maitrise ?? 1;
  const score_residuel = Math.max(1, Math.round(score_brut * (1 - 0.15 * (maitrise - 1))));
  const niveau = scoreToNiveau(score_residuel);
  return { impact_global: impact, score_brut, score_residuel, niveau };
};

export const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";