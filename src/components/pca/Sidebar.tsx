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
  ChevronDown,
  ChevronRight,
  Database,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RoleSwitcher } from "./RoleSwitcher";
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

export type Section =
  | "dashboard" 
  | "form" 
  | "plan" 
  | "benchmark"
  | "governance" 
  | "entity"
  | "bia" 
  | "bia-synthese"
  | "bia-recovery"
  | "cmdb"
  | "risk" 
  | "ai" 
  | "tenacia"
  | "exercices"
  | "ressources"
  | "rapports"
  | "scenarios"
  | "strategies";

const groups: { label: string; items: { id: Section; label: string; icon: typeof LayoutDashboard; subItems?: { id: Section; label: string }[] }[] }[] = [
  {
    label: "Vue d'ensemble",
    items: [
      { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
      { id: "governance", label: "Gouvernance PCA", icon: Building2 },
      { 
        id: "bia", 
        label: "Processus & BIA", 
        icon: ClipboardList,
        subItems: [
          { id: "bia", label: "Tableau de bord BIA" },
          { id: "bia-synthese", label: "Synthèse BIA" },
          { id: "bia-recovery", label: "Séquence de reprise" },
        ]
      },
      { id: "cmdb", label: "Référentiel des ressources", icon: Database },
      { id: "risk", label: "Risques", icon: AlertTriangle },
      { id: "scenarios", label: "Scénarios", icon: GitBranch },
      { id: "strategies", label: "Stratégies de continuité", icon: Layers },
      { id: "plan", label: "Gestion des plans", icon: ListChecks },
      { id: "exercices", label: "Exercices PCA", icon: PlayCircle },
      { id: "ressources", label: "Ressources", icon: Users },
      { id: "rapports", label: "Rapports", icon: FileBarChart },
    ],
  },
  {
    label: "Planifier",
    items: [
      { id: "strategies", label: "Stratégies de continuité", icon: Layers },
      { id: "plan", label: "Gestion des plans", icon: ListChecks },
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
  const navigate = useNavigate();
  const location = useLocation();
  const [expandedItems, setExpandedItems] = useState<string[]>(['bia']);

  const getActiveFromPath = (path: string): Section => {
    if (path === "/" || path === "/dashboard") return "dashboard";
    if (path === "/bia") return "bia";
    if (path === "/bia/synthese") return "bia-synthese";
    if (path === "/bia/recovery") return "bia-recovery";
    if (path === "/cmdb") return "cmdb";
    if (path === "/tenacia-voice") return "tenacia";
    if (path === "/governance") return "governance";
    if (path === "/risk") return "risk";
    if (path === "/plan") return "plan";
    if (path === "/benchmark") return "benchmark";
    if (path === "/exercices") return "exercices";
    if (path === "/ressources") return "ressources";
    if (path === "/rapports") return "rapports";
    if (path === "/scenarios") return "scenarios";
    if (path === "/strategies") return "strategies";
    if (path === "/form") return "form";
    if (path === "/ai") return "ai";
    return "dashboard";
  };

  useEffect(() => {
    const path = location.pathname;
    const newActive = getActiveFromPath(path);
    if (newActive !== active) {
      onChange(newActive);
    }
  }, [location.pathname]);

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  const handleItemClick = (item: any) => {
    if (item.subItems) {
      toggleExpand(item.id);
    } else {
      switch(item.id) {
        case 'dashboard':
          navigate('/');
          break;
        case 'bia':
          navigate('/bia');
          break;
        case 'bia-synthese':
          navigate('/bia/synthese');
          break;
        case 'bia-recovery':
          navigate('/bia/recovery');
          break;
        case 'cmdb':
          navigate('/cmdb');
          break;
        case 'tenacia':
          navigate('/tenacia-voice');
          break;
        case 'strategies':
          navigate('/strategies');
          break;
        default:
          navigate(`/${item.id}`);
      }
    }
  };

  const handleSubItemClick = (parentId: string, subItem: any) => {
    if (subItem.id === 'bia-synthese') {
      navigate('/bia/synthese');
    } else if (subItem.id === 'bia') {
      navigate('/bia');
    } else if (subItem.id === 'bia-recovery') {
      navigate('/bia/recovery');
    }
  };

  const isItemActive = (item: any): boolean => {
    const path = location.pathname;
    
    if (item.subItems) {
      return item.subItems.some((sub: any) => {
        if (sub.id === 'bia-synthese' && path === '/bia/synthese') return true;
        if (sub.id === 'bia-recovery' && path === '/bia/recovery') return true;
        if (sub.id === 'bia' && path === '/bia') return true;
        return false;
      });
    }
    
    switch(item.id) {
      case 'dashboard':
        return path === '/' || path === '/dashboard';
      case 'bia':
        return path === '/bia';
      case 'bia-synthese':
        return path === '/bia/synthese';
      case 'bia-recovery':
        return path === '/bia/recovery';
      case 'cmdb':
        return path === '/cmdb';
      case 'tenacia':
        return path === '/tenacia-voice';
      case 'strategies':
        return path === '/strategies';
      default:
        return path === `/${item.id}`;
    }
  };

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
                const hasSubItems = it.subItems && it.subItems.length > 0;
                const isExpanded = expandedItems.includes(it.id);
                const itemActive = isItemActive(it);

                return (
                  <div key={it.id}>
                    <button
                      onClick={() => handleItemClick(it)}
                      className={cn(
                        "w-full flex items-center gap-3 pl-3 pr-3 py-2 rounded-r-md transition-colors text-left"
                      )}
                      style={{
                        fontFamily: "'Inter', sans-serif",
                        fontSize: "12px",
                        fontWeight: 500,
                        color: itemActive ? "#F8F6F2" : "rgba(248,246,242,0.6)",
                        backgroundColor: itemActive ? "#2A5141" : "transparent",
                        borderLeft: itemActive ? "2px solid #2A5141" : "2px solid transparent",
                      }}
                      onMouseEnter={(e) => {
                        if (!itemActive) (e.currentTarget as HTMLButtonElement).style.color = "#F8F6F2";
                      }}
                      onMouseLeave={(e) => {
                        if (!itemActive) (e.currentTarget as HTMLButtonElement).style.color = "rgba(248,246,242,0.6)";
                      }}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1">{it.label}</span>
                      {hasSubItems && (
                        <span className="ml-auto">
                          {isExpanded ? 
                            <ChevronDown className="h-3 w-3" /> : 
                            <ChevronRight className="h-3 w-3" />
                          }
                        </span>
                      )}
                      {it.id === "tenacia" && !itemActive && (
                        <span
                          className="text-[9px] px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: "rgba(42,81,65,0.4)", color: "#E4F2E8", letterSpacing: "0.06em" }}
                        >
                          NEW
                        </span>
                      )}
                    </button>

                    {hasSubItems && isExpanded && (
                      <div className="ml-6 mt-0.5 space-y-0.5">
                        {it.subItems?.map((sub) => {
                          const subActive = isItemActive({ id: sub.id });
                          
                          return (
                            <button
                              key={sub.id}
                              onClick={() => handleSubItemClick(it.id, sub)}
                              className={cn(
                                "w-full flex items-center gap-3 pl-3 pr-3 py-1.5 rounded-r-md transition-colors text-left"
                              )}
                              style={{
                                fontFamily: "'Inter', sans-serif",
                                fontSize: "11px",
                                fontWeight: 400,
                                color: subActive ? "#F8F6F2" : "rgba(248,246,242,0.5)",
                                backgroundColor: subActive ? "rgba(42,81,65,0.3)" : "transparent",
                                borderLeft: subActive ? "2px solid #2A5141" : "2px solid transparent",
                              }}
                            >
                              <span className="pl-2">• {sub.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
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