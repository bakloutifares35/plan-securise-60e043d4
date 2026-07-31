import { useState } from "react";
import { AlertTriangle, BarChart3, Boxes, KanbanSquare, Grid3x3, Loader2, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRiskData } from "./useRiskData";
import { ComexTab } from "./tabs/ComexTab";
import { RegistreTab } from "./tabs/RegistreTab";
import { PlansTab } from "./tabs/PlansTab";
import { MatriceTab } from "./tabs/MatriceTab";
import { ParametresTab } from "./tabs/ParametresTab";
import { ReferentielsTab } from "./tabs/ReferentielsTab";

type Tab = "comex" | "registre" | "plans" | "matrice" | "parametres" | "referentiels";

// ✅ NOUVEL ORDRE : Dashboard COMEX en premier
const TABS: { id: Tab; label: string; icon: typeof BarChart3 }[] = [
  { id: "comex", label: "Dashboard COMEX", icon: BarChart3 },
  { id: "registre", label: "Registre des risques", icon: KanbanSquare },
  { id: "plans", label: "Plans de traitement", icon: BarChart3 },
  { id: "matrice", label: "Matrice", icon: Grid3x3 },
  { id: "parametres", label: "Paramètres", icon: Settings },
  { id: "referentiels", label: "Référentiels", icon: Boxes },
];

export const RiskModule = () => {
  const [tab, setTab] = useState<Tab>("comex"); // ✅ Dashboard COMEX par défaut
  const data = useRiskData();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-3xl text-[#172030]">Analyse des Risques</h1>
        <p className="text-sm text-[#172030]/60 mt-1">
          Démarche ISO 31000 / 27005 : contexte, référentiels, évaluation, traitement et pilotage.
        </p>
      </header>

      <div className="flex flex-wrap gap-1.5 border-b border-[#172030]/10 pb-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-[#2A5141] text-white"
                  : "text-[#172030]/65 hover:bg-[#F8F6F2] hover:text-[#172030]"
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {!data.schemaReady && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-medium">Schéma incomplet</p>
            <p>
              Vérifiez que les tables du module sont bien créées dans Supabase.
            </p>
          </div>
        </div>
      )}

      {data.loading ? (
        <div className="flex items-center gap-2 text-[#172030]/60 py-16 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" /> Chargement des données…
        </div>
      ) : (
        <div className="animate-in fade-in duration-200" key={tab}>
          {tab === "comex" && <ComexTab data={data} />}
          {tab === "registre" && <RegistreTab data={data} />}
          {tab === "plans" && <PlansTab data={data} />}
          {tab === "matrice" && <MatriceTab data={data} />}
          {tab === "parametres" && <ParametresTab data={data} />}
          {tab === "referentiels" && <ReferentielsTab data={data} />}
        </div>
      )}
    </div>
  );
};