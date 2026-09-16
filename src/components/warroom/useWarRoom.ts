// src/components/warroom/useWarRoom.ts — chargement et CRUD du module War Room
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/db";
import { toast } from "@/hooks/use-toast";
import {
  Incident,
  IncidentAction,
  IncidentCommunication,
  IncidentPlan,
  MainCouranteEntry,
  MISSING_TABLE,
  PlanLite,
  ProcessLite,
  Retex,
} from "./types";

export type WarRoomData = ReturnType<typeof useWarRoom>;

export const useWarRoom = () => {
  const [loading, setLoading] = useState(true);
  const [schemaReady, setSchemaReady] = useState(true);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [processus, setProcessus] = useState<ProcessLite[]>([]);
  const [plans, setPlans] = useState<PlanLite[]>([]);
  const [plansModuleAvailable, setPlansModuleAvailable] = useState(false);
  const [incidentProcessus, setIncidentProcessus] = useState<{ incident_id: string; processus_id: string }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [incRes, procRes, planRes, ipRes] = await Promise.all([
      supabase.from("incidents").select("*").order("date_heure_debut", { ascending: false }),
      supabase.from("processus_metier").select("id, name, direction").order("name"),
      supabase.from("plans").select("id, titre, type").limit(500),
      supabase.from("incident_processus").select("incident_id, processus_id"),
    ]);

    if (incRes.error?.code === MISSING_TABLE) {
      setSchemaReady(false);
      setLoading(false);
      return;
    }
    setSchemaReady(true);
    if (incRes.error) {
      toast({ title: "Erreur chargement des incidents", description: incRes.error.message, variant: "destructive" });
    }

    setIncidents((incRes.data as Incident[]) ?? []);
    setProcessus((procRes.data as ProcessLite[]) ?? []);
    setPlansModuleAvailable(!planRes.error);
    setPlans((planRes.data as PlanLite[]) ?? []);
    setIncidentProcessus((ipRes.data as any[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createIncident = async (
    payload: Partial<Incident>,
    processusIds: string[]
  ): Promise<string | null> => {
    const { data, error } = await supabase
      .from("incidents")
      .insert({
        type: payload.type || null,
        titre: payload.titre,
        date_heure_debut: payload.date_heure_debut || new Date().toISOString(),
        niveau_severite: payload.niveau_severite || "P3",
        statut: "Déclaré",
        declarant: payload.declarant || null,
        description: payload.description || null,
      })
      .select("id")
      .single();

    if (error || !data) {
      toast({ title: "Erreur de déclaration", description: error?.message, variant: "destructive" });
      return null;
    }
    const id = (data as any).id as string;

    if (processusIds.length) {
      await supabase
        .from("incident_processus")
        .insert(processusIds.map((pid) => ({ incident_id: id, processus_id: pid })));
    }

    // Traçabilité : première entrée de main courante automatique (aucune notification réelle).
    await supabase.from("incident_main_courante").insert({
      incident_id: id,
      auteur: payload.declarant || "Inconnu",
      type: "Information",
      contenu: `Incident déclaré par ${payload.declarant || "un utilisateur"}.`,
    });

    toast({ title: "Incident déclaré", description: payload.titre });
    await load();
    return id;
  };

  const updateIncident = async (id: string, payload: Partial<Incident>) => {
    const { error } = await supabase
      .from("incidents")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast({ title: "Erreur enregistrement", description: error.message, variant: "destructive" });
      return false;
    }
    await load();
    return true;
  };

  return {
    loading,
    schemaReady,
    incidents,
    processus,
    plans,
    plansModuleAvailable,
    incidentProcessus,
    reload: load,
    createIncident,
    updateIncident,
  };
};

/** Détail d'un incident : main courante, actions, plans, communications, RETEX. */
export const useIncidentDetail = (incidentId: string | null) => {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<MainCouranteEntry[]>([]);
  const [actions, setActions] = useState<IncidentAction[]>([]);
  const [plansLies, setPlansLies] = useState<IncidentPlan[]>([]);
  const [communications, setCommunications] = useState<IncidentCommunication[]>([]);
  const [retex, setRetex] = useState<Retex | null>(null);

  const load = useCallback(async () => {
    if (!incidentId) return;
    setLoading(true);
    const [mcRes, actRes, plRes, comRes, rxRes] = await Promise.all([
      supabase.from("incident_main_courante").select("*").eq("incident_id", incidentId).order("horodatage", { ascending: true }),
      supabase.from("incident_actions").select("*").eq("incident_id", incidentId).order("created_at", { ascending: true }),
      supabase.from("incident_plans").select("*").eq("incident_id", incidentId),
      supabase.from("incident_communications").select("*").eq("incident_id", incidentId).order("created_at", { ascending: true }),
      supabase.from("incident_retex").select("*").eq("incident_id", incidentId).maybeSingle(),
    ]);
    setEntries((mcRes.data as MainCouranteEntry[]) ?? []);
    setActions((actRes.data as IncidentAction[]) ?? []);
    setPlansLies((plRes.data as IncidentPlan[]) ?? []);
    setCommunications((comRes.data as IncidentCommunication[]) ?? []);
    setRetex((rxRes.data as Retex) ?? null);
    setLoading(false);
  }, [incidentId]);

  useEffect(() => {
    load();
  }, [load]);

  const addEntry = async (payload: Partial<MainCouranteEntry>) => {
    const { error } = await supabase.from("incident_main_courante").insert({
      incident_id: incidentId,
      auteur: payload.auteur || "Inconnu",
      type: payload.type || "Information",
      contenu: payload.contenu,
    });
    if (error) {
      toast({ title: "Erreur main courante", description: error.message, variant: "destructive" });
      return false;
    }
    await load();
    return true;
  };

  const addAction = async (payload: Partial<IncidentAction>) => {
    const { error } = await supabase.from("incident_actions").insert({
      incident_id: incidentId,
      description: payload.description,
      responsable: payload.responsable || null,
      echeance: payload.echeance || null,
      statut: payload.statut || "À faire",
      plan_associe_id: payload.plan_associe_id || null,
    });
    if (error) {
      toast({ title: "Erreur création d'action", description: error.message, variant: "destructive" });
      return false;
    }
    await addEntry({ type: "Action", contenu: `Action créée : ${payload.description}`, auteur: payload.responsable || undefined });
    await load();
    return true;
  };

  const setActionStatut = async (action: IncidentAction, statut: IncidentAction["statut"]) => {
    const { error } = await supabase.from("incident_actions").update({ statut }).eq("id", action.id);
    if (error) {
      toast({ title: "Erreur mise à jour", description: error.message, variant: "destructive" });
      return;
    }
    await addEntry({ type: "Action", contenu: `Action « ${action.description} » → ${statut}`, auteur: action.responsable || undefined });
    await load();
  };

  const addPlan = async (payload: { plan_id?: string | null; libelle?: string | null }) => {
    const { error } = await supabase.from("incident_plans").insert({
      incident_id: incidentId,
      plan_id: payload.plan_id || null,
      libelle: payload.libelle || null,
    });
    if (error) {
      toast({ title: "Erreur plan activé", description: error.message, variant: "destructive" });
      return false;
    }
    await addEntry({ type: "Décision", contenu: `Plan activé : ${payload.libelle || "plan référencé"}` });
    await load();
    return true;
  };

  const removePlan = async (id: string) => {
    await supabase.from("incident_plans").delete().eq("id", id);
    await load();
  };

  const addCommunication = async (payload: Partial<IncidentCommunication>) => {
    const { error } = await supabase.from("incident_communications").insert({
      incident_id: incidentId,
      objet: payload.objet,
      message: payload.message || null,
      statut: payload.statut || "Brouillon",
      auteur: payload.auteur || null,
    });
    if (error) {
      toast({ title: "Erreur communication", description: error.message, variant: "destructive" });
      return false;
    }
    await load();
    return true;
  };

  const setCommunicationStatut = async (comm: IncidentCommunication, statut: IncidentCommunication["statut"]) => {
    const { error } = await supabase.from("incident_communications").update({ statut }).eq("id", comm.id);
    if (error) {
      toast({ title: "Erreur mise à jour", description: error.message, variant: "destructive" });
      return;
    }
    if (statut === "Envoyé") {
      // Aucun envoi réel : simple suivi du statut dans la main courante.
      await addEntry({ type: "Communication", contenu: `Communication « ${comm.objet} » marquée comme envoyée.` });
    }
    await load();
  };

  const saveRetex = async (payload: Retex) => {
    const existing = retex?.id;
    const body = {
      incident_id: incidentId,
      resume: payload.resume,
      causes_racines: payload.causes_racines,
      points_positifs: payload.points_positifs,
      points_amelioration: payload.points_amelioration,
      actions_correctives: payload.actions_correctives,
      valide_par: payload.valide_par || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = existing
      ? await supabase.from("incident_retex").update(body).eq("id", existing)
      : await supabase.from("incident_retex").insert(body);
    if (error) {
      toast({ title: "Erreur enregistrement du RETEX", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "RETEX enregistré", description: "La clôture de la crise est désormais possible." });
    await load();
    return true;
  };

  return {
    loading,
    entries,
    actions,
    plansLies,
    communications,
    retex,
    reload: load,
    addEntry,
    addAction,
    setActionStatut,
    addPlan,
    removePlan,
    addCommunication,
    setCommunicationStatut,
    saveRetex,
  };
};
