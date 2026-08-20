// src/components/plans/types.ts — Module M5 « Gestion des Plans »

export const R = {
  navy: "#172030",
  creme: "#F8F6F2",
  vert: "#2A5141",
  bordure: "#E8E4DC",
};

export const PLAN_TYPES = ["PCA", "PRA", "Crise", "Communication"] as const;
export type PlanType = (typeof PLAN_TYPES)[number];

export const PLAN_TYPE_LABEL: Record<string, string> = {
  PCA: "Plan de Continuité d'Activité",
  PRA: "Plan de Reprise d'Activité",
  Crise: "Plan de Crise",
  Communication: "Plan de Communication",
};

export const PLAN_STATUTS = ["Brouillon", "En révision", "Approuvé", "À réviser", "Archivé"] as const;
export type PlanStatut = (typeof PLAN_STATUTS)[number];

export const STATUT_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  "Approuvé": { bg: "#E8F5E9", text: "#2E7D32", border: "#2E7D32" },
  "En révision": { bg: "#FFF3E0", text: "#B26A00", border: "#E08A1E" },
  "À réviser": { bg: "#FFEBEE", text: "#C62828", border: "#C62828" },
  "Brouillon": { bg: "#F1EFE8", text: "#4A4A44", border: "#B8B3A6" },
  "Archivé": { bg: "#F1EFE8", text: "#8A857A", border: "#B8B3A6" },
};

export const TYPE_STYLE: Record<string, { bg: string; text: string }> = {
  PCA: { bg: "#E8F0EC", text: "#2A5141" },
  PRA: { bg: "#E7EEF6", text: "#1F4E79" },
  Crise: { bg: "#FBE9E7", text: "#C62828" },
  Communication: { bg: "#EAE6F7", text: "#5C4EA3" },
};

export const WORKFLOW_ETAPES = ["Rédaction", "Revue métier", "Validation PCA", "Validation Direction"] as const;
export type WorkflowEtape = (typeof WORKFLOW_ETAPES)[number];

export const DEFAULT_SECTIONS = [
  "Introduction",
  "Périmètre",
  "Gouvernance",
  "Déclenchement",
  "Procédures",
  "Ressources",
  "Communication",
  "Retour à la normale",
  "Annexes",
];

export const RESOURCE_TYPES = [
  { id: "ressources_humaines", label: "Ressources humaines", icon: "👤" },
  { id: "ressources_equipements", label: "Équipements", icon: "💻" },
  { id: "applications_it", label: "Applications IT", icon: "🖥" },
  { id: "fournisseurs", label: "Fournisseurs", icon: "🏢" },
] as const;

export type ResourceType = (typeof RESOURCE_TYPES)[number]["id"];

export type Plan = {
  id: string;
  type: string | null;
  titre: string;
  numero_version: number | null;
  plan_parent_id: string | null;
  entite_id: string | null;
  statut: string | null;
  redacteur: string | null;
  validateur_metier: string | null;
  responsable_pca: string | null;
  date_approbation: string | null;
  date_revision_suivante: string | null;
  est_actif: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type PlanSection = {
  id: string;
  plan_id: string;
  ordre: number | null;
  titre: string;
  contenu: string | null;
  statut: string | null;
};

export type PlanProcedure = { id: string; section_id: string; titre: string; ordre: number | null };

export type PlanEtape = {
  id: string;
  procedure_id: string;
  ordre: number | null;
  description: string | null;
  responsable: string | null;
  duree_estimee_minutes: number | null;
};

export type PlanEtapeRessource = {
  id: string;
  etape_id: string;
  resource_type: string;
  resource_id: string;
};

export type PlanContact = {
  id: string;
  plan_id: string;
  ordre: number | null;
  nom: string | null;
  role: string | null;
  telephone: string | null;
  email: string | null;
  est_suppleant: boolean | null;
};

export type PlanVersion = {
  id: string;
  plan_id: string;
  numero_version: number | null;
  snapshot: any;
  created_at: string | null;
  created_by: string | null;
};

export type WorkflowEntry = {
  id: string;
  plan_id: string;
  etape: string;
  validateur: string | null;
  statut: string | null;
  commentaire: string | null;
  date: string | null;
};

/** Statut effectif : un plan approuvé dont la date de révision est dépassée passe « À réviser ». */
export const effectiveStatut = (plan: Pick<Plan, "statut" | "date_revision_suivante">): string => {
  const s = plan.statut || "Brouillon";
  if (s === "Approuvé" && plan.date_revision_suivante) {
    const d = new Date(plan.date_revision_suivante);
    if (!isNaN(d.getTime()) && d.getTime() < Date.now()) return "À réviser";
  }
  return s;
};

export const isRevisionDue = (plan: Pick<Plan, "statut" | "date_revision_suivante">) =>
  effectiveStatut(plan) === "À réviser";

export const fmtDate = (v?: string | null) => {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
};

export const MISSING_TABLE = "PGRST205";
