export type RiskCategory = "Cyber" | "Physique" | "Technique" | "Humain" | "Fournisseur";

export const CATEGORY_LABELS: Record<RiskCategory, string> = {
  Cyber: "Cyber",
  Physique: "Physique",
  Technique: "Technique",
  Humain: "Humain",
  Fournisseur: "Fournisseur",
};

export const categoryColor = (c: RiskCategory) => {
  switch (c) {
    case "Cyber": return "bg-destructive/15 text-destructive border-destructive/30";
    case "Physique": return "bg-warning/15 text-warning border-warning/30";
    case "Technique": return "bg-primary/15 text-primary border-primary/30";
    case "Humain": return "bg-accent/15 text-accent border-accent/30";
    case "Fournisseur": return "bg-success/15 text-success border-success/30";
  }
};

export type PropagationSpeed = "Lente" | "Moyenne" | "Rapide" | "Immédiate";

export type MeasureType = "Prévention" | "Réduction" | "Transfert" | "Acceptation";
export type MeasureStatus = "À faire" | "En cours" | "Terminé" | "Accepté";

export type TreatmentMeasure = {
  id: string;
  type: MeasureType;
  description: string;
  responsible: string;
  deadline: string;
  status: MeasureStatus;
  cost: number;
};

export type RiskScenario = {
  id: string;
  name: string;
  category: RiskCategory;
  description: string;
  probability: number; // 1-5
  impact: number; // 1-5
  propagationSpeed: PropagationSpeed;
  residualProbability: number; // 1-5 after measures
  residualImpact: number; // 1-5 after measures
  criticalProcesses: string[];
  resources: string[];
  measures: TreatmentMeasure[];
  associatedPca?: string;
  lastUpdated: string;
};

export const rawScore = (s: RiskScenario) => s.probability * s.impact;
export const residualScore = (s: RiskScenario) => s.residualProbability * s.residualImpact;

export const scoreLevel = (score: number): "low" | "medium" | "high" | "critical" => {
  if (score >= 15) return "critical";
  if (score >= 9) return "high";
  if (score >= 4) return "medium";
  return "low";
};

export const cellColor = (probability: number, impact: number) => {
  const s = probability * impact;
  if (s >= 15) return "bg-destructive/85 text-destructive-foreground";
  if (s >= 9) return "bg-warning/80 text-warning-foreground";
  if (s >= 4) return "bg-accent/70 text-accent-foreground";
  return "bg-success/70 text-success-foreground";
};

export const levelLabel = (lvl: ReturnType<typeof scoreLevel>) => {
  return { low: "Faible", medium: "Modéré", high: "Élevé", critical: "Critique" }[lvl];
};

export type RiskAppetite = {
  acceptable: number;
  tolerable: number;
  unacceptable: number;
  lastReview: string;
};

export const initialScenarios: RiskScenario[] = [
  {
    id: "rs1",
    name: "Cyberattaque par ransomware",
    category: "Cyber",
    description: "Chiffrement massif des systèmes critiques par un rançongiciel, paralysant l'activité.",
    probability: 4, impact: 5, propagationSpeed: "Rapide",
    residualProbability: 2, residualImpact: 4,
    criticalProcesses: ["pr1", "pr5", "pr6"],
    resources: ["SIEM", "Sauvegardes offline"],
    measures: [
      { id: "m1", type: "Prévention", description: "Durcissement EDR sur tous les endpoints", responsible: "Antoine Garcia", deadline: "2026-06-30", status: "En cours", cost: 120000 },
      { id: "m2", type: "Réduction", description: "Sauvegardes immuables et tests de restauration", responsible: "Thomas Robert", deadline: "2026-05-15", status: "Terminé", cost: 85000 },
      { id: "m3", type: "Transfert", description: "Cyber-assurance étendue", responsible: "Direction Risques", deadline: "2026-04-01", status: "Terminé", cost: 250000 },
    ],
    associatedPca: "PCA Cyber",
    lastUpdated: "2026-03-10",
  },
  {
    id: "rs2",
    name: "Attaque DDoS sur services en ligne",
    category: "Cyber",
    description: "Saturation des accès clients web et API publiques.",
    probability: 5, impact: 3, propagationSpeed: "Immédiate",
    residualProbability: 2, residualImpact: 2,
    criticalProcesses: ["pr2"],
    resources: ["CDN", "WAF anti-DDoS"],
    measures: [
      { id: "m4", type: "Prévention", description: "Mise en place protection anti-DDoS niveau 7", responsible: "Antoine Garcia", deadline: "2026-04-30", status: "Terminé", cost: 65000 },
    ],
    associatedPca: "PCA Cyber",
    lastUpdated: "2026-02-20",
  },
  {
    id: "rs3",
    name: "Incendie datacenter primaire",
    category: "Physique",
    description: "Sinistre majeur entraînant l'indisponibilité prolongée du DC1.",
    probability: 2, impact: 5, propagationSpeed: "Rapide",
    residualProbability: 1, residualImpact: 3,
    criticalProcesses: ["pr1", "pr5"],
    resources: ["Datacenter secondaire", "Liens télécom redondants"],
    measures: [
      { id: "m5", type: "Réduction", description: "Bascule automatisée vers DC2", responsible: "Thomas Robert", deadline: "2026-09-30", status: "En cours", cost: 320000 },
      { id: "m6", type: "Prévention", description: "Système d'extinction automatique gaz inerte", responsible: "Direction Sites", deadline: "2026-07-15", status: "À faire", cost: 95000 },
    ],
    associatedPca: "PCA IT",
    lastUpdated: "2026-01-25",
  },
  {
    id: "rs4",
    name: "Inondation site siège",
    category: "Physique",
    description: "Crue de la Seine impactant l'accès au siège social.",
    probability: 2, impact: 3, propagationSpeed: "Moyenne",
    residualProbability: 2, residualImpact: 2,
    criticalProcesses: ["pr4"],
    resources: ["Site de repli", "Télétravail"],
    measures: [
      { id: "m7", type: "Réduction", description: "Plan de bascule télétravail généralisé", responsible: "Julie Moreau", deadline: "2026-05-30", status: "En cours", cost: 35000 },
    ],
    lastUpdated: "2025-11-12",
  },
  {
    id: "rs5",
    name: "Catastrophe naturelle (séisme)",
    category: "Physique",
    description: "Évènement sismique affectant les infrastructures régionales.",
    probability: 1, impact: 5, propagationSpeed: "Immédiate",
    residualProbability: 1, residualImpact: 4,
    criticalProcesses: ["pr5"],
    resources: ["Site géographique distant"],
    measures: [
      { id: "m8", type: "Acceptation", description: "Risque résiduel accepté par le COMEX", responsible: "COMEX", deadline: "2026-12-31", status: "Accepté", cost: 0 },
    ],
    lastUpdated: "2025-09-18",
  },
  {
    id: "rs6",
    name: "Panne majeure du SI core",
    category: "Technique",
    description: "Indisponibilité prolongée du système d'information central.",
    probability: 3, impact: 5, propagationSpeed: "Rapide",
    residualProbability: 2, residualImpact: 3,
    criticalProcesses: ["pr1", "pr5"],
    resources: ["Architecture haute disponibilité"],
    measures: [
      { id: "m9", type: "Réduction", description: "Cluster actif/actif multi-zones", responsible: "Thomas Robert", deadline: "2026-08-15", status: "En cours", cost: 450000 },
    ],
    associatedPca: "PCA IT",
    lastUpdated: "2026-02-05",
  },
  {
    id: "rs7",
    name: "Défaillance datacenter secondaire",
    category: "Technique",
    description: "Perte du site de secours rendant le PCA IT inopérant.",
    probability: 2, impact: 4, propagationSpeed: "Moyenne",
    residualProbability: 1, residualImpact: 3,
    criticalProcesses: ["pr5"],
    resources: ["Datacenter tertiaire cloud"],
    measures: [
      { id: "m10", type: "Réduction", description: "Évaluation 3e site cloud", responsible: "Thomas Robert", deadline: "2026-10-30", status: "À faire", cost: 180000 },
    ],
    lastUpdated: "2025-12-20",
  },
  {
    id: "rs8",
    name: "Épidémie / pandémie",
    category: "Humain",
    description: "Indisponibilité massive du personnel sur une période prolongée.",
    probability: 3, impact: 4, propagationSpeed: "Moyenne",
    residualProbability: 2, residualImpact: 2,
    criticalProcesses: ["pr1", "pr3"],
    resources: ["Télétravail", "Plan pandémie"],
    measures: [
      { id: "m11", type: "Prévention", description: "Maintien capacité télétravail 100%", responsible: "Julie Moreau", deadline: "2026-04-30", status: "Terminé", cost: 75000 },
    ],
    associatedPca: "PCA Pandémie",
    lastUpdated: "2026-03-01",
  },
  {
    id: "rs9",
    name: "Mouvement social majeur",
    category: "Humain",
    description: "Grève prolongée affectant les opérations critiques.",
    probability: 3, impact: 3, propagationSpeed: "Moyenne",
    residualProbability: 2, residualImpact: 2,
    criticalProcesses: ["pr3"],
    resources: ["Personnel de remplacement", "Externalisation"],
    measures: [
      { id: "m12", type: "Réduction", description: "Pool d'intérimaires qualifiés", responsible: "Julie Moreau", deadline: "2026-06-15", status: "En cours", cost: 45000 },
    ],
    lastUpdated: "2025-10-08",
  },
  {
    id: "rs10",
    name: "Accident collectif",
    category: "Humain",
    description: "Évènement affectant simultanément plusieurs collaborateurs clés.",
    probability: 1, impact: 4, propagationSpeed: "Immédiate",
    residualProbability: 1, residualImpact: 3,
    criticalProcesses: ["pr1"],
    resources: ["Cellule de crise"],
    measures: [
      { id: "m13", type: "Prévention", description: "Plan de succession des postes clés", responsible: "Julie Moreau", deadline: "2026-09-30", status: "À faire", cost: 25000 },
    ],
    lastUpdated: "2025-08-15",
  },
  {
    id: "rs11",
    name: "Défaillance fournisseur critique",
    category: "Fournisseur",
    description: "Faillite ou rupture de service d'un prestataire stratégique.",
    probability: 3, impact: 4, propagationSpeed: "Lente",
    residualProbability: 2, residualImpact: 3,
    criticalProcesses: ["pr1", "pr6"],
    resources: ["Fournisseurs alternatifs"],
    measures: [
      { id: "m14", type: "Réduction", description: "Double sourcing sur prestataires critiques", responsible: "Direction Achats", deadline: "2026-11-30", status: "En cours", cost: 95000 },
      { id: "m15", type: "Transfert", description: "Clauses contractuelles renforcées", responsible: "Direction Juridique", deadline: "2026-05-30", status: "Terminé", cost: 15000 },
    ],
    associatedPca: "PCA Fournisseur",
    lastUpdated: "2026-02-15",
  },
  {
    id: "rs12",
    name: "Rupture chaîne d'approvisionnement IT",
    category: "Fournisseur",
    description: "Indisponibilité de matériel ou licences critiques.",
    probability: 3, impact: 3, propagationSpeed: "Lente",
    residualProbability: 2, residualImpact: 2,
    criticalProcesses: ["pr5"],
    resources: ["Stocks tampons"],
    measures: [
      { id: "m16", type: "Réduction", description: "Constitution stock stratégique 6 mois", responsible: "Direction IT", deadline: "2026-07-30", status: "À faire", cost: 220000 },
    ],
    lastUpdated: "2025-12-05",
  },
];

export const initialAppetite: RiskAppetite = {
  acceptable: 6,
  tolerable: 12,
  unacceptable: 20,
  lastReview: "2026-01-15",
};
