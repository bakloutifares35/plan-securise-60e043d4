import { 
  LayoutDashboard, 
  FileText, 
  ListChecks, 
  BarChart3, 
  ShieldCheck, 
  Activity, 
  Building2, 
  AlertOctagon, 
  Sparkles, 
  Mic,
  GitBranch,
  Users,
  Calendar,
  FileBarChart,
  ClipboardList,
  PlayCircle,
  TrendingUp,
  PieChart,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RoleSwitcher } from "./RoleSwitcher";

export type Section =
  | "dashboard" 
  | "form" 
  | "plan" 
  | "benchmark"
  | "governance" 
  | "entity"
  | "bia" 
  | "risk" 
  | "ai" 
  | "tenacia"
  | "exercices"
  | "ressources"
  | "rapports"
  | "scenarios";

// ===== STRUCTURE COMME VIGILIA AVEC GOUVERNANCE, BENCHMARK ET TENACIA =====
const groups: { label: string; items: { id: Section; label: string; icon: typeof LayoutDashboard }[] }[] = [
  {
    label: "Vue d'ensemble",
    items: [
      { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
      { id: "governance", label: "Gouvernance PCA", icon: Building2 },
      { id: "bia", label: "Processus & BIA", icon: ClipboardList },
      { id: "risk", label: "Risques", icon: AlertTriangle },
      { id: "scenarios", label: "Scénarios", icon: GitBranch },
      { id: "plan", label: "Plans de continuité", icon: ListChecks },
      { id: "exercices", label: "Exercices PCA", icon: PlayCircle },
      { id: "ressources", label: "Ressources", icon: Users },
      { id: "rapports", label: "Rapports", icon: FileBarChart },
    ],
  },
  {
    label: "Planifier",
    items: [
      { id: "plan", label: "Plans de continuité", icon: ListChecks },
      { id: "exercices", label: "Exercices PCA", icon: PlayCircle },
    ],
  },
  {
    label: "Référentiels",
    items: [
      { id: "benchmark", label: "Benchmark", icon: BarChart3 },
      { id: "ressources", label: "Ressources", icon: Users },
    ],
  },
  {
    label: "Piloter",
    items: [
      { id: "rapports", label: "Rapports", icon: FileBarChart },
    ],
  },
  {
    label: "Innovation",
    items: [
      { id: "tenacia", label: "Tenacia Voice AI", icon: Mic },
    ],
  },
];

export const Sidebar = ({ active, onChange }: { active: Section; onChange: (s: Section) => void }) => {
  return (
    <aside
      className="hidden md:flex w-64 shrink-0 flex-col"
      style={{ backgroundColor: "#172030", color: "#F8F6F2" }}
    >
      <div
        className="flex items-center gap-3 px-6 py-6"
        style={{ borderBottom: "1px solid rgba(248,246,242,0.08)" }}
      >
        <div
          className="flex h-9 w-9 items-center justify-center rounded-md"
          style={{ backgroundColor: "#2A5141" }}
        >
          <ShieldCheck className="h-5 w-5" style={{ color: "#F8F6F2" }} />
        </div>
        <div>
          <p
            className="text-xl leading-none"
            style={{ fontFamily: "'Playfair Display', serif", fontWeight: 500, color: "#F8F6F2" }}
          >
            Resillia
          </p>
          <p className="text-[10px] mt-1" style={{ color: "rgba(248,246,242,0.55)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Continuité d'activité
          </p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {groups.map((g) => (
          <div key={g.label}>
            <p
              className="px-3 mb-2"
              style={{
                fontSize: "9px",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "rgba(248,246,242,0.35)",
                fontWeight: 600,
              }}
            >
              {g.label}
            </p>
            <div className="space-y-0.5">
              {g.items.map((it) => {
                const Icon = it.icon;
                const isActive = active === it.id;
                return (
                  <button
                    key={it.id}
                    onClick={() => onChange(it.id)}
                    className={cn(
                      "w-full flex items-center gap-3 pl-3 pr-3 py-2 rounded-r-md transition-colors text-left"
                    )}
                    style={{
                      fontFamily: "'Inter', sans-serif",
                      fontSize: "12px",
                      fontWeight: 500,
                      color: isActive ? "#F8F6F2" : "rgba(248,246,242,0.6)",
                      backgroundColor: isActive ? "#2A5141" : "transparent",
                      borderLeft: isActive ? "2px solid #2A5141" : "2px solid transparent",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = "#F8F6F2";
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = "rgba(248,246,242,0.6)";
                    }}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="flex-1">{it.label}</span>
                    {it.id === "tenacia" && !isActive && (
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: "rgba(42,81,65,0.4)", color: "#E4F2E8", letterSpacing: "0.06em" }}
                      >
                        NEW
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div style={{ borderTop: "1px solid rgba(248,246,242,0.08)" }}>
        <RoleSwitcher />
      </div>
      <div
        className="px-4 py-3 text-center"
        style={{
          fontSize: "10px",
          color: "rgba(248,246,242,0.4)",
          borderTop: "1px solid rgba(248,246,242,0.08)",
          letterSpacing: "0.06em",
        }}
      >
        © 2026 Resillia
      </div>
    </aside>
  );
};