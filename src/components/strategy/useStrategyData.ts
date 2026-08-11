// src/components/strategy/useStrategyData.ts
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/resillia/client";
import { toast } from "@/hooks/use-toast";
import { ProcessusLite, StrategieAssociation, StrategieCatalogue } from "./types";

export type StrategyData = {
  catalogue: StrategieCatalogue[];
  associations: StrategieAssociation[];
  processus: ProcessusLite[];
  loading: boolean;
  schemaReady: boolean;
  reload: () => void;
  addStrategie: (payload: any) => Promise<boolean>;
  deleteStrategie: (id: string) => Promise<boolean>;
  saveAssociation: (payload: any) => Promise<boolean>;
  deleteAssociation: (id: string) => Promise<boolean>;
  demoteOthers: (processusId: string, scenarioId: string | null, keepId?: string) => Promise<number>;
};

const MISSING_TABLE = "PGRST205";

export const useStrategyData = () => {
  const [loading, setLoading] = useState(true);
  const [schemaReady, setSchemaReady] = useState(true);
  const [catalogue, setCatalogue] = useState<StrategieCatalogue[]>([]);
  const [associations, setAssociations] = useState<StrategieAssociation[]>([]);
  const [processus, setProcessus] = useState<ProcessusLite[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    
    const { data: catData, error: catError } = await supabase
      .from("strategies_catalogue")
      .select("*")
      .order("nom");
    
    const { data: assocData, error: assocError } = await supabase
      .from("strategies_association")
      .select("*")
      .order("created_at", { ascending: false });
    
    // 🔥 CORRECTION ICI : On ajoute 'impacts' dans le select
    const { data: procData, error: procError } = await supabase
      .from("processus_metier")
      .select("id, name, direction, owner, description, criticality_level, rto_hours, rpo_hours, status, is_critical, impacts") 
      .order("name");

    if (catError && catError.code !== MISSING_TABLE) {
      toast({ title: "Erreur Catalogue", description: catError.message, variant: "destructive" });
    }
    if (assocError && assocError.code !== MISSING_TABLE) {
      toast({ title: "Erreur Associations", description: assocError.message, variant: "destructive" });
    }
    if (procError) {
      toast({ title: "Erreur Processus BIA", description: procError.message, variant: "destructive" });
    }

    if (catError?.code === MISSING_TABLE || assocError?.code === MISSING_TABLE) {
      setSchemaReady(false);
    } else {
      setSchemaReady(true);
    }

    setCatalogue((catData as StrategieCatalogue[]) ?? []);
    setAssociations((assocData as StrategieAssociation[]) ?? []);
    setProcessus((procData as ProcessusLite[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addStrategie = async (payload: Partial<StrategieCatalogue>) => {
    const { nom, description } = payload;
    if (payload.id) {
      const { error } = await supabase.from("strategies_catalogue").update({ nom, description }).eq("id", payload.id);
      if (error) {
        toast({ title: "Erreur modification", description: error.message, variant: "destructive" });
        return false;
      }
      toast({ title: "Stratégie modifiée" });
      await load();
      return true;
    } else {
      const { error } = await supabase.from("strategies_catalogue").insert({ nom, description, type: "Générique" });
      if (error) {
        toast({ title: "Erreur ajout", description: error.message, variant: "destructive" });
        return false;
      }
      toast({ title: "Stratégie ajoutée" });
      await load();
      return true;
    }
  };

  const deleteStrategie = async (id: string) => {
    const { error } = await supabase.from("strategies_catalogue").delete().eq("id", id);
    if (error) {
      toast({ title: "Erreur suppression", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Stratégie supprimée" });
    await load();
    return true;
  };

  const saveAssociation = async (payload: Partial<StrategieAssociation>) => {
    const { id, ...rest } = payload as any;
    const body = {
      ...rest,
      scenario_id: rest.scenario_id || null,
      lien_pca_id: rest.lien_pca_id || null,
      contrat_reference: rest.contrat_reference || null,
      sla_reference: rest.sla_reference || null,
    };
    
    if (body.statut === "Retenue" && body.processus_id) {
      const { data: existing } = await supabase
        .from("strategies_association")
        .select("id, strategie_id")
        .eq("processus_id", body.processus_id)
        .eq("scenario_id", body.scenario_id || '')
        .eq("statut", "Retenue")
        .neq("id", id || '');
      
      if (existing && existing.length > 0) {
        const confirm = window.confirm(`Une stratégie est déjà retenue pour ce processus. Voulez-vous la remplacer ?`);
        if (!confirm) return false;
        await supabase.from("strategies_association").update({ statut: "Proposée" }).in("id", existing.map(e => e.id));
      }
    }
    
    const query = id
      ? supabase.from("strategies_association").update(body).eq("id", id)
      : supabase.from("strategies_association").insert(body);
    const { error } = await query;
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: id ? "Association mise à jour" : "Association créée" });
    await load();
    return true;
  };

  const deleteAssociation = async (id: string) => {
    const { error } = await supabase.from("strategies_association").delete().eq("id", id);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Association supprimée" });
    await load();
    return true;
  };

  const demoteOthers = async (processusId: string, scenarioId: string | null, keepId?: string) => {
    const { data: rivals } = await supabase
      .from("strategies_association")
      .select("id")
      .eq("processus_id", processusId)
      .eq("scenario_id", scenarioId || '')
      .eq("statut", "Retenue")
      .neq("id", keepId || '');
    
    if (rivals && rivals.length > 0) {
      await supabase.from("strategies_association").update({ statut: "Proposée" }).in("id", rivals.map(r => r.id));
    }
    return rivals?.length || 0;
  };

  return {
    loading,
    schemaReady,
    catalogue,
    associations,
    processus,
    reload: load,
    addStrategie,
    deleteStrategie,
    saveAssociation,
    deleteAssociation,
    demoteOthers,
  };
};