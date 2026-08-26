// src/components/plans/PlansModule.tsx — Module M5 « Gestion des Plans »
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ListChecks, ShieldCheck, Database } from "lucide-react";
import { usePlans } from "./usePlans";
import { PlanLibrary } from "./PlanLibrary";
import { PlanEditor } from "./PlanEditor";
import { CoverageDashboard } from "./CoverageDashboard";

export const PlansModule = () => {
  const data = usePlans();
  const [openPlanId, setOpenPlanId] = useState<string | null>(null);

  if (data.loading) {
    return (
      <div className="py-24 text-center text-[#172030]/40">
        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
        <p className="mt-2 text-sm">Chargement des plans…</p>
      </div>
    );
  }

  if (!data.schemaReady) {
    return (
      <Card className="border border-amber-200 bg-amber-50/60 rounded-xl">
        <CardContent className="p-8 text-center space-y-2">
          <Database className="h-8 w-8 mx-auto text-amber-600" />
          <p className="text-lg text-[#172030]" style={{ fontFamily: "Playfair Display, serif" }}>
            Schéma des plans non installé
          </p>
          <p className="text-sm text-[#172030]/60 max-w-lg mx-auto">
            Exécutez le script <code className="bg-white px-1.5 py-0.5 rounded border border-amber-200">
            supabase/manual/2026-08-05_module_plans_m5.sql</code> dans l'éditeur SQL de votre base,
            puis rechargez cette page.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl text-[#172030]" style={{ fontFamily: "Playfair Display, serif" }}>
          Gestion des Plans
        </h1>
        <p className="text-sm text-[#172030]/50 mt-1">
          Rédaction, validation et suivi des plans de continuité, de reprise, de crise et de communication.
        </p>
      </div>

      {openPlanId ? (
        <PlanEditor planId={openPlanId} data={data} onBack={() => setOpenPlanId(null)} />
      ) : (
        <Tabs defaultValue="bibliotheque">
          <TabsList className="bg-[#F1EFE8]">
            <TabsTrigger value="bibliotheque" className="gap-1.5">
              <ListChecks className="h-4 w-4" /> Bibliothèque
            </TabsTrigger>
            <TabsTrigger value="couverture" className="gap-1.5">
              <ShieldCheck className="h-4 w-4" /> Couverture
            </TabsTrigger>
          </TabsList>
          <TabsContent value="bibliotheque" className="mt-5">
            <PlanLibrary data={data} onOpen={setOpenPlanId} />
          </TabsContent>
          <TabsContent value="couverture" className="mt-5">
            <CoverageDashboard data={data} onOpen={setOpenPlanId} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default PlansModule;