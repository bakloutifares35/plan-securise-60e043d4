// src/components/warroom/warroomHelpers.ts
// Utilitaires partagés pour le module War Room

// ============================================================
// PALETTE RESILLIA — SÉVÉRITÉ STRICTE
// ⚠️ EXCEPTION URGENCE : #E24B4A est la seule couleur hors charte,
// utilisée pour Critique/P1 et le bouton "Déclarer un incident".
// ============================================================
export const COLORS = {
  navy: "#172030",
  cream: "#F8F6F2",
  forest: "#2A5141",
  border: "#E8E4DC",
  borderSoft: "#E5E2DD",
  white: "#FFFFFF",
  // Exception urgence
  danger: "#E24B4A",
} as const;

export type Severite = "P1" | "P2" | "P3" | "P4";

// ============================================================
// PALETTE PASTEL PAR SÉVÉRITÉ (stricte, demande client)
// ============================================================
export const SEV_PASTEL: Record<
  Severite,
  { bg: string; border: string; text: string; dot: string; label: string }
> = {
  P1: { bg: "#FFEBEE", border: "#EF9A9A", text: "#C62828", dot: "#C62828", label: "Critique" },
  P2: { bg: "#FBE9E7", border: "#FFAB91", text: "#D84315", dot: "#D84315", label: "Sévère" },
  P3: { bg: "#FFF3E0", border: "#FFCC80", text: "#E65100", dot: "#E65100", label: "Majeur" },
  P4: { bg: "#FFF8E1", border: "#FFE082", text: "#F57F17", dot: "#F57F17", label: "Modéré" },
};

export const SEV_MINEUR = {
  bg: "#E8F5E9",
  border: "#A5D6A7",
  text: "#2E7D32",
  dot: "#2E7D32",
  label: "Mineur",
};

// ============================================================
// TYPES DE MAIN COURANTE
// ============================================================
export const MAIN_COURANTE_TYPES = ["Décision", "Action", "Information", "Communication"] as const;
export type EntryType = (typeof MAIN_COURANTE_TYPES)[number];

export const ENTRY_TYPE_STYLE: Record<EntryType, { bg: string; text: string }> = {
  Décision: { bg: "#FFF3E0", text: "#E65100" },
  Action: { bg: "#FBE9E7", text: "#D84315" },
  Information: { bg: "#F8F6F2", text: "#172030" },
  Communication: { bg: "#E8F5E9", text: "#2E7D32" },
};

// ============================================================
// TYPES DE COMMUNICATION DE CRISE
// ============================================================
export const COMM_TYPES = ["Interne", "Client", "Presse"] as const;
export type CommType = (typeof COMM_TYPES)[number];

export const COMM_TYPE_STYLE: Record<CommType, { bg: string; text: string }> = {
  Interne: { bg: "#F8F6F2", text: "#172030" },
  Client: { bg: "#FFF3E0", text: "#E65100" },
  Presse: { bg: "#FBE9E7", text: "#D84315" },
};

// ============================================================
// RÔLES DE CELLULE DE CRISE
// ============================================================
export const CELL_ROLES = ["Coordinateur", "Métier", "Communication", "Support"] as const;
export type CellRole = (typeof CELL_ROLES)[number];

export const CELL_ROLE_STYLE: Record<CellRole, { bg: string; text: string }> = {
  Coordinateur: { bg: "#FFEBEE", text: "#C62828" },
  Métier: { bg: "#FFF3E0", text: "#E65100" },
  Communication: { bg: "#E8F5E9", text: "#2E7D32" },
  Support: { bg: "#F8F6F2", text: "#172030" },
};

// ============================================================
// AVATARS — initiales + couleurs stables par nom
// ============================================================
const AVATAR_PALETTE = [
  { bg: "#FBE9E7", text: "#C62828" },
  { bg: "#FFF3E0", text: "#E65100" },
  { bg: "#FFF8E1", text: "#F57F17" },
  { bg: "#E8F5E9", text: "#2E7D32" },
  { bg: "#EDF2F7", text: "#38536F" },
  { bg: "#F5F0FA", text: "#6A4A8A" },
  { bg: "#FCE4EC", text: "#AD1457" },
  { bg: "#E0F2F1", text: "#00695C" },
];

/** Retourne les initiales d'un nom (2 lettres max) */
export const getInitials = (name?: string | null): string => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/** Retourne une couleur stable pour un avatar (basée sur le hash du nom) */
export const getAvatarColor = (name?: string | null) => {
  if (!name) return AVATAR_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[index];
};

// ============================================================
// FORMATAGE
// ============================================================
export const formatDateTime = (iso?: string | null) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatTime = (iso?: string | null) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
};

export const elapsedSince = (iso?: string | null): string => {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return "à venir";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}min`;
  const days = Math.floor(hours / 24);
  return `${days}j ${hours % 24}h`;
};

export const severityRank = (s: Severite): number =>
  s === "P1" ? 0 : s === "P2" ? 1 : s === "P3" ? 2 : 3;