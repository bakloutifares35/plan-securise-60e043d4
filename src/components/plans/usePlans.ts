// src/components/plans/usePlans.ts
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/db";
import { toast } from "@/hooks/use-toast";
import { DEFAULT_SECTIONS, MISSING_TABLE, Plan, PlanSection } from "./types"; 
import { computeMaxScore, scoreToCriticality, type Criticality } from "@/data/bia";

export type ProcessLite = {
  id: string;
  name: string;
  direction?: string | null;
  rto_hours?: number | null;
  rpo_hours?: number | null;
  criticality_level?: string | null;
  impacts?: any;
  criticite?: Criticality;
  score?: number;
};

// ⚠️ STRATÉGIE ENRICHIE : On ajoute le nom réel depuis strategies_catalogue
export type StrategieLite = {
  id: string;
  nom: string; // Nom réel de la stratégie
  processus_id?: string;
  statut?: string;
};

export type PlansData = {
  plans: Plan[];
  planSections: PlanSection[]; 
  processus: ProcessLite[];
  risques: any[];
  strategies: StrategieLite[]; // ✅ Type corrigé
  links: { processus: any[]; risques: any[]; strategies: any[] };
  loading: boolean;
  schemaReady: boolean;
  reload: () => Promise<void>;
  createPlan: (payload: Partial<Plan>) => Promise<string | null>;
  updatePlan: (id: string, payload: Partial<Plan>) => Promise<boolean>;
  deletePlan: (id: string) => Promise<boolean>;
  duplicatePlan: (plan: Plan) => Promise<string | null>;
};

export const usePlans = (): PlansData => {
  const [loading, setLoading] = useState(true);
  const [schemaReady, setSchemaReady] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planSections, setPlanSections] = useState<PlanSection[]>([]); 
  const [processus, setProcessus] = useState<ProcessLite[]>([]);
  const [risques, setRisques] = useState<any[]>([]);
  const [strategies, setStrategies] = useState<StrategieLite[]>([]);
  const [links, setLinks] = useState<{ processus: any[]; risques: any[]; strategies: any[] }>({
    processus: [],
    risques: [],
    strategies: [],
  });

  const load = useCallback(async () => {
    setLoading(true);

    // ✅ CORRECTION : On charge TOUTES les vraies tables + catalogue stratégies
    const [planRes, procRes, sectionsRes, riskRes, stratCatalogRes, associationsRes, lpRes, lrRes, lsRes] = await Promise.all([
      supabase.from("plans").select("*").order("created_at", { ascending: false }),
      supabase.from("processus_metier").select("id, name, direction, rto_hours, rpo_hours, impacts").order("name"), // ✅ Table réelle !
      supabase.from("plan_sections").select("id, plan_id, statut"),
      supabase.from("risques").select("id, titre, title, niveau_residuel, score_residuel").limit(500),
      supabase.from("strategies_catalogue").select("id, nom").limit(500), // ✅ On prend les noms ici !
      supabase.from("strategies_association").select("*").limit(500),
      supabase.from("plan_processus").select("*"),
      supabase.from("plan_risques").select("*"),
      supabase.from("plan_strategies").select("*"),
    ]);

    if (planRes.error?.code === MISSING_TABLE) {
      setSchemaReady(false);
      setLoading(false);
      return;
    }
    setSchemaReady(true);
    if (planRes.error) {
      toast({ title: "Erreur chargement plans", description: planRes.error.message, variant: "destructive" });
    }

    // ✅ CORRECTION criticité : Depuis les impacts réels de processus_metier
    const enrichedProcessus = ((procRes.data as any[]) ?? []).map((p) => {
      const score = computeMaxScore(p.impacts);
      const criticite = scoreToCriticality(score);
      return { ...p, criticite, score };
    });

    // ✅ CORRECTION stratégies : Fusionner l'association avec le nom du catalogue
    const strategiesCatalogue = (stratCatalogRes.data as any[]) ?? [];
    const strategieAssociations = (associationsRes.data as any[]) ?? [];
    
    const enrichedStrategies = strategieAssociations.map((s) => {
      const catalogItem = strategiesCatalogue.find((c) => c.id === s.strategie_id); // ⚠️ Champ strategie_id
      return {
        id: s.id,
        nom: catalogItem?.nom || "Stratégie sans nom",
        processus_id: s.processus_id,
        statut: s.statut || "—",
      };
    });

    setPlans((planRes.data as Plan[]) ?? []);
    setPlanSections((sectionsRes.data as PlanSection[]) ?? []); 
    setProcessus(enrichedProcessus);
    setRisques((riskRes.data as any[]) ?? []);
    setStrategies(enrichedStrategies); // ✅ On met les stratégies enrichies
    setLinks({
      processus: (lpRes.data as any[]) ?? [],
      risques: (lrRes.data as any[]) ?? [],
      strategies: (lsRes.data as any[]) ?? [],
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createPlan = async (payload: Partial<Plan>) => {
    const { data, error } = await supabase
      .from("plans")
      .insert({
        type: payload.type || "PCA",
        titre: payload.titre,
        entite_id: payload.entite_id || null,
        redacteur: payload.redacteur || null,
        responsable_pca: payload.responsable_pca || null,
        validateur_metier: payload.validateur_metier || null,
        statut: "Brouillon",
        numero_version: 1,
        est_actif: true,
      })
      .select("id")
      .single();

    if (error) {
      toast({ title: "Erreur création du plan", description: error.message, variant: "destructive" });
      return null;
    }

    const planId = (data as any).id as string;
    await supabase.from("plan_sections").insert(
      DEFAULT_SECTIONS.map((titre, i) => ({ plan_id: planId, titre, ordre: i, statut: "À rédiger", contenu: "" }))
    );
    await supabase.from("plan_workflow").insert({ plan_id: planId, etape: "Rédaction", statut: "En attente" });

    toast({ title: "Plan créé", description: "Les 9 sections types ont été générées." });
    await load();
    return planId;
  };

  const updatePlan = async (id: string, payload: Partial<Plan>) => {
    const { error } = await supabase
      .from("plans")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast({ title: "Erreur enregistrement", description: error.message, variant: "destructive" });
      return false;
    }
    await load();
    return true;
  };

  const deletePlan = async (id: string) => {
    const { error } = await supabase.from("plans").delete().eq("id", id);
    if (error) {
      toast({ title: "Erreur suppression", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Plan supprimé" });
    await load();
    return true;
  };

  const duplicatePlan = async (plan: Plan) => {
    const { data, error } = await supabase
      .from("plans")
      .insert({
        type: plan.type,
        titre: `${plan.titre} (copie)`,
        entite_id: plan.entite_id,
        redacteur: plan.redacteur,
        responsable_pca: plan.responsable_pca,
        validateur_metier: plan.validateur_metier,
        statut: "Brouillon",
        numero_version: 1,
        est_actif: true,
      })
      .select("id")
      .single();

    if (error || !data) {
      toast({ title: "Erreur duplication", description: error?.message, variant: "destructive" });
      return null;
    }
    const newId = (data as any).id as string;

    const { data: sections } = await supabase.from("plan_sections").select("*").eq("plan_id", plan.id);
    for (const s of (sections as any[]) ?? []) {
      const { data: newSection } = await supabase
        .from("plan_sections")
        .insert({ plan_id: newId, titre: s.titre, ordre: s.ordre, contenu: s.contenu, statut: "À rédiger" })
        .select("id")
        .single();
      const { data: procs } = await supabase.from("plan_procedures").select("*").eq("section_id", s.id);
      for (const p of (procs as any[]) ?? []) {
        const { data: newProc } = await supabase
          .from("plan_procedures")
          .insert({ section_id: (newSection as any)?.id, titre: p.titre, ordre: p.ordre })
          .select("id")
          .single();
        const { data: etapes } = await supabase.from("plan_etapes").select("*").eq("procedure_id", p.id);
        if ((etapes as any[])?.length) {
          await supabase.from("plan_etapes").insert(
            (etapes as any[]).map((e) => ({
              procedure_id: (newProc as any)?.id,
              ordre: e.ordre,
              description: e.description,
              responsable: e.responsable,
              duree_estimee_minutes: e.duree_estimee_minutes,
            }))
          );
        }
      }
    }

    const { data: contacts } = await supabase.from("plan_contacts").select("*").eq("plan_id", plan.id);
    if ((contacts as any[])?.length) {
      await supabase.from("plan_contacts").insert(
        (contacts as any[]).map((c) => ({
          plan_id: newId,
          ordre: c.ordre,
          nom: c.nom,
          role: c.role,
          telephone: c.telephone,
          email: c.email,
          est_suppleant: c.est_suppleant,
        }))
      );
    }

    await supabase.from("plan_workflow").insert({ plan_id: newId, etape: "Rédaction", statut: "En attente" });

    toast({ title: "Plan dupliqué" });
    await load();
    return newId;
  };

  return {
    plans,
    planSections,
    processus,
    risques,
    strategies,
    links,
    loading,
    schemaReady,
    reload: load,
    createPlan,
    updatePlan,
    deletePlan,
    duplicatePlan,
  };
};