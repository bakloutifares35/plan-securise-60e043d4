import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Sidebar, type Section } from "@/components/pca/Sidebar";
import { UserAccountMenu } from "@/components/auth/UserAccountMenu";
import { useRole } from "@/contexts/RoleContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SECTION_PATHS: Partial<Record<Section, string>> = {
  dashboard: "/dashboard",
  bia: "/bia",
  risk: "/risk",
  plan: "/plan",
  exercices: "/exercices",
  warroom: "/warroom",
  governance: "/governance",
  strategies: "/strategies",
  benchmark: "/benchmark",
  cmdb: "/cmdb",
  form: "/form",
  "admin-users": "/admin/users",
};

export function ApplicationShell({
  active,
  onChange,
  children,
}: {
  active: Section;
  onChange: (section: Section) => void;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useRole();
  const selectValue = location.pathname === "/admin/users" ? "admin-users" : active;

  const handleMobileNavigation = (value: Section) => {
    onChange(value);
    const path = SECTION_PATHS[value];
    if (path && path !== location.pathname) navigate(path);
  };

  return (
    <div className="app-shell flex min-h-screen overflow-x-clip bg-[image:var(--gradient-subtle)]">
      <Sidebar active={active} onChange={onChange} />
      <div className="app-main flex min-h-screen min-w-0 flex-1 flex-col overflow-x-clip">
        <header className="app-header relative z-30 hidden h-16 min-h-16 max-h-16 flex-none items-center justify-end overflow-visible border-b border-[#172030]/[.07] bg-[#F8F6F2]/95 px-7 backdrop-blur-sm md:flex lg:px-10">
          <UserAccountMenu />
        </header>
        <header className="app-header relative z-30 flex h-14 min-h-14 max-h-14 flex-none items-center gap-2 overflow-visible border-b border-border bg-card px-4 md:hidden">
          <Select value={selectValue} onValueChange={(value) => handleMobileNavigation(value as Section)}>
            <SelectTrigger aria-label="Navigation principale" className="h-10 min-w-0 flex-1">
              <SelectValue placeholder="Navigation" />
            </SelectTrigger>
            <SelectContent position="popper" collisionPadding={12}>
              <SelectItem value="dashboard">Tableau de bord</SelectItem>
              <SelectItem value="bia">BIA</SelectItem>
              <SelectItem value="risk">Risques</SelectItem>
              <SelectItem value="plan">Plans PCA</SelectItem>
              <SelectItem value="exercices">Exercices</SelectItem>
              <SelectItem value="warroom">War Room</SelectItem>
              <SelectItem value="governance">Gouvernance PCA</SelectItem>
              <SelectItem value="strategies">Stratégies de continuité</SelectItem>
              <SelectItem value="benchmark">Benchmark</SelectItem>
              <SelectItem value="cmdb">Référentiel des ressources</SelectItem>
              <SelectItem value="form">Identification des risques</SelectItem>
              {role === "admin_pca" && <SelectItem value="admin-users">Utilisateurs et rôles</SelectItem>}
            </SelectContent>
          </Select>
          <UserAccountMenu compact />
        </header>
        <main className="app-content mx-auto w-full min-w-0 max-w-[1600px] flex-1 overflow-x-clip px-5 py-6 sm:px-6 md:px-8 md:py-8 lg:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}
