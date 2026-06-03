import { useState } from "react";
import { BookOpen, Link2, Scale } from "lucide-react";
import { cn } from "@/lib/utils";
import { StrategyCatalog } from "./StrategyCatalog";
import { StrategyAssociations } from "./StrategyAssociations";
import { StrategyCostBenefit } from "./StrategyCostBenefit";

type Tab = "catalog" | "associations" | "costbenefit";

const TABS: { id: Tab; label: string; icon: typeof BookOpen }[] = [
  { id: "catalog", label: "Catalogue de stratégies", icon: BookOpen },
  { id: "associations", label: "Association processus/stratégie", icon: Link2 },
  { id: "costbenefit", label: "Analyse coût-bénéfice", icon: Scale },
];

export const StrategyModule = () => {
  const [tab, setTab] = useState<Tab>("catalog");
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

      {tab === "catalog" && <StrategyCatalog />}
      {tab === "associations" && <StrategyAssociations />}
      {tab === "costbenefit" && <StrategyCostBenefit />}
    </div>
  );
};
