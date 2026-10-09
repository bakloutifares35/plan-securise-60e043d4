import { 
  LayoutDashboard, 
  ListChecks, 
  BarChart3, 
  Building2, 
  Users,
  ClipboardList,
  PlayCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Layers,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ResilliaLogo } from "@/components/brand/ResilliaLogo";
import { UserAccountMenu } from "@/components/auth/UserAccountMenu";
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

const items: { id: Section; label: string; icon: typeof LayoutDashboard; subItems?: { id: Section; label: string }[] }[] = [
  { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { id: "governance", label: "Gouvernance PCA", icon: Building2 },
  { id: "bia", label: "BIA", icon: ClipboardList, subItems: [
    { id: "bia-recovery", label: "Séquence de reprise" },
    { id: "bia-synthese", label: "Synthèse BIA" },
  ] },
  { id: "risk", label: "Risques", icon: AlertTriangle },
  { id: "strategies", label: "Stratégies", icon: Layers },
  { id: "plan", label: "Plans PCA", icon: ListChecks },
  { id: "exercices", label: "Exercices", icon: PlayCircle },
  { id: "warroom", label: "War Room", icon: ShieldAlert },
  { id: "benchmark", label: "Benchmark", icon: BarChart3 },
];

export const Sidebar = ({ active, onChange }: { active: Section; onChange: (s: Section) => void }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { role, activeOrganizationName } = useRole();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const getActiveFromPath = (path: string): Section => {
    if (path === "/" || path === "/dashboard") return "dashboard";
    if (path === "/bia") return "bia";
    if (path === "/bia/synthese" || path === "/bia/recovery") return "bia";
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
    if (path.startsWith("/bia")) setExpandedItems((prev) => prev.includes("bia") ? prev : [...prev, "bia"]);
  }, [location.pathname]);

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  const handleItemClick = (item: any) => {
      switch(item.id) {
        case 'dashboard':
          navigate('/');
          break;
        case 'bia':
          navigate('/bia');
          setExpandedItems((prev) => prev.includes("bia") ? prev : [...prev, "bia"]);
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
        case 'admin-users':
          navigate('/admin/users');
          break;
        default:
          navigate(`/${item.id}`);
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
      return path.startsWith("/bia");
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
      case 'admin-users':
        return path === '/admin/users';
      default:
        return path === `/${item.id}`;
    }
  };

  return (
    <aside
      className="sticky top-0 hidden h-screen w-64 min-w-64 shrink-0 flex-col md:flex"
      style={{ backgroundColor: "#172030", color: "#F8F6F2" }}
    >
      <div className="flex flex-col gap-2 border-b border-white/[.08] px-6 py-6">
        <ResilliaLogo appearance="dark" className="h-9 w-[9.5rem]" />
        <p className="pl-1 text-[10px] uppercase tracking-[0.08em] text-white/55">Continuité d'activité</p>
      </div>

      <nav aria-label="Navigation principale" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
        {activeOrganizationName && (
          <p className="break-all rounded-md bg-white/5 px-3 py-2 text-[10px] text-white/60">
            Organisation active : {activeOrganizationName}
          </p>
        )}
        <div className="space-y-0.5">
              {[...items, ...(role === "admin_pca" ? [{ id: "admin-users" as Section, label: "Utilisateurs et rôles", icon: Users }] : [])].map((it) => {
                const Icon = it.icon;
                const hasSubItems = it.subItems && it.subItems.length > 0;
                const isExpanded = expandedItems.includes(it.id);
                const itemActive = isItemActive(it);

                return (
                  <div key={it.id}>
                    <div className="flex items-center">
                    <button
                      onClick={() => handleItemClick(it)}
                      aria-current={itemActive ? "page" : undefined}
                      className={cn(
                        "min-w-0 flex-1 flex items-center gap-3 pl-3 pr-3 py-2 rounded-r-md transition-colors text-left"
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
                    </button>
                    {hasSubItems && <button type="button" onClick={() => toggleExpand(it.id)} aria-label={`${isExpanded ? "Fermer" : "Ouvrir"} le sous-menu BIA`} aria-expanded={isExpanded} aria-controls="sidebar-bia-submenu" className="mr-1 rounded p-2 text-white/65 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8FBFA8]">{isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}</button>}
                    </div>

                    {hasSubItems && isExpanded && (
                      <div id="sidebar-bia-submenu" className="ml-6 mt-0.5 space-y-0.5">
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
      </nav>
      <div className="mx-3 border-t px-1 py-3" style={{ borderColor: "rgba(248,246,242,0.12)" }}>
        <p className="px-3 pb-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/45">COMPTE</p>
        <UserAccountMenu sidebar />
      </div>

      <div className="px-4 py-3 text-center"
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
