import { useState, useEffect } from "react";
import { LayoutDashboard, ListTree, FilePlus2, Grid3x3, GitFork, FileBarChart, History, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { BiaDashboard } from "./BiaDashboard";
import { ProcessInventory } from "./ProcessInventory";
import { BiaWizard } from "./BiaWizard";
import { MatrixView } from "./MatrixView";
import { DependencyMap } from "./DependencyMap";
import { ConsolidatedReport } from "./ConsolidatedReport";
import { CampaignHistory } from "./CampaignHistory";
import { DirectionResources } from "./DirectionResources";

type Tab = "dashboard" | "inventory" | "wizard" | "resources" | "matrix" | "deps" | "report" | "history";

const TABS: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { id: "inventory", label: "Inventaire des processus", icon: ListTree },
  { id: "wizard", label: "Formulaire BIA", icon: FilePlus2 },
  { id: "resources", label: "Ressources critiques", icon: Users },
  { id: "matrix", label: "Vue matricielle", icon: Grid3x3 },
  { id: "deps", label: "Carte des dépendances", icon: GitFork },
  { id: "report", label: "Rapport consolidé", icon: FileBarChart },
  { id: "history", label: "Historique campagnes", icon: History },
];

export const BiaModule = ({ initialTab = "dashboard" }: { initialTab?: string }) => {
  const [tab, setTab] = useState<Tab>(initialTab as Tab);
  const [editId, setEditId] = useState<string | undefined>();

  // Synchroniser l'onglet initial
  useEffect(() => {
    if (initialTab && initialTab !== tab) {
      setTab(initialTab as Tab);
    }
  }, [initialTab]);

  const openWizard = (id?: string) => {
    setEditId(id);
    setTab("wizard");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1.5 border-b border-border pb-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); if (t.id !== "wizard") setEditId(undefined); }}
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

      {tab === "dashboard" && <BiaDashboard />}
      {tab === "inventory" && <ProcessInventory onEdit={(id) => openWizard(id)} onCreate={() => openWizard()} />}
      {tab === "wizard" && <BiaWizard processId={editId} onDone={() => { setEditId(undefined); setTab("inventory"); }} />}
      {tab === "resources" && <DirectionResources />}
      {tab === "matrix" && <MatrixView />}
      {tab === "deps" && <DependencyMap />}
      {tab === "report" && <ConsolidatedReport />}
      {tab === "history" && <CampaignHistory />}
    </div>
  );
};