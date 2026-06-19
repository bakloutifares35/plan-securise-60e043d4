export type ImpactAxis = "financial" | "regulatory" | "reputation" | "client" | "operational";

export const AXIS_LABELS: Record<ImpactAxis, string> = {
  financial: "Impact financier",
  regulatory: "Impact réglementaire",
  reputation: "Impact réputationnel",
  client: "Impact client",
  operational: "Impact opérationnel",
};

export type TimePeriod = "P0_4H" | "P4_8H" | "P1D" | "P2D" | "P1W" | "P2W" | "P1M";

export const PERIODS: { id: TimePeriod; label: string; hours: number }[] = [
  { id: "P0_4H", label: "0-4h", hours: 4 },
  { id: "P4_8H", label: "4-8h", hours: 8 },
  { id: "P1D", label: "1 jour", hours: 24 },
  { id: "P2D", label: "2 jours", hours: 48 },
  { id: "P1W", label: "1 semaine", hours: 168 },
  { id: "P2W", label: "2 semaines", hours: 336 },
  { id: "P1M", label: "1 mois", hours: 720 },
];

export type ResourceType = "HR" | "IT" | "Locaux" | "Equipement" | "Fournisseur";
export const RESOURCE_LABELS: Record<ResourceType, string> = {
  HR: "Ressources humaines",
  IT: "Système IT",
  Locaux: "Locaux",
  Equipement: "Équipement",
  Fournisseur: "Fournisseur",
};

export type Resource = {
  id: string;
  type: ResourceType;
  name: string;
  quantity: number;
  substitutability: "Aucune" | "Faible" | "Moyenne" | "Forte" | string;
  rto?: number;
  hrPeople?: any[];
};

export type ImpactMatrix = Record<TimePeriod, Record<ImpactAxis, number>>;

export type Criticality = "Critique" | "Majeur" | "Modéré" | "Mineur";

export type Process = {
  id: string;
  name: string;
  entityId: string;
  department: string;
  owner: string;
  description: string;
  status: "Actif" | "Inactif" | "En revue" | "Nouveau";
  impacts: ImpactMatrix;
  rto: number;
  rpo: number;
  mtpd: number;
  mbco: number;
  resources: Resource[];
  dependsOn: string[];
  lastUpdated: string;
  appsCritiques?: any[];
};

export const emptyImpacts = (): ImpactMatrix =>
  PERIODS.reduce((acc, p) => {
    acc[p.id] = { financial: 0, regulatory: 0, reputation: 0, client: 0, operational: 0 };
    return acc;
  }, {} as ImpactMatrix);

// ✅ FONCTION CORRIGÉE - Supporte les deux formats d'impacts
export const computeMaxScore = (impacts: any): number => {
  // Vérification de base
  if (!impacts) return 0;
  
  // Cas 1: impacts est une ImpactMatrix (avec des périodes)
  if (typeof impacts === 'object') {
    // Vérifie si c'est une ImpactMatrix (contient P0_4H, P4_8H, etc.)
    const firstKey = Object.keys(impacts)[0];
    if (firstKey && (firstKey === "P0_4H" || firstKey === "P4_8H" || firstKey === "P1D")) {
      let max = 0;
      for (const p of PERIODS) {
        const periodData = impacts[p.id];
        if (periodData && typeof periodData === 'object') {
          for (const a of Object.keys(AXIS_LABELS) as ImpactAxis[]) {
            const val = periodData[a];
            if (typeof val === 'number' && val > max) max = val;
          }
        }
      }
      return max;
    }
  }
  
  // Cas 2: impacts est un objet simple (financial, reputational, etc.)
  const scores = [
    impacts.financial || 0,
    impacts.reputational || 0,
    impacts.regulatory || 0,
    impacts.operational || 0,
    impacts.client || 0
  ];
  
  return Math.max(...scores);
};

export const periodMaxScore = (impacts: ImpactMatrix, period: TimePeriod): number => {
  if (!impacts || !impacts[period]) return 0;
  let m = 0;
  for (const a of Object.keys(AXIS_LABELS) as ImpactAxis[]) {
    const val = impacts[period][a];
    if (typeof val === 'number' && val > m) m = val;
  }
  return m;
};

export const scoreToCriticality = (score: number): Criticality => {
  if (score >= 5) return "Critique";
  if (score >= 4) return "Majeur";
  if (score >= 3) return "Modéré";
  return "Mineur";
};

export const criticalityColor = (c: Criticality) => {
  switch (c) {
    case "Critique": return "bg-destructive text-destructive-foreground";
    case "Majeur": return "bg-warning text-warning-foreground";
    case "Modéré": return "bg-accent text-accent-foreground";
    default: return "bg-success text-success-foreground";
  }
};

export const scoreCellColor = (score: number) => {
  if (score >= 5) return "bg-destructive/90 text-destructive-foreground";
  if (score >= 4) return "bg-warning/90 text-warning-foreground";
  if (score >= 3) return "bg-accent/80 text-accent-foreground";
  if (score >= 1) return "bg-success/80 text-success-foreground";
  return "bg-muted text-muted-foreground";
};

const mkImpacts = (vals: Partial<Record<TimePeriod, Partial<Record<ImpactAxis, number>>>>): ImpactMatrix => {
  const im = emptyImpacts();
  for (const p of PERIODS) {
    const v = vals[p.id];
    if (v) Object.assign(im[p.id], v);
  }
  return im;
};

export const initialProcesses: Process[] = [
  {
    id: "pr1",
    name: "Paiements interbancaires",
    entityId: "e2",
    department: "Direction Paiements",
    owner: "Pierre Leroy",
    description: "Traitement des paiements SEPA et virements de gros montants.",
    status: "Actif",
    impacts: mkImpacts({
      P0_4H: { financial: 5, regulatory: 5, reputation: 4, client: 5, operational: 5 },
      P4_8H: { financial: 5, regulatory: 5, reputation: 5, client: 5, operational: 5 },
      P1D: { financial: 5, regulatory: 5, reputation: 5, client: 5, operational: 5 },
      P2D: { financial: 5, regulatory: 5, reputation: 5, client: 5, operational: 5 },
      P1W: { financial: 5, regulatory: 5, reputation: 5, client: 5, operational: 5 },
      P2W: { financial: 5, regulatory: 5, reputation: 5, client: 5, operational: 5 },
      P1M: { financial: 5, regulatory: 5, reputation: 5, client: 5, operational: 5 },
    }),
    rto: 4, rpo: 1, mtpd: 8, mbco: 95,
    resources: [
      { id: "r1", type: "IT", name: "Plateforme paiement core", quantity: 1, substitutability: "Aucune" },
      { id: "r2", type: "HR", name: "Opérateurs paiements", quantity: 6, substitutability: "Faible" },
    ],
    dependsOn: ["pr3", "pr5"],
    lastUpdated: "2026-02-10",
  },
  {
    id: "pr2",
    name: "Service client en ligne",
    entityId: "e2",
    department: "Direction Relation Client",
    owner: "Sophie Durand",
    description: "Espace client web et application mobile.",
    status: "Actif",
    impacts: mkImpacts({
      P0_4H: { financial: 2, regulatory: 1, reputation: 3, client: 4, operational: 3 },
      P4_8H: { financial: 3, regulatory: 2, reputation: 4, client: 5, operational: 3 },
      P1D: { financial: 4, regulatory: 3, reputation: 5, client: 5, operational: 4 },
      P2D: { financial: 4, regulatory: 4, reputation: 5, client: 5, operational: 4 },
      P1W: { financial: 5, regulatory: 4, reputation: 5, client: 5, operational: 5 },
      P2W: { financial: 5, regulatory: 5, reputation: 5, client: 5, operational: 5 },
      P1M: { financial: 5, regulatory: 5, reputation: 5, client: 5, operational: 5 },
    }),
    rto: 8, rpo: 2, mtpd: 24, mbco: 80,
    resources: [
      { id: "r3", type: "IT", name: "Portail client", quantity: 1, substitutability: "Faible" },
    ],
    dependsOn: ["pr5"],
    lastUpdated: "2025-04-15",
  },
  {
    id: "pr3",
    name: "Gestion des sinistres",
    entityId: "e3",
    department: "Direction Indemnisation",
    owner: "Lucas Bernard",
    description: "Déclaration et règlement des sinistres assurance.",
    status: "Actif",
    impacts: mkImpacts({
      P0_4H: { financial: 1, regulatory: 2, reputation: 2, client: 3, operational: 2 },
      P4_8H: { financial: 2, regulatory: 2, reputation: 3, client: 3, operational: 3 },
      P1D: { financial: 3, regulatory: 3, reputation: 3, client: 4, operational: 3 },
      P2D: { financial: 3, regulatory: 4, reputation: 4, client: 4, operational: 4 },
      P1W: { financial: 4, regulatory: 4, reputation: 4, client: 5, operational: 4 },
      P2W: { financial: 5, regulatory: 5, reputation: 5, client: 5, operational: 5 },
      P1M: { financial: 5, regulatory: 5, reputation: 5, client: 5, operational: 5 },
    }),
    rto: 24, rpo: 8, mtpd: 72, mbco: 70,
    resources: [
      { id: "r4", type: "HR", name: "Gestionnaires sinistres", quantity: 12, substitutability: "Moyenne" },
    ],
    dependsOn: [],
    lastUpdated: "2026-01-20",
  },
  {
    id: "pr4",
    name: "Paie et RH",
    entityId: "e1",
    department: "Direction RH",
    owner: "Julie Moreau",
    description: "Calcul et versement des salaires.",
    status: "Actif",
    impacts: mkImpacts({
      P0_4H: { financial: 1, regulatory: 1, reputation: 1, client: 1, operational: 1 },
      P1D: { financial: 1, regulatory: 1, reputation: 1, client: 1, operational: 2 },
      P1W: { financial: 2, regulatory: 2, reputation: 2, client: 1, operational: 2 },
      P2W: { financial: 3, regulatory: 3, reputation: 3, client: 1, operational: 3 },
      P1M: { financial: 5, regulatory: 5, reputation: 4, client: 2, operational: 4 },
    }),
    rto: 168, rpo: 24, mtpd: 720, mbco: 60,
    resources: [
      { id: "r5", type: "IT", name: "SIRH", quantity: 1, substitutability: "Moyenne" },
    ],
    dependsOn: [],
    lastUpdated: "2024-11-05",
  },
  {
    id: "pr5",
    name: "Infrastructure datacenter",
    entityId: "e4",
    department: "Direction IT",
    owner: "Thomas Robert",
    description: "Hébergement des systèmes critiques du groupe.",
    status: "Actif",
    impacts: mkImpacts({
      P0_4H: { financial: 5, regulatory: 4, reputation: 4, client: 5, operational: 5 },
      P4_8H: { financial: 5, regulatory: 5, reputation: 5, client: 5, operational: 5 },
      P1D: { financial: 5, regulatory: 5, reputation: 5, client: 5, operational: 5 },
      P2D: { financial: 5, regulatory: 5, reputation: 5, client: 5, operational: 5 },
      P1W: { financial: 5, regulatory: 5, reputation: 5, client: 5, operational: 5 },
      P2W: { financial: 5, regulatory: 5, reputation: 5, client: 5, operational: 5 },
      P1M: { financial: 5, regulatory: 5, reputation: 5, client: 5, operational: 5 },
    }),
    rto: 2, rpo: 1, mtpd: 4, mbco: 99,
    resources: [
      { id: "r6", type: "Locaux", name: "Datacenter primaire", quantity: 1, substitutability: "Faible" },
      { id: "r7", type: "Locaux", name: "Datacenter secondaire", quantity: 1, substitutability: "Forte" },
    ],
    dependsOn: [],
    lastUpdated: "2026-03-01",
  },
  {
    id: "pr6",
    name: "Cybersécurité opérationnelle",
    entityId: "e5",
    department: "Service Cybersécurité",
    owner: "Antoine Garcia",
    description: "Surveillance et réponse aux incidents cyber (SOC).",
    status: "Actif",
    impacts: mkImpacts({
      P0_4H: { financial: 4, regulatory: 5, reputation: 5, client: 4, operational: 5 },
      P4_8H: { financial: 5, regulatory: 5, reputation: 5, client: 5, operational: 5 },
      P1D: { financial: 5, regulatory: 5, reputation: 5, client: 5, operational: 5 },
      P2D: { financial: 5, regulatory: 5, reputation: 5, client: 5, operational: 5 },
      P1W: { financial: 5, regulatory: 5, reputation: 5, client: 5, operational: 5 },
      P2W: { financial: 5, regulatory: 5, reputation: 5, client: 5, operational: 5 },
      P1M: { financial: 5, regulatory: 5, reputation: 5, client: 5, operational: 5 },
    }),
    rto: 1, rpo: 0, mtpd: 4, mbco: 95,
    resources: [
      { id: "r8", type: "IT", name: "SIEM", quantity: 1, substitutability: "Aucune" },
      { id: "r9", type: "HR", name: "Analystes SOC", quantity: 8, substitutability: "Faible" },
    ],
    dependsOn: ["pr5"],
    lastUpdated: "2026-02-28",
  },
];

export type Campaign = {
  id: string;
  year: number;
  name: string;
  startDate: string;
  endDate: string;
  status: "Terminée" | "En cours" | "Planifiée";
  processesCovered: number;
  totalProcesses: number;
  averageScore: number;
};

export const initialCampaigns: Campaign[] = [
  { id: "ca1", year: 2026, name: "Campagne BIA 2026", startDate: "2026-01-15", endDate: "2026-06-30", status: "En cours", processesCovered: 18, totalProcesses: 24, averageScore: 3.6 },
  { id: "ca2", year: 2025, name: "Campagne BIA 2025", startDate: "2025-01-10", endDate: "2025-05-30", status: "Terminée", processesCovered: 22, totalProcesses: 22, averageScore: 3.4 },
  { id: "ca3", year: 2024, name: "Campagne BIA 2024", startDate: "2024-02-01", endDate: "2024-06-15", status: "Terminée", processesCovered: 19, totalProcesses: 20, averageScore: 3.2 },
  { id: "ca4", year: 2023, name: "Campagne BIA 2023", startDate: "2023-01-20", endDate: "2023-05-30", status: "Terminée", processesCovered: 16, totalProcesses: 18, averageScore: 3.0 },
];