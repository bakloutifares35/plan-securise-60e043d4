import { 
  LayoutDashboard, 
  ListChecks, 
  BarChart3, 
  ShieldCheck, 
  Building2, 
  AlertOctagon, 
  GitBranch,
  Users,
  ClipboardList,
  PlayCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Database,
  Layers,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useRole } from "@/contexts/RoleContext";

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
  | "strategies"
  | "warroom"
  | "admin-users";

const groups: { label: string; items: { id: Section; label: string; icon: typeof LayoutDashboard; subItems?: { id: Section; label: string }[] }[] }[] = [
  {
    label: "PRINCIPAL",
    items: [
      { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
      { id: "bia", label: "BIA", icon: ClipboardList },
      { id: "risk", label: "Risques", icon: AlertTriangle },
      { id: "plan", label: "Plans PCA", icon: ListChecks },
      { id: "exercices", label: "Exercices", icon: PlayCircle },
      { id: "warroom", label: "War Room", icon: ShieldAlert },
    ],
  },
  {
    label: "PILOTAGE",
    items: [
      { id: "governance", label: "Gouvernance PCA", icon: Building2 },
      { id: "cmdb", label: "Référentiel des ressources", icon: Database },
      { id: "form", label: "Identification des risques", icon: AlertOctagon },
      { id: "strategies", label: "Stratégies de continuité", icon: Layers },
      { id: "benchmark", label: "Benchmark", icon: BarChart3 },
    ],
  },
];

export const Sidebar = ({ active, onChange }: { active: Section; onChange: (s: Section) => void }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { role, activeOrganizationName } = useRole();
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
    if (path === "/strategies") return "strategies";
    if (path === "/form") return "form";
    if (path === "/ai") return "ai";
    if (path === "/warroom") return "warroom";  // ✅ AJOUT
    if (path === "/admin/users") return "admin-users";
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
        case 'warroom':
          navigate('/warroom');
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
      case 'warroom':
        return path === '/warroom';
      default:
        return path === `/${item.id}`;
    }
  };

  return (
    <aside
      className="sticky top-0 hidden h-screen w-64 min-w-64 shrink-0 flex-col md:flex"
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

      <nav aria-label="Navigation principale" className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-3 py-4">
        {activeOrganizationName && (
          <p className="break-all rounded-md bg-white/5 px-3 py-2 text-[10px] text-white/60">
            Organisation active : {activeOrganizationName}
          </p>
        )}
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

      {role === "admin_pca" && (
        <div className="mx-3 border-t px-1 py-3" style={{ borderColor: "rgba(248,246,242,0.12)" }}>
          <p className="px-3 pb-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#D8C28C]">ADMINISTRATION</p>
          <button type="button" title="Utilisateurs et rôles" aria-label="Utilisateurs et rôles" aria-current={location.pathname === "/admin/users" ? "page" : undefined}
            onClick={() => navigate("/admin/users")}
            className={cn("flex min-h-10 w-full items-center gap-3 rounded-md px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8FBFA8]", location.pathname === "/admin/users" ? "bg-[#2A5141] text-white" : "text-white/90")}>
            <Users className="h-4 w-4 shrink-0 text-[#8FBFA8]" /><span>Utilisateurs et rôles</span>
          </button>
        </div>
      )}

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
