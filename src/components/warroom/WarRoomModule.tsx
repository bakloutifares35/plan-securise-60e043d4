// src/components/warroom/WarRoomModule.tsx — Module racine War Room
import { useEffect, useMemo, useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WarRoomDashboard } from "./WarRoomDashboard";
import { WarRoomView } from "./WarRoomView";
import { IncidentTimeline } from "./IncidentTimeline";
import { IncidentDeclarationForm } from "./IncidentDeclarationForm";
import { RetexForm } from "./RetexForm";
import { useWarRoom, useIncidentDetail } from "./useWarRoom";
import { RESILLIA } from "./types";

type View = "dashboard" | "warroom" | "timeline";

export const WarRoomModule = () => {
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

  const detail = useIncidentDetail(currentIncidentId);

  const currentIncident = useMemo(
    () => incidents.find((i) => i.id === currentIncidentId) || null,
    [incidents, currentIncidentId]
  );

  const processCount = useMemo(() => {
    if (!currentIncidentId) return 0;
    return incidentProcessus.filter((ip) => ip.incident_id === currentIncidentId).length;
  }, [incidentProcessus, currentIncidentId]);

  // Si on ouvre un incident clôturé, on reste sur warroom (vue lecture seule)
  useEffect(() => {
    if (!currentIncident && view !== "dashboard") setView("dashboard");
  }, [currentIncident, view]);

  // ============================================================
  // Écran : schéma SQL manquant
  // ============================================================
  if (!schemaReady) {
    return (
      <Card style={{ backgroundColor: RESILLIA.cream, borderColor: RESILLIA.border }}>
        <CardContent className="p-8 text-center">
          <AlertTriangle className="h-10 w-10 mx-auto mb-3" style={{ color: RESILLIA.urgence }} />
          <p className="font-medium" style={{ color: RESILLIA.navy }}>
            Schéma War Room introuvable
          </p>
          <p className="text-sm mt-2" style={{ color: RESILLIA.navy + "80" }}>
            Le script SQL n'a pas encore été exécuté dans votre base Supabase.
            Ouvrez <code>supabase/manual/2026-09-16_module_warroom.sql</code> et exécutez-le dans
            l'éditeur SQL de Supabase, puis rechargez cette page.
          </p>
        </CardContent>
      </Card>
    );
  }

  // ============================================================
  // Écran : chargement initial
  // ============================================================
  if (loading && incidents.length === 0) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: RESILLIA.forest }} />
      </div>
    );
  }

  // ============================================================
  // Handler : déclaration d'incident
  // ============================================================
  const handleSubmitIncident = async (payload: any, processusIds: string[]) => {
    const id = await createIncident(payload, processusIds);
    if (id) {
      setCurrentIncidentId(id);
      setView("warroom");
    }
    return id;
  };

  // ============================================================
  // Rendu
  // ============================================================
  return (
    <>
      {view === "dashboard" && (
        <WarRoomDashboard
          incidents={incidents}
          processus={processus}
          incidentProcessus={incidentProcessus}
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
          retex={detail.retex}
          plansModuleAvailable={plansModuleAvailable}
          plans={plans}
          processCount={processCount}
          currentUser={undefined /* à brancher sur ton contexte user plus tard */}
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
          reload={async () => {
            await reload();
            await detail.reload();
          }}
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
        />
      )}
    </>
  );
};

export default WarRoomModule;