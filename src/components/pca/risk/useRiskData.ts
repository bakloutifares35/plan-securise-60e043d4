import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/db";
import { toast } from "@/hooks/use-toast";
import { 
  Actif, ContexteAnalyse, Menace, ParametresRisques, PlanTraitement, 
  Risque, recompute
} from "./riskModel";

export type RiskData = ReturnType<typeof useRiskData>;

const MISSING_TABLE = "PGRST205";

// Valeurs par défaut pour les paramètres
const DEFAULT_PARAMS: ParametresRisques = {
  cle: "default",
  echelle_probabilite: [
    { n: 1, label: "Très improbable", desc: "Moins d'une fois tous les 10 ans" },
    { n: 2, label: "Improbable", desc: "Une fois tous les 5 à 10 ans" },
    { n: 3, label: "Possible", desc: "Une fois par an" },
    { n: 4, label: "Probable", desc: "Plusieurs fois par an" },
    { n: 5, label: "Quasi certain", desc: "Mensuel ou plus fréquent" },
  ],
  echelle_impact: [
    { n: 1, label: "Négligeable", desc: "Aucun effet significatif" },
    { n: 2, label: "Mineur", desc: "Effet limité, absorbé en interne" },
    { n: 3, label: "Modéré", desc: "Effet notable sur les activités" },
    { n: 4, label: "Majeur", desc: "Atteinte forte, remontée COMEX" },
    { n: 5, label: "Catastrophique", desc: "Survie de l'organisation en jeu" },
  ],
  ponderation_axes: {},
  seuil_acceptable: 6,
  seuil_tolerable: 12,
  periodicite_revue_mois: 6,
};

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
    
    try {
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

      // Vérifier si les tables existent
      const missing = [ctx, act, men, pln, prm].some((r: any) => r.error?.code === MISSING_TABLE);
      setSchemaReady(!missing);

      // Mettre à jour les états avec des tableaux vides si les données sont null/undefined
      setContextes((ctx.data as any) ?? []);
      setActifs((act.data as any) ?? []);
      setMenaces((men.data as any) ?? []);
      setRisques((ris.data as any) ?? []);
      setPlans((pln.data as any) ?? []);
      setProcessus((prc.data as any) ?? []);
      setOrganisations((org.data as any) ?? []);
      
      if (prm.data) {
        setParams({ ...DEFAULT_PARAMS, ...(prm.data as any) });
      } else {
        setParams(DEFAULT_PARAMS);
      }
    } catch (error) {
      console.error("Erreur lors du chargement des données:", error);
      // En cas d'erreur, initialiser les tableaux vides
      setActifs([]);
      setMenaces([]);
      setRisques([]);
      setPlans([]);
      setContextes([]);
      setProcessus([]);
      setOrganisations([]);
    } finally {
      setLoading(false);
    }
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
    const { id, ...rest } = { ...r, ...recompute(r) };
    const dataToSave = {
      ...rest,
      date_identification: r.date_identification || new Date().toISOString().split('T')[0],
    };
    const { error } = id
      ? await supabase.from("risques").update(dataToSave).eq("id", id)
      : await supabase.from("risques").insert(dataToSave);
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

  const deleteRow = async (table: string, id: string) => {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) return fail(error);
    toast({ title: "Élément supprimé" });
    load();
  };

  return {
    loading, schemaReady, reload: load,
    contextes, actifs, menaces, risques, plans, processus, organisations, params,
    saveContexte, saveActif, saveMenace, saveRisque, savePlan, saveParams, deleteRow,
  };
};