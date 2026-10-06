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

export const isApprovedPlan = (p: any) => (p?.statut ?? "").trim() === "Approuvé";

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
export const maturityKpi = (p: Record<keyof typeof MATURITY_WEIGHTS, Kpi>): Kpi => {
  const all = Object.values(p);
  if (all.some((k) => k.status === "loading")) return loadingKpi();
  if (all.some((k) => k.status === "error")) return errorKpi("Un module source n'a pas pu être chargé");
  if (all.every((k) => k.status === "empty")) return { ...loadingKpi(), status: "empty" };
  const v = Math.round(
    (Object.keys(MATURITY_WEIGHTS) as (keyof typeof MATURITY_WEIGHTS)[])
      .reduce((s, k) => s + p[k].percentage * MATURITY_WEIGHTS[k], 0)
  );
  return { value: v, numerator: v, denominator: 100, percentage: v, status: "ready" };
};
