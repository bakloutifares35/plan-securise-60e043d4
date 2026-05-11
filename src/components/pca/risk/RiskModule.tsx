import { useState } from "react";
import { LayoutDashboard, BookOpen, FileText, KanbanSquare, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { RiskDashboard } from "./RiskDashboard";
import { ScenarioLibrary } from "./ScenarioLibrary";
import { ScenarioDetail } from "./ScenarioDetail";
import { TreatmentPlan } from "./TreatmentPlan";
import { RiskSettings } from "./RiskSettings";

type Tab = "dashboard" | "library" | "detail" | "plan" | "settings";

const TABS: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { id: "library", label: "Bibliothèque de scénarios", icon: BookOpen },
  { id: "detail", label: "Fiche scénario", icon: FileText },
  { id: "plan", label: "Plan de traitement", icon: KanbanSquare },
  { id: "settings", label: "Paramètres", icon: Settings },
];

export const RiskModule = () => {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [scenarioId, setScenarioId] = useState<string | undefined>();

  const openDetail = (id: string) => { setScenarioId(id); setTab("detail"); };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1.5 border-b border-border pb-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "dashboard" && <RiskDashboard />}
      {tab === "library" && <ScenarioLibrary onOpen={openDetail} />}
      {tab === "detail" && (
        scenarioId
          ? <ScenarioDetail scenarioId={scenarioId} onBack={() => setTab("library")} />
          : <p className="text-sm text-muted-foreground">Sélectionnez un scénario depuis la bibliothèque.</p>
      )}
      {tab === "plan" && <TreatmentPlan />}
      {tab === "settings" && <RiskSettings />}
    </div>
  );
};
