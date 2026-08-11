// src/components/strategy/types.ts
export const RESILLIA = {
  navy: "#172030",
  creme: "#F8F6F2",
  vert: "#2A5141",
  vertPale: "#E8F0EC",
  rouge: "#C62828", // Changé pour matcher la charte
  rosePale: "#FFEBEE", // Changé pour matcher la charte
  ambre: "#A38730", // Changé pour matcher la charte
  ambrePale: "#FFF8E1", // Changé pour matcher la charte
  violet: "#5C4EA3", // Nouveau (pour À valider)
  violetPale: "#EAE6F7", // Nouveau
  neutre: "#F1EFE8", // Légèrement ajusté
  bordure: "#E5E2DD",
};

// 🔥 NOUVEAU : Les 5 statuts du workflow de validation
export const STATUTS_STRATEGIE = ["Brouillon", "En revue", "À valider", "Validée", "À revoir"] as const;
export type StatutStrategie = (typeof STATUTS_STRATEGIE)[number];

export const FAISABILITES = ["Faible", "Moyenne", "Élevée"] as const;
export type Faisabilite = (typeof FAISABILITES)[number];

export const FAISABILITE_SCORE: Record<string, number> = {
  Élevée: 5,
  Moyenne: 3,
  Faible: 1,
};

// 🔥 NOUVEAU MAPPING DES STYLES POUR LES 5 STATUTS
export const STATUT_STYLE: Record<string, { bg: string; text: string }> = {
  "Brouillon": { bg: "#F1EFE8", text: "#444441" },
  "En revue": { bg: "#FFF8E1", text: "#A38730" },
  "À valider": { bg: "#EAE6F7", text: "#5C4EA3" },
  "Validée": { bg: "#E8F5E9", text: "#2E7D32" },
  "À revoir": { bg: "#FBE9E7", text: "#C62828" },
};

export const FAISABILITE_STYLE: Record<string, { bg: string; text: string }> = {
  Élevée: { bg: RESILLIA.vertPale, text: RESILLIA.vert },
  Moyenne: { bg: RESILLIA.ambrePale, text: RESILLIA.ambre },
  Faible: { bg: RESILLIA.rosePale, text: RESILLIA.rouge },
};

export const SCENARIOS_TYPES = [
  "Cyberattaque / rançongiciel",
  "Indisponibilité du système d'information",
  "Indisponibilité des locaux",
  "Indisponibilité des personnes",
  "Défaillance fournisseur / tiers critique",
  "Crise sanitaire",
  "Sinistre majeur (incendie, inondation)",
];

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
};

export const checkRto = (delai?: number | null, rto?: number | null) => {
  if (delai === undefined || delai === null || rto === undefined || rto === null) {
    return { known: false, ok: false, ecart: 0 };
  }
  return { known: true, ok: Number(delai) <= Number(rto), ecart: Number(delai) - Number(rto) };
};

// 🔥 VALEUR PAR DÉFAUT MISE À JOUR : "Brouillon" au lieu de "Proposée"
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
  statut: "Brouillon", // 🔥 ICI
  lien_pca_id: "",
});