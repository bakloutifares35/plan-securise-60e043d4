// src/components/warroom/WarRoomModule.tsx — Module racine War Room
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/db";
import { WarRoomDashboard } from "./WarRoomDashboard";
import { WarRoomView } from "./WarRoomView";
import { IncidentTimeline } from "./IncidentTimeline";
import { IncidentDeclarationForm } from "./IncidentDeclarationForm";
import { RetexForm } from "./RetexForm";
import { useWarRoom, useIncidentDetail } from "./useWarRoom";
import { COLORS } from "./warroomHelpers";

type View = "dashboard" | "warroom" | "timeline";

// ============================================================
// HOOK : Chargement des membres de la cellule de crise
// ============================================================
const useCellMembers = (incidentId: string | null) => {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!incidentId) {
      setMembers([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("incident_membres_cellule")
      .select("*")
      .eq("incident_id", incidentId)
      .order("heure_activation", { ascending: true });
    if (!error && data) {
      setMembers(data);
    } else if (error) {
      console.warn("Erreur chargement membres cellule:", error.message);
    }
    setLoading(false);
  }, [incidentId]);

  useEffect(() => {
    load();
  }, [load]);

  return { members, loading, reload: load };
};

// ============================================================
// MODULE PRINCIPAL
// ============================================================
export const WarRoomModule = () => {
  // ⚠️ TOUS LES HOOKS DOIVENT ÊTRE APPELÉS AVANT LES RETURNS CONDITIONNELS

  const {
    loading,
    schemaReady,
    incidents,
    processus,
    plans,
    plansModuleAvailable,
    incidentProcessus,
    reload,
    createIncident,
    updateIncident,
  } = useWarRoom();

  const [view, setView] = useState<View>("dashboard");
  const [currentIncidentId, setCurrentIncidentId] = useState<string | null>(null);
  const [declarationOpen, setDeclarationOpen] = useState(false);
  const [retexOpen, setRetexOpen] = useState(false);
  const [allActions, setAllActions] = useState<any[]>([]);

  const detail = useIncidentDetail(currentIncidentId);
  const cell = useCellMembers(currentIncidentId);

  const currentIncident = useMemo(
    () => incidents.find((i) => i.id === currentIncidentId) || null,
    [incidents, currentIncidentId]
  );

  const impactedProcessus = useMemo(() => {
    if (!currentIncidentId) return [];
    const ids = incidentProcessus
      .filter((ip) => ip.incident_id === currentIncidentId)
      .map((ip) => ip.processus_id);
    return processus
      .filter((p) => ids.includes(p.id))
      .map((p: any) => ({
        nom: p.name,
        criticite: p.criticite ?? null,
        rto: p.rto ?? null,
      }));
  }, [incidentProcessus, currentIncidentId, processus]);

  const processCount = useMemo(() => {
    if (!currentIncidentId) return 0;
    return incidentProcessus.filter((ip) => ip.incident_id === currentIncidentId).length;
  }, [incidentProcessus, currentIncidentId]);

  // ✅ useCallback DOIT être ici, AVANT tout return conditionnel
  const refresh = useCallback(async () => {
    await reload();
    if (currentIncidentId) {
      await detail.reload();
      await cell.reload();
    }
  }, [reload, detail, cell, currentIncidentId]);

  // ✅ useEffect DOIT être ici aussi, AVANT tout return conditionnel
  useEffect(() => {
    const loadAllActions = async () => {
      const activeIds = incidents.filter((i) => i.statut !== "Clôturé").map((i) => i.id);
      if (activeIds.length === 0) {
        setAllActions([]);
        return;
      }
      const { data } = await supabase
        .from("incident_actions")
        .select("id, incident_id, description, statut")
        .in("incident_id", activeIds);
      setAllActions(data || []);
    };
    if (incidents.length > 0) loadAllActions();
  }, [incidents]);

  useEffect(() => {
    if (!currentIncident && view !== "dashboard") setView("dashboard");
  }, [currentIncident, view]);

  // ============================================================
  // À PARTIR D'ICI : les returns conditionnels sont OK
  // (parce que plus AUCUN hook n'est appelé après)
  // ============================================================

  // ===== Schéma manquant =====
  if (!schemaReady) {
    return (
      <div className="p-8 text-center rounded-xl" style={{ backgroundColor: COLORS.cream }}>
        <p className="font-medium" style={{ color: COLORS.navy }}>
          Schéma War Room introuvable
        </p>
        <p className="text-sm mt-2" style={{ color: COLORS.navy + "80" }}>
          Exécutez le script SQL <code>2026-09-16_module_warroom.sql</code> dans Supabase, puis rechargez.
        </p>
      </div>
    );
  }

  // ===== Chargement =====
  if (loading && incidents.length === 0) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: COLORS.forest }} />
      </div>
    );
  }

  // ===== Handler déclaration (avec cellMembers) =====
  const handleSubmitIncident = async (
    payload: any,
    processusIds: string[],
    cellMembers: any[]
  ) => {
    const id = await createIncident(payload, processusIds);
    if (id && cellMembers.length > 0) {
      const membersPayload = cellMembers.map((m) => ({
        incident_id: id,
        nom: m.nom,
        role: m.role,
        telephone: m.telephone || null,
        email: m.email || null,
      }));
      const { error } = await supabase.from("incident_membres_cellule").insert(membersPayload);
      if (error) {
        console.warn("Erreur insertion membres cellule:", error.message);
        toast({
          title: "Incident créé",
          description: "Mais les membres de la cellule n'ont pas pu être enregistrés.",
          variant: "destructive",
        });
      }
    }
    if (id) {
      setCurrentIncidentId(id);
      setView("warroom");
    }
    return id;
  };

  const handleRetexSaved = async () => {
    setRetexOpen(false);
    await reload();
    await detail.reload();
  };

  return (
    <>
      {view === "dashboard" && (
        <WarRoomDashboard
          incidents={incidents}
          incidentProcessus={incidentProcessus}
          actions={allActions}
          onOpenIncident={(id) => {
            setCurrentIncidentId(id);
            setView("warroom");
          }}
          onDeclare={() => setDeclarationOpen(true)}
        />
      )}

      {view === "warroom" && currentIncident && (
        <WarRoomView
          incident={currentIncident}
          entries={detail.entries}
          actions={detail.actions}
          plansLies={detail.plansLies}
          communications={detail.communications}
          cellMembers={cell.members}
          retex={detail.retex}
          plansModuleAvailable={plansModuleAvailable}
          plans={plans}
          processCount={processCount}
          currentUser={undefined}
          onBack={() => {
            setView("dashboard");
            setCurrentIncidentId(null);
          }}
          onOpenRetex={() => setRetexOpen(true)}
          onOpenTimeline={() => setView("timeline")}
          addEntry={detail.addEntry}
          addAction={detail.addAction}
          setActionStatut={detail.setActionStatut}
          addPlan={detail.addPlan}
          removePlan={detail.removePlan}
          addCommunication={detail.addCommunication}
          setCommunicationStatut={detail.setCommunicationStatut}
          updateIncident={updateIncident}
          reload={refresh}
        />
      )}

      {view === "timeline" && currentIncident && (
        <IncidentTimeline
          incident={currentIncident}
          entries={detail.entries}
          actions={detail.actions}
          communications={detail.communications}
          plansLies={detail.plansLies}
          onBack={() => setView("warroom")}
        />
      )}

      <IncidentDeclarationForm
        open={declarationOpen}
        onOpenChange={setDeclarationOpen}
        processus={processus}
        onSubmit={handleSubmitIncident}
      />

      {currentIncident && (
        <RetexForm
          open={retexOpen}
          onOpenChange={setRetexOpen}
          incidentId={currentIncident.id}
          retex={detail.retex}
          onSave={detail.saveRetex}
          onSaved={handleRetexSaved}
        />
      )}
    </>
  );
};

export default WarRoomModule;