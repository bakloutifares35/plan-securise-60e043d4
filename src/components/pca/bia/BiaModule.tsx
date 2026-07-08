import { useState, useEffect } from "react";
import { LayoutDashboard, ListTree, Grid3x3, GitFork, FileBarChart, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { BiaDashboard } from "./BiaDashboard";
import { ProcessInventory } from "./ProcessInventory";
import { BiaWizard } from "./BiaWizard";
import { MatrixView } from "./MatrixView";
import { DependencyMap } from "./DependencyMap";
import { ConsolidatedReport } from "./ConsolidatedReport";
import { CampaignHistory } from "./CampaignHistory";
// ✅ AJOUT DES IMPORTS MANQUANTS
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Tab = "dashboard" | "inventory" | "matrix" | "deps" | "report" | "history";

// ✅ MODIFIÉ : Suppression des onglets "wizard" et "resources"
const TABS: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { id: "inventory", label: "BIA", icon: ListTree }, // ✅ RENOMMÉ
  { id: "matrix", label: "Vue matricielle", icon: Grid3x3 },
  { id: "deps", label: "Carte des dépendances", icon: GitFork },
  { id: "report", label: "Rapport consolidé", icon: FileBarChart },
  { id: "history", label: "Historique campagnes", icon: History },
];

export const BiaModule = ({ initialTab = "dashboard" }: { initialTab?: string }) => {
  const [tab, setTab] = useState<Tab>(initialTab as Tab);
  const [editId, setEditId] = useState<string | undefined>();
  const [showWizard, setShowWizard] = useState(false);

  // Synchroniser l'onglet initial
  useEffect(() => {
    if (initialTab && initialTab !== tab) {
      setTab(initialTab as Tab);
    }
  }, [initialTab]);

  // ✅ Ouvre le wizard en tant que Dialog
  const openWizard = (id?: string) => {
    setEditId(id);
    setShowWizard(true);
  };

  const closeWizard = () => {
    setShowWizard(false);
    setEditId(undefined);
  };

  // ✅ Gestion du wizard en Dialog
  if (showWizard) {
    return (
      <Dialog open={showWizard} onOpenChange={closeWizard}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              {editId ? "Modifier l'analyse d'impact" : "Nouvelle analyse d'impact métier"}
            </DialogTitle>
          </DialogHeader>
          <BiaWizard 
            processId={editId} 
            onDone={() => {
              closeWizard();
              // Reste sur l'onglet actuel (inventory par défaut)
              setTab("inventory");
            }} 
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="space-y-6">
      {/* ✅ Barre de navigation avec les onglets mis à jour */}
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

      {/* Contenu des onglets */}
      {tab === "dashboard" && <BiaDashboard />}
      {tab === "inventory" && (
        <ProcessInventory 
          onEdit={(id) => openWizard(id)} 
          onCreate={() => openWizard()} 
        />
      )}
      {tab === "matrix" && <MatrixView />}
      {tab === "deps" && <DependencyMap />}
      {tab === "report" && <ConsolidatedReport />}
      {tab === "history" && <CampaignHistory />}
    </div>
  );
};