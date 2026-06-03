import { useState } from "react";
import { Network, Calendar, FileSignature, Users, Settings, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { OrgChart } from "./OrgChart";
import { EntityProfile } from "./EntityProfile";
import { AnnualCalendar } from "./AnnualCalendar";
import { PolicyEditor } from "./PolicyEditor";
import { SteeringCommittee } from "./SteeringCommittee";
import { References } from "./References";

type Tab = "orgchart" | "entity" | "calendar" | "policy" | "committee" | "references";

const TABS: { id: Tab; label: string; icon: typeof Network }[] = [
  { id: "orgchart", label: "Organigramme", icon: Network },
  { id: "calendar", label: "Calendrier annuel", icon: Calendar },
  { id: "policy", label: "Politique PCA", icon: FileSignature },
  { id: "committee", label: "Comité de pilotage", icon: Users },
  { id: "references", label: "Référentiels & rôles", icon: Settings },
];

export const GovernanceModule = () => {
  const [tab, setTab] = useState<Tab>("orgchart");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1.5 border-b border-border pb-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id || (t.id === "orgchart" && tab === "entity");
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

      {tab === "orgchart" && <OrgChart {...({ onNavigate: (s: string) => { if (s === "entity") setTab("entity"); } } as any)} />}
      {tab === "entity" && <EntityProfile onBack={() => setTab("orgchart")} />}
      {tab === "calendar" && <AnnualCalendar />}
      {tab === "policy" && <PolicyEditor />}
      {tab === "committee" && <SteeringCommittee />}
      {tab === "references" && <References />}
    </div>
  );
};
