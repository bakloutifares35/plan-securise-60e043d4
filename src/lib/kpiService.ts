import { computeMaxScore, scoreToCriticality } from "@/data/bia";

// Source unique des calculs KPI Resillia (fonctions pures, testées dans kpiService.test.ts).
// Règles :
// - Processus critique : criticité "Critique" ou "Sévère" (score d'impact max ≥ 4).
// - Stratégie couverte : association reliée à un processus existant.
// - Plan couvert : statut exactement "Approuvé", relié via plan_processus (ou processus_id) à un processus existant.
// - Ressource utilisée : au moins un lien vers un processus existant (doublons ignorés).
// - Exercice récent : statut clôturé (TERMINE / OBJECTIFS_NON_ATTEINTS / Clôturé) et date valide ≤ 12 mois.
// - Maturité : pondération inchangée BIA 20 % / Risques 20 % / Stratégies 20 % / Plans 25 % / Ressources 15 %.

export type KpiStatus = "loading" | "ready" | "empty" | "error";

export type Kpi = {
  value: number;
  numerator: number;
  denominator: number;
  percentage: number;
  status: KpiStatus;
  warning?: string;
};

export type KpiDomain = {
  label: string;
  value: number;
  manquant: number;
  status: KpiStatus;
};

/** Retourne le domaine prêt le plus faible, ou undefined si aucun n'est calculable. */
export const weakestReadyKpiDomain = <T extends KpiDomain>(domains: T[]): T | undefined =>
  domains
    .filter((domain) => domain.status === "ready")
    .reduce<T | undefined>((weakest, domain) =>
      !weakest || domain.value < weakest.value ? domain : weakest, undefined);

export const loadingKpi = (): Kpi => ({ value: 0, numerator: 0, denominator: 0, percentage: 0, status: "loading" });
export const errorKpi = (warning = "Données indisponibles"): Kpi => ({
  value: 0, numerator: 0, denominator: 0, percentage: 0, status: "error", warning,
});

/** Ratio sûr : dénominateur 0 → empty ; 99,5 % avec manquants arrondi à 99 (règle existante conservée). */
export const ratioKpi = (numerator: number, denominator: number, warning?: string): Kpi => {
  if (!denominator || denominator <= 0) {
    return { value: 0, numerator: 0, denominator: 0, percentage: 0, status: "empty", warning };
  }
  const num = Math.max(0, Math.min(numerator, denominator));
  let pct = (num / denominator) * 100;
  if (pct >= 99.5 && num < denominator) pct = 99;
  pct = Math.round(pct);
  return { value: pct, numerator: num, denominator, percentage: pct, status: "ready", warning };
};

/** Couverture BIA : processus complets / processus évalués. */
export const biaCoverageKpi = (completed: number, expected: number): Kpi =>
  ratioKpi(completed, expected, "Aucun élément BIA enregistré");

export type BiaResourceCounts = Record<string, { hr: number; equip: number; app: number; supplier: number; total?: number }>;

/** Critères communs de complétude BIA utilisés par le Dashboard et les vues BIA. */
export const biaProcessCompletion = (process: any, resourcesByProcess: BiaResourceCounts = {}) => {
  const missing: string[] = [];
  const score = computeMaxScore(process?.impacts);
  const criticality = scoreToCriticality(score);
  if (!process?.impacts) missing.push("Impacts non définis");
  else {
    for (const period of ["P0_4H", "P4_8H", "P1D", "P2D", "P1W"]) {
      const values = process.impacts[period];
      if (!values || typeof values !== "object" || !["financial", "regulatory", "operational", "reputation"].some((axis) => Number(values[axis]) > 0)) {
        missing.push("Impacts incomplets");
        break;
      }
    }
  }
  if (!process?.rto || process.rto <= 0) missing.push("RTO non défini");
  if (!process?.rpo || process.rpo <= 0) missing.push("RPO non défini");
  if (process?.rto && process?.mtpd && process.rto > process.mtpd) missing.push(`RTO (${process.rto}h) > MTPD (${process.mtpd}h)`);
  if (!criticality) missing.push("Criticité non calculée");
  const resources = resourcesByProcess[process?.id] || { hr: 0, equip: 0, app: 0, supplier: 0 };
  if (criticality === "Critique" || criticality === "Majeur") {
    if (!resources.hr) missing.push("Aucune ressource humaine liée");
    if (!resources.app) missing.push("Aucune application IT liée");
    if (!resources.equip) missing.push("Aucun équipement lié");
    if (!resources.supplier) missing.push("Aucun prestataire lié");
  }
  return { complet: missing.length === 0, champsManquants: missing };
};

export const biaProcessesCoverageKpi = (processes: any[], resourcesByProcess: BiaResourceCounts = {}) => {
  const completed = (processes || []).filter((process) => biaProcessCompletion(process, resourcesByProcess).complet).length;
  return biaCoverageKpi(completed, (processes || []).length);
};

/** Risques couverts par au moins un traitement/mesure renseigné. */
export const riskTreatmentCoverageKpi = (risks: any[], measures: any[] = []): Kpi => {
  const applicable = risks || [];
  const validIds = new Set(applicable.map((risk) => String(risk?.id)).filter(Boolean));
  const measuredIds = new Set((measures || []).map((measure) => String(measure?.risque_id ?? "")).filter((id) => validIds.has(id)));
  const covered = applicable.filter((risk) => {
    if (measuredIds.has(String(risk?.id))) return true;
    const hasMeasures = Array.isArray(risk?.mesures_existantes)
      ? risk.mesures_existantes.length > 0
      : !!risk?.mesures_existantes;
    return hasMeasures || !!risk?.traitement || !!risk?.strategie_active || !!risk?.plan_traitement;
  }).length;
  return ratioKpi(covered, applicable.length, "Aucun risque enregistré");
};

export const exerciseStatusCounts = (tests: any[]) => {
  const list = tests || [];
  const is = (test: any, ...statuses: string[]) => statuses.includes(String(test?.statut || "").trim().toUpperCase());
  return {
    planned: list.filter((test) => is(test, "PLANIFIE", "PLANIFIÉ", "PLANNED")).length,
    inProgress: list.filter((test) => is(test, "EN_COURS", "EN COURS", "IN_PROGRESS")).length,
    completed: list.filter((test) => is(test, "TERMINE", "TERMINÉ", "OBJECTIFS_NON_ATTEINTS", "COMPLETED")).length,
    cancelled: list.filter((test) => is(test, "ANNULE", "ANNULÉ", "ANNULEE", "ANNULÉE", "CANCELLED")).length,
  };
};

/** Actions War Room clôturées / actions enregistrées (statut métier actuel : Fait). */
export const warRoomActionsKpi = (actions: any[]): Kpi => {
  const list = actions || [];
  const closed = list.filter((action) => String(action?.statut || "").trim().toLocaleLowerCase("fr-FR") === "fait").length;
  return ratioKpi(closed, list.length, "Aucune action enregistrée");
};

export const formatKpi = (k: Kpi): string => {
  if (k.status === "loading") return "…";
  if (k.status === "error") return "—";
  if (k.status === "empty") return "N/A";
  return `${k.numerator} / ${k.denominator} — ${k.percentage} %`;
};

export const CRITICAL_LEVELS = ["Critique", "Sévère"] as const;
export const isCriticalLevel = (c?: string | null) => !!c && (CRITICAL_LEVELS as readonly string[]).includes(c);

export const isValidDate = (v: any): v is string | Date => {
  if (!v) return false;
  const d = new Date(v);
  return !isNaN(d.getTime());
};

const uniq = <T,>(arr: T[]) => Array.from(new Set(arr));

/** Ids des processus (parmi validIds) ayant au moins une association de stratégie. */
export const processesWithStrategy = (associations: any[], validIds: Set<string>) =>
  new Set(uniq((associations || []).map((a) => a?.processus_id).filter((id) => id && validIds.has(id))));

export const isApprovedPlan = (p: any) => ["Approuvé", "Actif"].includes((p?.statut ?? "").trim());

/** Ids des processus couverts par au moins un plan approuvé. */
export const processesWithApprovedPlan = (plans: any[], planProcessus: any[], validIds: Set<string>) => {
  const approved = new Set((plans || []).filter(isApprovedPlan).map((p) => p.id));
  const ids: string[] = [];
  for (const l of planProcessus || []) {
    if (approved.has(l?.plan_id) && validIds.has(l?.processus_id)) ids.push(l.processus_id);
  }
  for (const p of plans || []) {
    if (isApprovedPlan(p) && p.processus_id && validIds.has(p.processus_id)) ids.push(p.processus_id);
  }
  return new Set(uniq(ids));
};

/** Ressources utilisées : liens valides (processus existant ET ressource existante), sans doublon. */
export const usedResourcesKpi = (
  resources: { ids: string[]; links: any[]; key: string }[],
  validProcessIds: Set<string>
): Kpi => {
  let total = 0;
  let used = 0;
  for (const r of resources) {
    const ids = new Set(r.ids.filter(Boolean));
    total += ids.size;
    const usedIds = new Set(
      (r.links || [])
        .filter((l) => validProcessIds.has(l?.processus_id) && ids.has(l?.[r.key]))
        .map((l) => l[r.key])
    );
    used += usedIds.size;
  }
  return ratioKpi(used, total);
};

const CLOSED_TEST = ["TERMINE", "OBJECTIFS_NON_ATTEINTS", "Clôturé", "Terminé"];

export const isRecentClosedExercise = (e: any, now = new Date()) => {
  if (!CLOSED_TEST.includes(e?.statut)) return false;
  const d = e.date_fin_reelle || e.date_debut_reelle || e.date_planifiee || e.date_exercice;
  if (!isValidDate(d)) return false;
  const t = new Date(d).getTime();
  const limit = new Date(now);
  limit.setFullYear(limit.getFullYear() - 1);
  return t <= now.getTime() && t >= limit.getTime();
};

/** Couverture exercices : processus critiques testés (exercice clôturé < 12 mois). */
export const exercisesKpi = (tests: any[], criticalIds: Set<string>, now = new Date()): Kpi => {
  const covered = new Set<string>();
  for (const t of tests || []) {
    if (!isRecentClosedExercise(t, now)) continue;
    if (t.processus_id && criticalIds.has(t.processus_id)) covered.add(t.processus_id);
    for (const pid of t.processus_ids || []) if (criticalIds.has(pid)) covered.add(pid);
  }
  return ratioKpi(covered.size, criticalIds.size);
};

export const MATURITY_WEIGHTS = { bia: 0.2, risques: 0.2, strategies: 0.2, plans: 0.25, ressources: 0.15 };

/** Maturité globale : uniquement si tous les piliers sont prêts ou vides (vide = 0, formule historique). */
export const calculatePcaMaturity = (p: Record<keyof typeof MATURITY_WEIGHTS, Kpi>): Kpi => {
  const all = Object.values(p);
  if (all.some((k) => k.status === "loading")) return loadingKpi();
  if (all.some((k) => k.status === "error")) return errorKpi("Un module source n'a pas pu être chargé");
  if (all.every((k) => k.status === "empty")) return { ...loadingKpi(), status: "empty" };
  const available = (Object.keys(MATURITY_WEIGHTS) as (keyof typeof MATURITY_WEIGHTS)[])
    .filter((key) => p[key].status === "ready");
  const availableWeight = available.reduce((sum, key) => sum + MATURITY_WEIGHTS[key], 0);
  const v = Math.round(available.reduce((sum, key) => sum + p[key].percentage * MATURITY_WEIGHTS[key], 0) / availableWeight);
  const missing = (Object.keys(MATURITY_WEIGHTS) as (keyof typeof MATURITY_WEIGHTS)[])
    .filter((key) => p[key].status === "empty");
  return {
    value: v, numerator: v, denominator: 100, percentage: v, status: "ready",
    warning: missing.length ? `Score partiel : ${missing.join(", ")} sans données; pondérations historiques renormalisées sur les domaines calculables.` : undefined,
  };
};

/** Alias de compatibilité pour les consommateurs existants. */
export const maturityKpi = calculatePcaMaturity;

/** Couverture stratégies : processus existants reliés à au moins une stratégie. */
export const strategyCoverageKpi = (associations: any[], processIds: string[]): Kpi => {
  const valid = new Set(processIds.filter(Boolean));
  return ratioKpi(processesWithStrategy(associations, valid).size, valid.size);
};

/** Couverture plans : processus existants couverts par un plan "Approuvé". */
export const planCoverageKpi = (plans: any[], planProcessus: any[], processIds: string[]): Kpi => {
  const valid = new Set(processIds.filter(Boolean));
  return ratioKpi(processesWithApprovedPlan(plans, planProcessus, valid).size, valid.size);
};

/** Couverture risques : risques ayant au moins une mesure de traitement valide. */
export const riskCoverageKpi = (riskIds: string[], measures: any[]): Kpi => {
  const valid = new Set(riskIds.filter(Boolean).map(String));
  const treated = new Set(
    (measures || []).map((m) => (m?.risque_id != null ? String(m.risque_id) : "")).filter((id) => valid.has(id))
  );
  return ratioKpi(treated.size, valid.size);
};

/** Ressources utilisées à partir d'un compteur d'usage (null = inconnu, non compté comme utilisé). */
export const usedCountKpi = (items: { used_by_count?: number | null }[]): Kpi =>
  ratioKpi((items || []).filter((r) => (r?.used_by_count ?? 0) > 0).length, (items || []).length);
