import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Sidebar, type Section } from "@/components/pca/Sidebar";
import { ResilliaLogo } from "@/components/brand/ResilliaLogo";
import { UserAccountMenu } from "@/components/auth/UserAccountMenu";
import { useRole } from "@/contexts/RoleContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SECTION_PATHS: Partial<Record<Section, string>> = {
  dashboard: "/dashboard",
  bia: "/bia",
  "bia-synthese": "/bia/synthese",
  "bia-recovery": "/bia/recovery",
  risk: "/risk",
  plan: "/plan",
  exercices: "/exercices",
  warroom: "/warroom",
  governance: "/governance",
  strategies: "/strategies",
  benchmark: "/benchmark",
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
  const selectValue: Section = location.pathname === "/admin/users" ? "admin-users"
    : location.pathname === "/bia/synthese" ? "bia-synthese"
    : location.pathname === "/bia/recovery" ? "bia-recovery" : active;

  const handleMobileNavigation = (value: Section) => {
    onChange(value === "bia-recovery" || value === "bia-synthese" ? "bia" : value);
    const path = SECTION_PATHS[value];
    if (path && path !== location.pathname) navigate(path);
  };

  return (
    <div className="app-shell flex min-h-screen overflow-x-clip bg-[image:var(--gradient-subtle)]">
      <Sidebar active={active} onChange={onChange} />
      <div className="app-main flex min-h-screen min-w-0 flex-1 flex-col overflow-x-clip">
        <header className="app-header relative z-30 flex h-14 min-h-14 max-h-14 flex-none items-center gap-2 overflow-visible border-b border-border bg-card px-4 md:hidden">
          <ResilliaLogo variant="compact" appearance="light" className="h-8 w-8 shrink-0" />
          <Select value={selectValue} onValueChange={(value) => handleMobileNavigation(value as Section)}>
            <SelectTrigger aria-label="Navigation principale" className="h-10 min-w-0 flex-1">
              <SelectValue placeholder="Navigation" />
            </SelectTrigger>
            <SelectContent position="popper" collisionPadding={12}>
              <SelectItem value="dashboard">Tableau de bord</SelectItem>
              <SelectItem value="governance">Gouvernance PCA</SelectItem>
              <SelectItem value="bia">BIA</SelectItem>
              <SelectItem value="bia-recovery">↳ Séquence de reprise</SelectItem>
              <SelectItem value="bia-synthese">↳ Synthèse BIA</SelectItem>
              <SelectItem value="risk">Risques</SelectItem>
              <SelectItem value="strategies">Stratégies</SelectItem>
              <SelectItem value="plan">Plans PCA</SelectItem>
              <SelectItem value="exercices">Exercices</SelectItem>
              <SelectItem value="warroom">War Room</SelectItem>
              <SelectItem value="benchmark">Benchmark</SelectItem>
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
