import { Home, Building, Users, AlertTriangle, Database, ArrowRight, type LucideIcon } from "lucide-react";

export type StrategyStatus = "Proposée" | "Validée" | "En test" | "Opérationnelle" | "Rejetée";

export type Strategy = {
  id: string;
  name: string;
  description: string;
  iconName: "Home" | "Building" | "Users" | "AlertTriangle" | "Database" | "ArrowRight";
};

export const STRATEGY_ICONS: Record<Strategy["iconName"], LucideIcon> = {
  Home,
  Building,
  Users,
  AlertTriangle,
  Database,
  ArrowRight,
};

export const initialStrategies: Strategy[] = [
  {
    id: "str-teletravail",
    name: "Télétravail généralisé",
    description: "Activation massive du télétravail pour maintenir les activités à distance.",
    iconName: "Home",
  },
  {
    id: "str-repli",
    name: "Repli sur site alternatif",
    description: "Basculement des équipes sur un site secondaire pré-équipé.",
    iconName: "Building",
  },
  {
    id: "str-soustraitance",
    name: "Sous-traitance temporaire",
    description: "Externalisation temporaire d'une activité auprès d'un prestataire.",
    iconName: "Users",
  },
  {
    id: "str-degrade",
    name: "Mode dégradé",
    description: "Fonctionnement en capacité réduite avec procédures manuelles.",
    iconName: "AlertTriangle",
  },
  {
    id: "str-backup",
    name: "Reprise sur backup IT",
    description: "Restauration des systèmes critiques depuis les sauvegardes (DRP).",
    iconName: "Database",
  },
  {
    id: "str-transfert",
    name: "Transfert d'activité",
    description: "Transfert de l'activité vers une autre entité du groupe.",
    iconName: "ArrowRight",
  },
];

export type StrategyAssociation = {
  id: string;
  processId: string;
  scenarioId: string;
  strategyId: string;
  justification: string;
  prerequis: string;
  coutEstime: number;
  delaiMiseEnOeuvre: number; // jours
  faisabilite: number; // 1-5
  robustesse: number; // 1-5
  rtoAtteignable: number; // heures
  status: StrategyStatus;
};

export const initialAssociations: StrategyAssociation[] = [];
