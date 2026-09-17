// src/components/strategy/types.ts
export const RESILLIA = {
  navy: "#172030",
  creme: "#F8F6F2",
  vert: "#2A5141",
  vertPale: "#E8F0EC",
  rouge: "#C62828",
  rosePale: "#FFEBEE",
  ambre: "#A38730",
  ambrePale: "#FFF8E1",
  violet: "#5C4EA3",
  violetPale: "#EAE6F7",
  neutre: "#F1EFE8",
  bordure: "#E5E2DD",
};

// ============================================================
// STATUTS DE VALIDATION
// ============================================================
export const STATUTS_STRATEGIE = ["Brouillon", "En revue", "À valider", "Validée", "À revoir"] as const;
export type StatutStrategie = (typeof STATUTS_STRATEGIE)[number];

export const STATUT_STYLE: Record<string, { bg: string; text: string }> = {
  "Brouillon": { bg: "#F1EFE8", text: "#444441" },
  "En revue": { bg: "#FFF8E1", text: "#A38730" },
  "À valider": { bg: "#EAE6F7", text: "#5C4EA3" },
  "Validée": { bg: "#E8F5E9", text: "#2E7D32" },
  "À revoir": { bg: "#FBE9E7", text: "#C62828" },
};

// ============================================================
// EFFORT DE MISE EN ŒUVRE
// ============================================================
export const EFFORTS = ["Faible", "Moyen", "Élevé"] as const;
export type Effort = (typeof EFFORTS)[number];

export const EFFORT_STYLE: Record<Effort, { bg: string; text: string }> = {
  Faible: { bg: "#E8F5E9", text: "#2E7D32" },
  Moyen: { bg: "#FFF8E1", text: "#A38730" },
  Élevé: { bg: "#FBE9E7", text: "#C62828" },
};

// Compat avec l'existant
export const FAISABILITES = ["Faible", "Moyenne", "Élevée"] as const;
export type Faisabilite = (typeof FAISABILITES)[number];

export const FAISABILITE_SCORE: Record<string, number> = {
  Élevée: 5,
  Moyenne: 3,
  Faible: 1,
};

export const FAISABILITE_STYLE: Record<string, { bg: string; text: string }> = {
  Élevée: { bg: RESILLIA.vertPale, text: RESILLIA.vert },
  Moyenne: { bg: RESILLIA.ambrePale, text: RESILLIA.ambre },
  Faible: { bg: RESILLIA.rosePale, text: RESILLIA.rouge },
};

// ============================================================
// SCÉNARIOS
// ============================================================
export const SCENARIOS_TYPES = [
  "Cyberattaque / rançongiciel",
  "Indisponibilité du système d'information",
  "Indisponibilité des locaux",
  "Indisponibilité des personnes",
  "Défaillance fournisseur / tiers critique",
  "Crise sanitaire",
  "Sinistre majeur (incendie, inondation)",
];

// ============================================================
// TYPES
// ============================================================
export type ProcessusLite = {
  id: string;
  name: string;
  direction?: string | null;
  owner?: string | null;
  description?: string | null;
  criticality_level?: string | null;
  rto_hours?: number | null;
  rpo_hours?: number | null;
  status?: string | null;
  is_critical?: boolean | null;
  impacts?: any;
};

export type StrategieCatalogue = {
  id: string;
  nom: string;
  description: string | null;
  type: string;
  iconName?: string;
  created_at?: string;
};

export type StrategieAssociation = {
  id: string;
  strategie_id: string;
  processus_id: string;
  scenario_id: string | null;
  justification: string | null;
  delai_estime_heures: number;
  cout_estime: number;
  prerequis: string | null;
  robustesse: number;
  faisabilite: string;
  tiers_critique: boolean;
  contrat_reference: string | null;
  sla_reference: string | null;
  statut: string;
  lien_pca_id: string | null;
  created_at?: string;
  updated_at?: string;
  // ✅ NOUVEAUX CHAMPS
  effort?: Effort | null;
  rto_atteignable?: number | null;
  validateur?: string | null;
  date_validation?: string | null;
};

// ============================================================
// CALCUL D'ÉCART RTO
// ============================================================
export const checkRto = (delai?: number | null, rto?: number | null) => {
  if (delai === undefined || delai === null || rto === undefined || rto === null) {
    return { known: false, ok: false, ecart: 0 };
  }
  return { known: true, ok: Number(delai) <= Number(rto), ecart: Number(delai) - Number(rto) };
};

// ============================================================
// ALERTE DE PÉREMPTION
// ============================================================
const PEREMPTION_MONTHS = 6;

export const isStale = (updatedAt?: string | null): boolean => {
  if (!updatedAt) return false;
  const sixMonthsAgo = Date.now() - PEREMPTION_MONTHS * 30 * 24 * 60 * 60 * 1000;
  return new Date(updatedAt).getTime() < sixMonthsAgo;
};

// ============================================================
// VALEURS PAR DÉFAUT
// ============================================================
export const emptyAssociation = (): Partial<StrategieAssociation> => ({
  strategie_id: "",
  processus_id: "",
  scenario_id: "",
  justification: "",
  delai_estime_heures: 24,
  cout_estime: 0,
  prerequis: "",
  robustesse: 3,
  faisabilite: "Moyenne",
  tiers_critique: false,
  contrat_reference: "",
  sla_reference: "",
  statut: "Brouillon",
  lien_pca_id: "",
  effort: "Moyen",
  rto_atteignable: null,
  validateur: null,
  date_validation: null,
});