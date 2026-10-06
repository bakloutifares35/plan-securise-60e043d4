// Données du module Exercices PCA — pattern useState/useEffect + reload()
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/db";
import { computeMaxScore, scoreToCriticality } from "@/data/bia";

export type TestType = "TEST_PROCEDURE" | "EXERCICE_TABLE" | "TEST_IT" | "SIMULATION_COMPLETE";
export type TestStatut = "PLANIFIE" | "EN_COURS" | "TERMINE" | "OBJECTIFS_NON_ATTEINTS";

export const TYPE_LABELS: Record<TestType, string> = {
  TEST_PROCEDURE: "Test de procédure",
  EXERCICE_TABLE: "Exercice sur table",
  TEST_IT: "Test IT",
  SIMULATION_COMPLETE: "Simulation complète",
};
export const STATUT_LABELS: Record<TestStatut, string> = {
  PLANIFIE: "Planifié",
  EN_COURS: "En cours",
  TERMINE: "Terminé",
  OBJECTIFS_NON_ATTEINTS: "Objectifs non atteints",
};
export const CRIT_COLORS: Record<string, string> = {
  Critique: "#FFEBEE", Sévère: "#FBE9E7", Majeur: "#FFF3E0", Modéré: "#FFF8E1", Mineur: "#E8F5E9",
};
export const CRIT_ACCENT: Record<string, string> = {
  Critique: "#C62828", Sévère: "#D84315", Majeur: "#EF6C00", Modéré: "#B08900", Mineur: "#2E7D32",
};

export interface TestPca {
  id: string; reference: string | null; type: TestType; titre: string; description: string | null;
  date_planifiee: string | null; date_debut_reelle: string | null; date_fin_reelle: string | null;
  processus_id: string | null; scenario_risque_id: string | null; strategie_id: string | null;
  statut: TestStatut; est_tlpt: boolean; created_at: string;
}
export interface ProcLite {
  id: string; name: string; direction: string | null; rto_hours: number | null;
  criticality_level: string | null; impacts: any; criticite: string;
}
export interface RisqueLite { id: string; title: string; processus_id: string | null }
export interface StratAssoc { id: string; processus_id: string | null; rto_atteignable: number | null; statut: string | null }

const FALLBACK: Record<string, string> = { CRITIQUE: "Critique", MAJEUR: "Majeur", MODERE: "Modéré", MINEUR: "Mineur" };
export const procCriticite = (p: { impacts: any; criticality_level: string | null }) => {
  const score = computeMaxScore(p.impacts);
  if (score > 0) return scoreToCriticality(score) as string;
  return FALLBACK[p.criticality_level ?? ""] ?? "Mineur";
};
export { isCriticalLevel as isCritical } from "@/lib/kpiService";

export const useExercices = () => {
  const [loading, setLoading] = useState(true);
  const [schemaReady, setSchemaReady] = useState(true);
  const [tests, setTests] = useState<TestPca[]>([]);
  const [processus, setProcessus] = useState<ProcLite[]>([]);
  const [risques, setRisques] = useState<RisqueLite[]>([]);
  const [strategies, setStrategies] = useState<StratAssoc[]>([]);
  const [dora, setDora] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const [t, p, r, s, o] = await Promise.all([
      supabase.from("tests_pca").select("*").order("date_planifiee", { ascending: false }),
      supabase.from("processus_metier").select("id, name, direction, rto_hours, criticality_level, impacts").order("name"),
      supabase.from("risques").select("id, title, processus_id"),
      supabase.from("strategies_association").select("id, processus_id, rto_atteignable, statut"),
      supabase.from("organisations").select("assujetti_dora"),
    ]);
    if (t.error?.code === "42P01" || t.error?.code === "PGRST205") setSchemaReady(false);
    else setSchemaReady(true);
    setTests((t.data as TestPca[]) ?? []);
    setProcessus(((p.data as any[]) ?? []).map((x) => ({ ...x, criticite: procCriticite(x) })));
    setRisques((r.data as RisqueLite[]) ?? []);
    setStrategies((s.data as StratAssoc[]) ?? []);
    setDora(((o.data as any[]) ?? []).some((x) => x.assujetti_dora));
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);
  return { loading, schemaReady, tests, processus, risques, strategies, dora, reload };
};

export type ExData = ReturnType<typeof useExercices>;

export interface TestDetail {
  participants: any[]; injectables: any[]; objectifs: any[]; resultat: any | null; actions: any[];
}

export const useTestDetail = (testId: string | null) => {
  const [detail, setDetail] = useState<TestDetail>({ participants: [], injectables: [], objectifs: [], resultat: null, actions: [] });
  const reload = useCallback(async () => {
    if (!testId) return;
    const [pa, inj, ob, re, ac] = await Promise.all([
      supabase.from("test_participants").select("*").eq("test_id", testId),
      supabase.from("test_injectables").select("*").eq("test_id", testId).order("ordre"),
      supabase.from("test_objectifs").select("*").eq("test_id", testId).order("ordre"),
      supabase.from("test_resultats").select("*").eq("test_id", testId).maybeSingle(),
      supabase.from("test_actions_correctives").select("*").eq("test_id", testId),
    ]);
    setDetail({
      participants: pa.data ?? [], injectables: inj.data ?? [], objectifs: ob.data ?? [],
      resultat: re.data ?? null, actions: ac.data ?? [],
    });
  }, [testId]);
  useEffect(() => { reload(); }, [reload]);
  return { detail, reload };
};

/** Dernier test terminé par processus */
export const lastTestedMap = (tests: TestPca[]) => {
  const m = new Map<string, Date>();
  tests.forEach((t) => {
    if (!t.processus_id || (t.statut !== "TERMINE" && t.statut !== "OBJECTIFS_NON_ATTEINTS")) return;
    const d = new Date(t.date_fin_reelle ?? t.date_planifiee ?? t.created_at);
    const prev = m.get(t.processus_id);
    if (!prev || d > prev) m.set(t.processus_id, d);
  });
  return m;
};
export const monthsSince = (d: Date) => (Date.now() - d.getTime()) / (30.44 * 86400000);
export const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString("fr-FR") : "—");
