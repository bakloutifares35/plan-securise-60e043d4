// src/components/warroom/types.ts — Module M6 « War Room » (gestion de crise)
//
// ⚠️ CHARTE — EXCEPTION ASSUMÉE (ne pas "corriger") :
// Ce module est le seul de l'application où le rouge d'urgence #E24B4A est
// utilisé largement (bouton de déclaration, bordures de sévérité). L'urgence
// visuelle prime ici sur la sobriété Resillia habituelle (Navy / Crème / Vert).
export const RESILLIA = {
  navy: "#172030",
  cream: "#F8F6F2",
  forest: "#2A5141",
  border: "#E8E4DC",
  urgence: "#E24B4A", // exception documentée
};

export const MISSING_TABLE = "42P01";

export type Severite = "P1" | "P2" | "P3" | "P4";
export type IncidentStatut = "Déclaré" | "En cours" | "Sous contrôle" | "Clôturé";
export type EntryType = "Décision" | "Action" | "Information" | "Communication";
export type ActionStatut = "À faire" | "En cours" | "Fait";
export type CommStatut = "Brouillon" | "Validé" | "Envoyé";

export const SEVERITES: Severite[] = ["P1", "P2", "P3", "P4"];
export const SEVERITE_COLORS: Record<Severite, string> = {
  P1: "#E24B4A",
  P2: "#EF9F27",
  P3: "#F5D061",
  P4: "#639922",
};
export const SEVERITE_LABELS: Record<Severite, string> = {
  P1: "P1 — Critique",
  P2: "P2 — Majeur",
  P3: "P3 — Modéré",
  P4: "P4 — Mineur",
};

export const INCIDENT_TYPES = [
  "Cyberattaque",
  "Panne informatique",
  "Sinistre bâtiment",
  "Indisponibilité RH",
  "Défaillance fournisseur",
  "Crise sanitaire",
  "Autre",
];

export const ENTRY_TYPES: EntryType[] = ["Décision", "Action", "Information", "Communication"];
export const ENTRY_TYPE_COLORS: Record<EntryType, string> = {
  Décision: "#2A5141",
  Action: "#EF9F27",
  Information: "#3B4454",
  Communication: "#4A6FA5",
};

export const INCIDENT_STATUTS: IncidentStatut[] = ["Déclaré", "En cours", "Sous contrôle", "Clôturé"];

export type Incident = {
  id: string;
  type: string | null;
  titre: string;
  date_heure_debut: string;
  date_heure_fin: string | null;
  niveau_severite: Severite;
  statut: IncidentStatut;
  declarant: string | null;
  description: string | null;
  created_at?: string;
  updated_at?: string;
};

export type MainCouranteEntry = {
  id: string;
  incident_id: string;
  horodatage: string;
  auteur: string | null;
  type: EntryType;
  contenu: string;
};

export type IncidentAction = {
  id: string;
  incident_id: string;
  description: string;
  responsable: string | null;
  echeance: string | null;
  statut: ActionStatut;
  plan_associe_id: string | null;
};

export type IncidentPlan = {
  id: string;
  incident_id: string;
  plan_id: string | null;
  libelle: string | null;
};

export type IncidentCommunication = {
  id: string;
  incident_id: string;
  objet: string;
  message: string | null;
  statut: CommStatut;
  auteur: string | null;
  created_at: string;
};

export type Retex = {
  id?: string;
  incident_id: string;
  resume: string;
  causes_racines: string;
  points_positifs: string;
  points_amelioration: string;
  actions_correctives: string;
  valide_par?: string | null;
  date_validation?: string | null;
};

export type ProcessLite = { id: string; name: string; direction?: string | null };
export type PlanLite = { id: string; titre: string; type?: string | null };

/** Temps écoulé depuis la déclaration, calculé côté client. */
export const elapsedSince = (iso: string): string => {
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return "—";
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ${min % 60} min`;
  const d = Math.floor(h / 24);
  return `${d} j ${h % 24} h`;
};

export const formatDateTime = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
