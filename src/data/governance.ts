export type EntityType = "Groupe" | "Holding" | "Filiale" | "Direction" | "Service";

export type Entity = {
  id: string;
  name: string;
  type?: EntityType;
  country: string;
  sector: string;
  parentId: string | null;
  referent: string;
  referentBackup: string;
  status: "Actif" | "Inactif";
  pcaStatus: "Validé" | "En cours" | "À réviser" | "Non démarré";
  maturity?: number; // 0-100
  processIds?: string[];
  children?: Entity[];
};

export const ENTITY_TYPES: EntityType[] = ["Groupe", "Holding", "Filiale", "Direction", "Service"];

export const defaultMaturity = (s: Entity["pcaStatus"]): number => {
  switch (s) {
    case "Validé": return 85;
    case "En cours": return 60;
    case "À réviser": return 45;
    default: return 20;
  }
};

export const initialEntities: Entity[] = [
  {
    id: "e1",
    name: "Groupe Atlas Holding",
    country: "France",
    sector: "Holding",
    parentId: null,
    referent: "Marie Dubois",
    referentBackup: "Jean Martin",
    status: "Actif",
    pcaStatus: "Validé",
  },
  {
    id: "e2",
    name: "Atlas Finance SA",
    country: "France",
    sector: "Banque & Finance",
    parentId: "e1",
    referent: "Pierre Leroy",
    referentBackup: "Sophie Durand",
    status: "Actif",
    pcaStatus: "Validé",
  },
  {
    id: "e3",
    name: "Atlas Insurance",
    country: "Belgique",
    sector: "Assurance",
    parentId: "e1",
    referent: "Lucas Bernard",
    referentBackup: "Emma Petit",
    status: "Actif",
    pcaStatus: "En cours",
  },
  {
    id: "e4",
    name: "Direction IT",
    country: "France",
    sector: "Technologie",
    parentId: "e2",
    referent: "Thomas Robert",
    referentBackup: "Julie Moreau",
    status: "Actif",
    pcaStatus: "Validé",
  },
  {
    id: "e5",
    name: "Service Cybersécurité",
    country: "France",
    sector: "Cybersécurité",
    parentId: "e4",
    referent: "Antoine Garcia",
    referentBackup: "Camille Roux",
    status: "Actif",
    pcaStatus: "Validé",
  },
  {
    id: "e6",
    name: "Atlas Maroc",
    country: "Maroc",
    sector: "Banque & Finance",
    parentId: "e1",
    referent: "Yassine El Amrani",
    referentBackup: "Fatima Benali",
    status: "Actif",
    pcaStatus: "À réviser",
  },
];

export type CalendarEvent = {
  id: string;
  title: string;
  type: "Revue" | "Test" | "Comité" | "Audit";
  startDate: string;
  endDate: string;
  entityId: string;
  responsible: string;
};

export const initialEvents: CalendarEvent[] = [
  { id: "c1", title: "Revue annuelle PCA Groupe", type: "Revue", startDate: "2026-05-15", endDate: "2026-05-15", entityId: "e1", responsible: "Marie Dubois" },
  { id: "c2", title: "Test de bascule DR site", type: "Test", startDate: "2026-05-22", endDate: "2026-05-23", entityId: "e4", responsible: "Thomas Robert" },
  { id: "c3", title: "Comité de pilotage T2", type: "Comité", startDate: "2026-06-10", endDate: "2026-06-10", entityId: "e1", responsible: "Marie Dubois" },
  { id: "c4", title: "Audit interne PCA", type: "Audit", startDate: "2026-06-20", endDate: "2026-06-25", entityId: "e2", responsible: "Pierre Leroy" },
  { id: "c5", title: "Test plan cyber-incident", type: "Test", startDate: "2026-07-05", endDate: "2026-07-05", entityId: "e5", responsible: "Antoine Garcia" },
  { id: "c6", title: "Revue trimestrielle", type: "Revue", startDate: "2026-09-15", endDate: "2026-09-15", entityId: "e3", responsible: "Lucas Bernard" },
];

export type PolicyVersion = {
  id: string;
  version: string;
  approvalDate: string;
  signatory: string;
  scope: string;
  nextRevision: string;
  content: string;
};

export const initialPolicies: PolicyVersion[] = [
  {
    id: "p2",
    version: "2.1",
    approvalDate: "2025-11-12",
    signatory: "Antoine Lefèvre, Directeur Général",
    scope: "Groupe Atlas Holding et filiales",
    nextRevision: "2026-11-12",
    content:
      "<h2>Politique de Continuité d'Activité</h2><p>Le présent document définit la politique du Groupe Atlas en matière de continuité d'activité (PCA). Il s'applique à toutes les entités du groupe.</p><h3>1. Objectifs</h3><p>Garantir la continuité des services critiques en cas de sinistre majeur, protéger les collaborateurs et préserver la confiance des parties prenantes.</p><h3>2. Périmètre</h3><p>Toutes les entités juridiques, processus métiers et systèmes d'information du groupe.</p><h3>3. Gouvernance</h3><p>Un comité de pilotage PCA se réunit trimestriellement.</p>",
  },
  {
    id: "p1",
    version: "2.0",
    approvalDate: "2024-09-30",
    signatory: "Antoine Lefèvre, Directeur Général",
    scope: "Groupe Atlas Holding",
    nextRevision: "2025-09-30",
    content: "<p>Version précédente de la politique PCA Groupe.</p>",
  },
];

export type Committee = {
  id: string;
  date: string;
  title: string;
  attendees: string[];
  agenda: string[];
  minutes: string;
  decisions: { id: string; text: string; owner: string; dueDate: string; status: "Ouvert" | "En cours" | "Clôturé" }[];
};

export const initialCommittees: Committee[] = [
  {
    id: "co1",
    date: "2026-03-15",
    title: "Comité de pilotage PCA T1 2026",
    attendees: ["Antoine Lefèvre", "Marie Dubois", "Pierre Leroy", "Thomas Robert"],
    agenda: ["Revue des incidents T1", "Avancement plan d'action 2026", "Validation budget tests DR"],
    minutes:
      "Le comité a validé le plan d'action 2026 et alloué un budget de 250k€ pour les tests de bascule. Un nouveau test cyber est planifié en juillet.",
    decisions: [
      { id: "d1", text: "Lancer test DR sur site secondaire", owner: "Thomas Robert", dueDate: "2026-05-22", status: "En cours" },
      { id: "d2", text: "Réviser PCA filiale Maroc", owner: "Yassine El Amrani", dueDate: "2026-06-30", status: "Ouvert" },
    ],
  },
  {
    id: "co2",
    date: "2025-12-10",
    title: "Comité de pilotage PCA T4 2025",
    attendees: ["Antoine Lefèvre", "Marie Dubois", "Pierre Leroy"],
    agenda: ["Bilan annuel", "Préparation revue 2026"],
    minutes: "Bilan satisfaisant. Maturité globale en hausse à 76%.",
    decisions: [{ id: "d3", text: "Mise à jour politique PCA Groupe", owner: "Marie Dubois", dueDate: "2025-11-12", status: "Clôturé" }],
  },
];

export type RefItem = { id: string; label: string; level?: number; color?: string };

export const initialRefs = {
  incidentTypes: [
    { id: "i1", label: "Cyberattaque" },
    { id: "i2", label: "Panne SI" },
    { id: "i3", label: "Sinistre matériel" },
    { id: "i4", label: "Pandémie" },
    { id: "i5", label: "Perte fournisseur" },
    { id: "i6", label: "Catastrophe naturelle" },
  ] as RefItem[],
  criticalityLevels: [
    { id: "c1", label: "Vital", level: 4, color: "destructive" },
    { id: "c2", label: "Critique", level: 3, color: "warning" },
    { id: "c3", label: "Important", level: 2, color: "accent" },
    { id: "c4", label: "Standard", level: 1, color: "muted" },
  ] as RefItem[],
  severityLevels: [
    { id: "s1", label: "Catastrophique", level: 5, color: "destructive" },
    { id: "s2", label: "Majeur", level: 4, color: "destructive" },
    { id: "s3", label: "Modéré", level: 3, color: "warning" },
    { id: "s4", label: "Mineur", level: 2, color: "accent" },
    { id: "s5", label: "Négligeable", level: 1, color: "muted" },
  ] as RefItem[],
};
