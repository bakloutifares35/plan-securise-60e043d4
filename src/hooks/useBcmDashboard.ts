// Hook d'agrégation du tableau de bord BCM global (données réelles Supabase uniquement).
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/db";
import { computeMaxScore, scoreToCriticality } from "@/data/bia";

export type Org = {
  id: string;
  name: string;
  type: string | null;
  parent_id: string | null;
  maturity?: number | null;
};

export type Processus = {
  id: string;
  name: string;
  entity_id: string | null;
  direction: string | null;
  owner?: string | null;
  criticality_level: string | null;
  rto_hours: number | null;
  rpo_hours: number | null;
  mtpd_hours?: number | null;
  is_critical: boolean | null;
  last_bia_date: string | null;
  impacts: any;
};

export type Risque = {
  id: string;
  title?: string | null;
  titre?: string | null;
  reference?: string | null;
  category?: string | null;
  processus_id?: string | null;
  probabilite?: number | null;
  impact?: number | null;
  impact_global?: number | null;
  score_brut?: number | null;
  score_residuel?: number | null;
  niveau?: string | null;
  decision?: string | null;
  date_revue?: string | null;
  owner?: string | null;
};

const MONTHS_12 = 365 * 24 * 3600 * 1000;

const monthsSince = (d?: string | null) => {
  if (!d) return null;
  const t = new Date(d).getTime();
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / (30.44 * 24 * 3600 * 1000);
};

const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : 0);

export type ResourceRow = { id: string; name: string; department_id: string | null };

export const useBcmDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [refreshedAt, setRefreshedAt] = useState<Date>(new Date());
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [processus, setProcessus] = useState<Processus[]>([]);
  const [risques, setRisques] = useState<Risque[]>([]);
  const [mesures, setMesures] = useState<any[]>([]);
  const [rh, setRh] = useState<ResourceRow[]>([]);
  const [equip, setEquip] = useState<ResourceRow[]>([]);
  const [apps, setApps] = useState<ResourceRow[]>([]);
  const [fourn, setFourn] = useState<ResourceRow[]>([]);
  const [strategies, setStrategies] = useState<any[]>([]);
  const [assocs, setAssocs] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [planProc, setPlanProc] = useState<any[]>([]);
  const [planRisk, setPlanRisk] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const q = (t: string, sel = "*") => supabase.from(t).select(sel);
    const [o, p, r, m, h, e, a, f, sc, sa, pl, pp, pr] = await Promise.all([
      q("organisations", "id, name, type, parent_id, maturity"),
      q("processus_metier"),
      q("risques"),
      q("plans_traitement"),
      q("ressources_humaines", "id, name, department_id"),
      q("ressources_equipements", "id, name, department_id"),
      q("applications_it", "id, name, department_id"),
      q("fournisseurs", "id, name, department_id"),
      q("strategies_catalogue"),
      q("strategies_association"),
      q("plans"),
      q("plan_processus"),
      q("plan_risques"),
    ]);
    setOrgs((o.data as any) ?? []);
    setProcessus((p.data as any) ?? []);
    setRisques((r.data as any) ?? []);
    setMesures((m.data as any) ?? []);
    setRh((h.data as any) ?? []);
    setEquip((e.data as any) ?? []);
    setApps((a.data as any) ?? []);
    setFourn((f.data as any) ?? []);
    setStrategies((sc.data as any) ?? []);
    setAssocs((sa.data as any) ?? []);
    setPlans((pl.data as any) ?? []);
    setPlanProc((pp.data as any) ?? []);
    setPlanRisk((pr.data as any) ?? []);
    setRefreshedAt(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const orgById = useMemo(() => new Map(orgs.map((o) => [o.id, o])), [orgs]);

  /** Remonte l'arborescence jusqu'à trouver une DIRECTION (sinon l'entité racine connue). */
  const directionOf = useCallback(
    (entityId?: string | null): Org | null => {
      let cur = entityId ? orgById.get(entityId) ?? null : null;
      let guard = 0;
      let fallback = cur;
      while (cur && guard++ < 12) {
        if ((cur.type ?? "").toUpperCase() === "DIRECTION") return cur;
        fallback = cur;
        cur = cur.parent_id ? orgById.get(cur.parent_id) ?? null : null;
      }
      return fallback;
    },
    [orgById],
  );

  // --- Processus enrichis -------------------------------------------------
  const processEnriched = useMemo(() => {
    return processus.map((p) => {
      const score = computeMaxScore(p.impacts);
      const crit = p.criticality_level
        ? p.criticality_level.charAt(0) + p.criticality_level.slice(1).toLowerCase()
        : scoreToCriticality(score);
      const dir = directionOf(p.entity_id);
      const isCritical =
        p.is_critical === true || score >= 4 || ["CRITIQUE", "MAJEUR"].includes((p.criticality_level ?? "").toUpperCase());
      const hasStrategy = assocs.some((a) => a.processus_id === p.id);
      const hasPlan = planProc.some((lp) => lp.processus_id === p.id);
      const nbRisques = risques.filter((r) => r.processus_id === p.id).length;
      const biaAge = monthsSince(p.last_bia_date);
      return {
        ...p,
        score,
        criticite: crit,
        direction_id: dir?.id ?? null,
        direction_name: dir?.name ?? p.direction ?? "Non rattaché",
        isCritical,
        hasStrategy,
        hasPlan,
        nbRisques,
        biaAge,
        biaOutdated: biaAge === null || biaAge > 12,
      };
    });
  }, [processus, assocs, planProc, risques, directionOf]);

  const criticalProcesses = useMemo(
    () => processEnriched.filter((p) => p.isCritical).sort((a, b) => b.score - a.score),
    [processEnriched],
  );

  // --- Risques ------------------------------------------------------------
  const riskEnriched = useMemo(() => {
    return risques.map((r) => {
      const prob = Number(r.probabilite ?? 0);
      const imp = Number(r.impact_global ?? r.impact ?? 0);
      const residual = Number(r.score_residuel ?? r.score_brut ?? prob * imp ?? 0);
      const treated = mesures.some((m) => m.risque_id === r.id) || (r.decision ?? "") === "Accepter";
      const proc = r.processus_id ? processEnriched.find((p) => p.id === r.processus_id) : null;
      return {
        ...r,
        label: r.title ?? r.titre ?? "Risque",
        prob,
        imp,
        residual,
        treated,
        isCritical: residual >= 15 || (r.niveau ?? "") === "Critique",
        direction_id: proc?.direction_id ?? null,
        direction_name: proc?.direction_name ?? null,
      };
    });
  }, [risques, mesures, processEnriched]);

  const criticalRisks = useMemo(
    () => riskEnriched.filter((r) => r.isCritical).sort((a, b) => b.residual - a.residual),
    [riskEnriched],
  );
  const untreatedRisks = useMemo(() => riskEnriched.filter((r) => !r.treated), [riskEnriched]);

  // Matrice 5x5 : ligne = probabilité (5 en haut), colonne = impact
  const matrix = useMemo(() => {
    const cells: { p: number; i: number; risks: typeof riskEnriched }[] = [];
    for (let p = 5; p >= 1; p--) {
      for (let i = 1; i <= 5; i++) {
        cells.push({ p, i, risks: riskEnriched.filter((r) => r.prob === p && r.imp === i) });
      }
    }
    return cells;
  }, [riskEnriched]);

  // --- Ressources ---------------------------------------------------------
  const resources = useMemo(() => {
    const byDept = (rows: ResourceRow[]) => {
      const m = new Map<string, number>();
      rows.forEach((row) => {
        const dir = directionOf(row.department_id);
        if (!dir) return;
        m.set(dir.id, (m.get(dir.id) ?? 0) + 1);
      });
      return m;
    };
    return {
      rh: rh.length,
      equip: equip.length,
      apps: apps.length,
      fourn: fourn.length,
      total: rh.length + equip.length + apps.length + fourn.length,
      byDirection: [byDept(rh), byDept(equip), byDept(apps), byDept(fourn)],
    };
  }, [rh, equip, apps, fourn, directionOf]);

  const resourcesByDirection = useMemo(() => {
    const m = new Map<string, number>();
    resources.byDirection.forEach((sub) => sub.forEach((v, k) => m.set(k, (m.get(k) ?? 0) + v)));
    return m;
  }, [resources]);

  // --- Directions ---------------------------------------------------------
  const directions = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; processus: number; critiques: number; risques: number; ressources: number }
    >();
    processEnriched.forEach((p) => {
      const id = p.direction_id ?? "none";
      const cur = map.get(id) ?? {
        id,
        name: p.direction_name || "Non rattaché",
        processus: 0,
        critiques: 0,
        risques: 0,
        ressources: 0,
      };
      cur.processus += 1;
      if (p.isCritical) cur.critiques += 1;
      cur.risques += p.nbRisques;
      map.set(id, cur);
    });
    resourcesByDirection.forEach((count, dirId) => {
      const cur = map.get(dirId);
      if (cur) cur.ressources += count;
      else {
        const o = orgById.get(dirId);
        if (o) map.set(dirId, { id: dirId, name: o.name, processus: 0, critiques: 0, risques: 0, ressources: count });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.processus - a.processus || b.ressources - a.ressources);
  }, [processEnriched, resourcesByDirection, orgById]);

  // --- Plans --------------------------------------------------------------
  const planStats = useMemo(() => {
    const byStatut = new Map<string, number>();
    plans.forEach((p) => {
      const s = p.statut ?? "Brouillon";
      byStatut.set(s, (byStatut.get(s) ?? 0) + 1);
    });
    return {
      total: plans.length,
      byStatut,
      approuves: byStatut.get("Approuvé") ?? 0,
      actifs: plans.filter((p) => p.est_actif).length,
      aReviser: byStatut.get("À réviser") ?? 0,
    };
  }, [plans]);

  // --- Indice de maturité Resillia ---------------------------------------
  const maturity = useMemo(() => {
    const nbProc = processEnriched.length;
    const nbCrit = criticalProcesses.length;
    const biaOk = processEnriched.filter((p) => !p.biaOutdated && p.score > 0).length;
    const riskCovered = riskEnriched.filter((r) => r.treated).length;
    const stratCovered = (nbCrit > 0 ? criticalProcesses : processEnriched).filter((p) => p.hasStrategy).length;
    const planCovered = (nbCrit > 0 ? criticalProcesses : processEnriched).filter((p) => p.hasPlan).length;
    const dirWithRes = directions.filter((d) => d.ressources > 0).length;

    const pillars = [
      { key: "BIA", value: pct(biaOk, nbProc), detail: `${biaOk}/${nbProc} processus à jour` },
      {
        key: "Risques",
        value: pct(riskCovered, riskEnriched.length),
        detail: `${riskCovered}/${riskEnriched.length} risques traités`,
      },
      {
        key: "Stratégies",
        value: pct(stratCovered, nbCrit > 0 ? nbCrit : nbProc),
        detail: `${stratCovered}/${nbCrit > 0 ? nbCrit : nbProc} processus couverts`,
      },
      {
        key: "Plans",
        value: pct(planCovered, nbCrit > 0 ? nbCrit : nbProc),
        detail: `${planCovered}/${nbCrit > 0 ? nbCrit : nbProc} processus planifiés`,
      },
      {
        key: "Ressources",
        value: pct(dirWithRes, directions.length),
        detail: `${dirWithRes}/${directions.length} directions renseignées`,
      },
    ];
    const global = pillars.length ? Math.round(pillars.reduce((s, p) => s + p.value, 0) / pillars.length) : 0;
    return { global, pillars };
  }, [processEnriched, criticalProcesses, riskEnriched, directions]);

  // --- Chaîne de résilience ----------------------------------------------
  const chain = useMemo(() => {
    const base = criticalProcesses.length > 0 ? criticalProcesses : processEnriched;
    return {
      processus: processEnriched.length,
      critiques: criticalProcesses.length,
      risques: riskEnriched.length,
      risquesTraites: riskEnriched.filter((r) => r.treated).length,
      avecStrategie: base.filter((p) => p.hasStrategy).length,
      avecPlan: base.filter((p) => p.hasPlan).length,
      plansApprouves: planStats.approuves,
      base: base.length,
    };
  }, [processEnriched, criticalProcesses, riskEnriched, planStats]);

  // --- Priorités de résilience -------------------------------------------
  const priorities = useMemo(() => {
    const out: { level: "critique" | "eleve" | "moyen"; title: string; detail: string; target: string }[] = [];
    criticalRisks
      .filter((r) => !r.treated)
      .slice(0, 4)
      .forEach((r) =>
        out.push({
          level: "critique",
          title: `Risque critique non traité : ${r.label}`,
          detail: `Score résiduel ${r.residual}${r.direction_name ? ` · ${r.direction_name}` : ""}`,
          target: "risk",
        }),
      );
    criticalProcesses
      .filter((p) => !p.hasPlan)
      .slice(0, 4)
      .forEach((p) =>
        out.push({
          level: "eleve",
          title: `Processus critique sans plan : ${p.name}`,
          detail: `${p.direction_name} · RTO ${p.rto_hours ?? "—"}h`,
          target: "plan",
        }),
      );
    criticalProcesses
      .filter((p) => !p.hasStrategy)
      .slice(0, 3)
      .forEach((p) =>
        out.push({
          level: "eleve",
          title: `Processus critique sans stratégie : ${p.name}`,
          detail: p.direction_name,
          target: "strategies",
        }),
      );
    processEnriched
      .filter((p) => p.biaOutdated)
      .slice(0, 3)
      .forEach((p) =>
        out.push({
          level: "moyen",
          title: `BIA à réviser : ${p.name}`,
          detail: p.biaAge === null ? "Aucune date de BIA" : `Dernière analyse il y a ${Math.round(p.biaAge)} mois`,
          target: "bia",
        }),
      );
    plans
      .filter((p) => p.statut === "À réviser")
      .slice(0, 3)
      .forEach((p) => out.push({ level: "eleve", title: `Plan à réviser : ${p.titre}`, detail: p.type ?? "", target: "plan" }));
    return out;
  }, [criticalRisks, criticalProcesses, processEnriched, plans]);

  // --- Échéances ----------------------------------------------------------
  const deadlines = useMemo(() => {
    const items: { date: string; label: string; detail: string; target: string; overdue: boolean }[] = [];
    processEnriched.forEach((p) => {
      if (!p.last_bia_date) return;
      const next = new Date(new Date(p.last_bia_date).getTime() + MONTHS_12);
      items.push({
        date: next.toISOString().slice(0, 10),
        label: `Révision BIA — ${p.name}`,
        detail: p.direction_name,
        target: "bia",
        overdue: next.getTime() < Date.now(),
      });
    });
    plans.forEach((p) => {
      if (!p.date_revision_suivante) return;
      items.push({
        date: p.date_revision_suivante,
        label: `Révision plan — ${p.titre}`,
        detail: p.type ?? "",
        target: "plan",
        overdue: new Date(p.date_revision_suivante).getTime() < Date.now(),
      });
    });
    riskEnriched.forEach((r) => {
      if (!r.date_revue) return;
      items.push({
        date: r.date_revue,
        label: `Revue de risque — ${r.label}`,
        detail: r.direction_name ?? "",
        target: "risk",
        overdue: new Date(r.date_revue).getTime() < Date.now(),
      });
    });
    mesures.forEach((m) => {
      if (!m.echeance) return;
      items.push({
        date: m.echeance,
        label: `Mesure — ${m.mesure}`,
        detail: m.responsable ?? "",
        target: "risk",
        overdue: new Date(m.echeance).getTime() < Date.now() && (m.avancement ?? 0) < 100,
      });
    });
    return items.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8);
  }, [processEnriched, plans, riskEnriched, mesures]);

  return {
    loading,
    refreshedAt,
    reload: load,
    orgs,
    directions,
    processEnriched,
    criticalProcesses,
    riskEnriched,
    criticalRisks,
    untreatedRisks,
    matrix,
    resources,
    strategies,
    assocs,
    plans,
    planStats,
    planRisk,
    maturity,
    chain,
    priorities,
    deadlines,
  };
};

export type BcmDashboardData = ReturnType<typeof useBcmDashboard>;
