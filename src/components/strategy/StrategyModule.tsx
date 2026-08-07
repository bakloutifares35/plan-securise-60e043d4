// src/components/strategy/StrategyModule.tsx
import { useMemo, useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { BookOpen, Link2, Layers, CheckCircle2, AlertTriangle, FileWarning } from "lucide-react";
import { toast } from "@/hooks/use-toast";
// 🔥 IMPORT SUPABASE DIRECT ICI
import { supabase } from "@/integrations/resillia/client";
import { useStrategyData } from "./useStrategyData";
import { CatalogueTab } from "./tabs/CatalogueTab";
import { AssociationTab } from "./tabs/AssociationTab";

type Tab = "catalogue" | "association";

const TABS: { id: Tab; label: string; icon: typeof BookOpen }[] = [
  { id: "catalogue", label: "Catalogue", icon: BookOpen },
  { id: "association", label: "Association", icon: Link2 },
];

export const StrategyModule = () => {
  const [tab, setTab] = useState<Tab>("catalogue");
  
  const strategyData = useStrategyData(); 

  // 🔥 CHARGEMENT DIRECT DES DONNÉES DU MODULE RISQUES
  const [actionPlans, setActionPlans] = useState<any[]>([]);
  const [risques, setRisques] = useState<any[]>([]);
  const [loadingRiskData, setLoadingRiskData] = useState(true);

  useEffect(() => {
    const loadRiskData = async () => {
      setLoadingRiskData(true);
      try {
        // On charge les actions du plan de traitement
        const { data: actionData, error: actionError } = await supabase
          .from("plans_traitement")
          .select("id, risque_id, mesure, statut, avancement, responsable");
        
        if (actionError) {
          toast({ title: "Erreur chargement actions", description: actionError.message, variant: "destructive" });
        } else {
          setActionPlans(actionData || []);
        }

        // On charge les risques pour avoir leurs noms
        const { data: riskData, error: riskError } = await supabase
          .from("risques")
          .select("id, title, niveau");
        
        if (riskError) {
          toast({ title: "Erreur chargement risques", description: riskError.message, variant: "destructive" });
        } else {
          setRisques(riskData || []);
        }
      } catch (err: any) {
        console.error("Erreur chargement global risque:", err);
      } finally {
        setLoadingRiskData(false);
      }
    };
    loadRiskData();
  }, []);

  // On fusionne les données dans un seul objet data
  const data = {
    ...strategyData,
    actionPlans: actionPlans,
    loadingActions: loadingRiskData,
    risques: risques,
  };

  // 🔥 RECALCUL DES KPIS
  const stats = useMemo(() => {
    const retenues = strategyData.associations.filter((a: any) => a.statut === "Retenue");
    const linkedProcessIds = new Set(strategyData.associations.map(a => a.processus_id));
    const sansStrategie = strategyData.processus.filter(p => !linkedProcessIds.has(p.id)).length;
    const tiersSansSla = strategyData.associations.filter(
      (a: any) => a.tiers_critique === true && (!a.sla_reference || a.sla_reference.trim() === '')
    ).length;

    return { 
      total: strategyData.catalogue.length, 
      retenues: retenues.length, 
      sansStrategie: sansStrategie, 
      tiersSansSla: tiersSansSla 
    };
  }, [strategyData.catalogue, strategyData.associations, strategyData.processus]);

  const kpis = [
    { label: "Total stratégies", value: stats.total, icon: Layers, bg: "#F1EFEA", color: "#172030" },
    { label: "Retenues", value: stats.retenues, icon: CheckCircle2, bg: "#E8F0EC", color: "#2A5141" },
    { label: "Processus sans stratégie", value: stats.sansStrategie, icon: AlertTriangle, bg: "#FCE9E9", color: "#B91C1C" },
    { label: "Tiers sans SLA", value: stats.tiersSansSla, icon: FileWarning, bg: "#FBF3D9", color: "#A16207" },
  ];

  return (
    <div className="max-w-[1440px] mx-auto space-y-6 font-sans">
      <Card className="border-0 shadow-sm bg-white rounded-xl">
        <CardContent className="p-6">
          <div className="mb-6">
            <h2 className="font-serif text-2xl font-bold tracking-tight text-[#172030]">Stratégies de continuité</h2>
            <p className="text-sm text-[#172030]/60 mt-1">
              Définissez, pour chaque processus critique et chaque scénario de crise, la stratégie de réponse
              permettant de tenir les délais du BIA.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {kpis.map((k) => {
              const Icon = k.icon;
              return (
                <div key={k.label} className="rounded-xl p-4" style={{ backgroundColor: k.bg }}>
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full"
                      style={{ backgroundColor: "rgba(255,255,255,0.65)" }}
                    >
                      <Icon className="h-3.5 w-3.5" style={{ color: k.color }} />
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#172030]/45">
                      {k.label}
                    </span>
                  </div>
                  <div className="text-3xl font-bold font-serif mt-2" style={{ color: k.color }}>
                    {k.value}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-1.5 border-b border-[#E5E2DD] pb-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                active ? "bg-[#2A5141] text-white" : "text-[#172030]/60 hover:bg-[#F1EFEA] hover:text-[#172030]"
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      <>
        {tab === "catalogue" && <CatalogueTab data={data} />}
        {tab === "association" && <AssociationTab data={data} />}
      </>
    </div>
  );
};

export default StrategyModule;