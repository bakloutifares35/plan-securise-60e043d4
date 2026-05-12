import { LayoutDashboard, FileText, ListChecks, BarChart3, ShieldCheck, Activity, Building2, AlertOctagon, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { RoleSwitcher } from "./RoleSwitcher";

export type Section =
  | "dashboard" | "form" | "plan" | "benchmark"
  | "governance" | "entity"
  | "bia" | "risk";

const groups: { label: string; items: { id: Section; label: string; icon: typeof LayoutDashboard }[] }[] = [
  {
    label: "Pilotage",
    items: [
      { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
      { id: "benchmark", label: "Benchmark", icon: BarChart3 },
    ],
  },
  {
    label: "Gouvernance (M1)",
    items: [
      { id: "governance", label: "Gouvernance PCA", icon: Building2 },
    ],
  },
  {
    label: "Opérationnel",
    items: [
      { id: "bia", label: "Business Impact Analysis", icon: Activity },
      { id: "risk", label: "Analyse des Risques", icon: AlertOctagon },
      { id: "form", label: "Identification des risques", icon: FileText },
      { id: "plan", label: "Plan de continuité", icon: ListChecks },
    ],
  },
];

export const Sidebar = ({ active, onChange }: { active: Section; onChange: (s: Section) => void }) => {
  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex items-center gap-2 px-6 py-5 border-b border-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-glow">
          <ShieldCheck className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">PCA Manager</p>
          <p className="text-xs text-muted-foreground">Continuité d'activité</p>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
        {groups.map((g) => (
          <div key={g.label}>
            <p className="px-3 mb-1.5 text-[10px] font-semibold tracking-wider uppercase text-muted-foreground">{g.label}</p>
            <div className="space-y-0.5">
              {g.items.map((it) => {
                const Icon = it.icon;
                const isActive = active === it.id;
                return (
                  <button
                    key={it.id}
                    onClick={() => onChange(it.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {it.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <RoleSwitcher />
      <div className="p-3 border-t border-border text-xs text-muted-foreground text-center">
        © 2026 PCA Manager
      </div>
    </aside>
  );
};
