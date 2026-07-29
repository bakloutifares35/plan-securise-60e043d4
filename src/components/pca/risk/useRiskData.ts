import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/resillia/client";
import { toast } from "@/hooks/use-toast";
import {
  Actif,
  ContexteAnalyse,
  DEFAULT_PARAMS,
  Menace,
  ParametresRisques,
  PlanTraitement,
  Risque,
  recompute,
} from "./riskModel";

export type RiskData = ReturnType<typeof useRiskData>;

const MISSING_TABLE = "PGRST205";

export const useRiskData = () => {
  const [loading, setLoading] = useState(true);
  const [schemaReady, setSchemaReady] = useState(true);
  const [contextes, setContextes] = useState<ContexteAnalyse[]>([]);
  const [actifs, setActifs] = useState<Actif[]>([]);
  const [menaces, setMenaces] = useState<Menace[]>([]);
  const [risques, setRisques] = useState<Risque[]>([]);
  const [plans, setPlans] = useState<PlanTraitement[]>([]);
  const [processus, setProcessus] = useState<{ id: string; name: string }[]>([]);
  const [organisations, setOrganisations] = useState<{ id: string; name: string }[]>([]);
  const [params, setParams] = useState<ParametresRisques>(DEFAULT_PARAMS);

  const load = useCallback(async () => {
    setLoading(true);
    const [ctx, act, men, ris, pln, prc, org, prm] = await Promise.all([
      supabase.from("contexte_analyse").select("*").order("created_at", { ascending: false }),
      supabase.from("actifs").select("*").order("nom"),
      supabase.from("menaces").select("*").order("code"),
      supabase.from("risques").select("*").order("created_at", { ascending: false }),
      supabase.from("plans_traitement").select("*").order("echeance", { nullsFirst: false }),
      supabase.from("processus_metier").select("id, name").order("name"),
      supabase.from("organisations").select("id, name").order("name"),
      supabase.from("parametres_risques").select("*").eq("cle", "default").maybeSingle(),
    ]);

    const missing = [ctx, act, men, pln, prm].some((r: any) => r.error?.code === MISSING_TABLE);
    setSchemaReady(!missing);

    setContextes((ctx.data as any) ?? []);
    setActifs((act.data as any) ?? []);
    setMenaces((men.data as any) ?? []);
    setRisques((ris.data as any) ?? []);
    setPlans((pln.data as any) ?? []);
    setProcessus((prc.data as any) ?? []);
    setOrganisations((org.data as any) ?? []);
    if (prm.data) setParams({ ...DEFAULT_PARAMS, ...(prm.data as any) });
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const fail = (e: any) =>
    toast({ title: "Erreur", description: e?.message ?? "Opération impossible", variant: "destructive" });

  const saveContexte = async (c: Partial<ContexteAnalyse>) => {
    const { id, ...rest } = c;
    const q = id
      ? supabase.from("contexte_analyse").update(rest).eq("id", id)
      : supabase.from("contexte_analyse").insert(rest);
    const { error } = await q;
    if (error) return fail(error);
    toast({ title: "Contexte enregistré" });
    load();
  };

  const deleteRow = async (table: string, id: string) => {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) return fail(error);
    toast({ title: "Élément supprimé" });
    load();
  };

  const saveActif = async (a: Partial<Actif>) => {
    const { id, ...rest } = a;
    const { error } = id
      ? await supabase.from("actifs").update(rest).eq("id", id)
      : await supabase.from("actifs").insert(rest);
    if (error) return fail(error);
    toast({ title: "Actif enregistré" });
    load();
  };

  const saveMenace = async (m: Partial<Menace>) => {
    const { id, ...rest } = m;
    const { error } = id
      ? await supabase.from("menaces").update(rest).eq("id", id)
      : await supabase.from("menaces").insert(rest);
    if (error) return fail(error);
    toast({ title: "Menace enregistrée" });
    load();
  };

  const saveRisque = async (r: Partial<Risque>) => {
    const { id, ...rest } = { ...r, ...recompute(r, params) };
    const { error } = id
      ? await supabase.from("risques").update(rest).eq("id", id)
      : await supabase.from("risques").insert(rest);
    if (error) return fail(error);
    toast({ title: id ? "Risque mis à jour" : "Risque créé" });
    load();
  };

  const savePlan = async (p: Partial<PlanTraitement>) => {
    const { id, ...rest } = p;
    const { error } = id
      ? await supabase.from("plans_traitement").update(rest).eq("id", id)
      : await supabase.from("plans_traitement").insert(rest);
    if (error) return fail(error);
    toast({ title: "Mesure enregistrée" });
    load();
  };

  const saveParams = async (p: ParametresRisques) => {
    const { id, ...rest } = p;
    const { error } = await supabase.from("parametres_risques").upsert({ ...rest, cle: "default" }, { onConflict: "cle" });
    if (error) return fail(error);
    toast({ title: "Paramètres enregistrés" });
    load();
  };

  return {
    loading, schemaReady, reload: load,
    contextes, actifs, menaces, risques, plans, processus, organisations, params,
    saveContexte, saveActif, saveMenace, saveRisque, savePlan, saveParams, deleteRow,
  };
};
