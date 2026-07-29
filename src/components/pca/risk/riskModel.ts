// Modèle de données et règles de calcul du module « Analyse des Risques »
// Aligné sur le schéma SQL supabase/manual/2026-07-29_module_risques.sql

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
  impact_financier: number;
  impact_operationnel: number;
  impact_juridique: number;
  impact_reputationnel: number;
  impact_humain: number;
  impact_environnemental: number;
  impact_global: number;
  score_brut: number;
  maitrise: number;
  mesures_existantes: string | null;
  score_residuel: number;
  niveau: string | null;
  decision: string | null;
  date_identification: string | null;
  date_revue: string | null;
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
  ponderation_axes: Record<AxeImpact, number>;
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

export const AXES_IMPACT: { id: AxeImpact; col: keyof Risque; label: string; icon: string }[] = [
  { id: "financier", col: "impact_financier", label: "Financier", icon: "💶" },
  { id: "operationnel", col: "impact_operationnel", label: "Opérationnel", icon: "⚙️" },
  { id: "juridique", col: "impact_juridique", label: "Juridique / Conformité", icon: "⚖️" },
  { id: "reputationnel", col: "impact_reputationnel", label: "Réputationnel", icon: "📣" },
  { id: "humain", col: "impact_humain", label: "Humain", icon: "🧑" },
  { id: "environnemental", col: "impact_environnemental", label: "Environnemental", icon: "🌱" },
];

export const TYPES_ACTIF = [
  "Information",
  "Application",
  "Infrastructure",
  "Personne",
  "Site",
  "Fournisseur",
  "Processus",
] as const;

export const CATEGORIES_MENACE = [
  "Cyber",
  "Technique",
  "Physique",
  "Humain",
  "Organisationnel",
  "Fournisseur",
  "Conformité",
  "Réputation",
  "Environnemental",
] as const;

export const ORIGINES_MENACE = ["Interne", "Externe"] as const;
export const INTENTIONS_MENACE = ["Délibérée", "Accidentelle"] as const;

export type OptionTraitement = "Réduire" | "Transférer" | "Accepter" | "Éviter";
export const OPTIONS_TRAITEMENT: OptionTraitement[] = ["Réduire", "Transférer", "Accepter", "Éviter"];

export type StatutMesure = "À faire" | "En cours" | "Terminé" | "Acceptée";
export const STATUTS_MESURE: StatutMesure[] = ["À faire", "En cours", "Terminé", "Acceptée"];

export const STATUTS_RISQUE = ["À analyser", "En cours", "Évalué", "Traité", "Clôturé"] as const;
export const DECISIONS = ["À décider", "Réduire", "Transférer", "Accepter", "Éviter"] as const;

export const DEFAULT_PARAMS: ParametresRisques = {
  cle: "default",
  echelle_probabilite: [
    { n: 1, label: "Très improbable", desc: "Moins d'une fois tous les 10 ans" },
    { n: 2, label: "Improbable", desc: "Une fois tous les 5 à 10 ans" },
    { n: 3, label: "Possible", desc: "Une fois par an" },
    { n: 4, label: "Probable", desc: "Plusieurs fois par an" },
    { n: 5, label: "Quasi certain", desc: "Mensuel ou plus fréquent" },
  ],
  echelle_impact: [
    { n: 1, label: "Négligeable", desc: "Aucun effet significatif" },
    { n: 2, label: "Mineur", desc: "Effet limité, absorbé en interne" },
    { n: 3, label: "Modéré", desc: "Effet notable sur les activités" },
    { n: 4, label: "Majeur", desc: "Atteinte forte, remontée COMEX" },
    { n: 5, label: "Catastrophique", desc: "Survie de l'organisation en jeu" },
  ],
  ponderation_axes: {
    financier: 1,
    operationnel: 1,
    juridique: 1,
    reputationnel: 1,
    humain: 1,
    environnemental: 1,
  },
  seuil_acceptable: 6,
  seuil_tolerable: 12,
  periodicite_revue_mois: 6,
};

const clamp = (v: number, min = 1, max = 5) => Math.min(max, Math.max(min, v));

/** Impact global = 60 % du pire axe + 40 % de la moyenne pondérée des axes. */
export const computeImpactGlobal = (
  values: Record<AxeImpact, number>,
  ponderation: Record<AxeImpact, number> = DEFAULT_PARAMS.ponderation_axes
): number => {
  const axes = AXES_IMPACT.map((a) => a.id);
  const max = Math.max(...axes.map((a) => values[a] || 1));
  const totalPoids = axes.reduce((s, a) => s + (ponderation[a] ?? 1), 0) || 1;
  const moyenne = axes.reduce((s, a) => s + (values[a] || 1) * (ponderation[a] ?? 1), 0) / totalPoids;
  return clamp(Math.round(max * 0.6 + moyenne * 0.4));
};

/** Score brut = probabilité × impact global (1 à 25). */
export const computeScoreBrut = (probabilite: number, impactGlobal: number) =>
  clamp(probabilite, 1, 5) * clamp(impactGlobal, 1, 5);

/** Score résiduel : chaque niveau de maîtrise au-delà de 1 réduit le brut de 15 %. */
export const computeScoreResiduel = (scoreBrut: number, maitrise: number) =>
  Math.max(1, Math.round(scoreBrut * (1 - 0.15 * (clamp(maitrise, 1, 5) - 1))));

export type NiveauRisque = "Faible" | "Modéré" | "Élevé" | "Critique";

export const scoreToNiveau = (score: number, p: ParametresRisques = DEFAULT_PARAMS): NiveauRisque => {
  if (score <= p.seuil_acceptable) return "Faible";
  if (score <= p.seuil_tolerable) return "Modéré";
  if (score <= 18) return "Élevé";
  return "Critique";
};

export const NIVEAU_STYLE: Record<NiveauRisque, { badge: string; dot: string; hex: string }> = {
  Faible: { badge: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500", hex: "#10b981" },
  Modéré: { badge: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500", hex: "#f59e0b" },
  Élevé: { badge: "bg-orange-50 text-orange-700 border-orange-200", dot: "bg-orange-500", hex: "#f97316" },
  Critique: { badge: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-500", hex: "#e11d48" },
};

/** Recalcule tous les champs dérivés d'un risque. */
export const recompute = (r: Partial<Risque>, p: ParametresRisques = DEFAULT_PARAMS) => {
  const values = {
    financier: r.impact_financier ?? 1,
    operationnel: r.impact_operationnel ?? 1,
    juridique: r.impact_juridique ?? 1,
    reputationnel: r.impact_reputationnel ?? 1,
    humain: r.impact_humain ?? 1,
    environnemental: r.impact_environnemental ?? 1,
  } as Record<AxeImpact, number>;
  const impact_global = computeImpactGlobal(values, p.ponderation_axes);
  const score_brut = computeScoreBrut(r.probabilite ?? 3, impact_global);
  const score_residuel = computeScoreResiduel(score_brut, r.maitrise ?? 1);
  return { impact_global, score_brut, score_residuel, niveau: scoreToNiveau(score_residuel, p) };
};

export const emptyRisque = (): Partial<Risque> => ({
  title: "",
  description: "",
  category: null,
  owner: "",
  status: "À analyser",
  probabilite: 3,
  impact_financier: 1,
  impact_operationnel: 1,
  impact_juridique: 1,
  impact_reputationnel: 1,
  impact_humain: 1,
  impact_environnemental: 1,
  maitrise: 1,
  decision: "À décider",
});

export const monthsSince = (date?: string | null) => {
  if (!date) return Infinity;
  const d = new Date(date).getTime();
  if (Number.isNaN(d)) return Infinity;
  return (Date.now() - d) / (1000 * 60 * 60 * 24 * 30.44);
};

export const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";
