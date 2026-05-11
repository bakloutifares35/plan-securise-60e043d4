import { useState } from "react";
import { Sidebar, type Section } from "@/components/pca/Sidebar";
import { Dashboard } from "@/components/pca/Dashboard";
import { RiskForm } from "@/components/pca/RiskForm";
import { PlanSteps } from "@/components/pca/PlanSteps";
import { Benchmark } from "@/components/pca/Benchmark";
import { GovernanceModule } from "@/components/pca/GovernanceModule";
import { BiaModule } from "@/components/pca/bia/BiaModule";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GovernanceProvider } from "@/contexts/GovernanceContext";
import { RoleProvider } from "@/contexts/RoleContext";
import { BiaProvider } from "@/contexts/BiaContext";

const Index = () => {
  const [section, setSection] = useState<Section>("dashboard");

  return (
    <RoleProvider>
      <GovernanceProvider>
        <BiaProvider>
        <div className="min-h-screen flex bg-[image:var(--gradient-subtle)]">
          <Sidebar active={section} onChange={setSection} />
          <main className="flex-1 min-w-0">
            <header className="md:hidden border-b border-border bg-card px-4 py-3">
              <Select value={section} onValueChange={(v) => setSection(v as Section)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dashboard">Tableau de bord</SelectItem>
                  <SelectItem value="orgchart">Organigramme</SelectItem>
                  <SelectItem value="calendar">Calendrier annuel</SelectItem>
                  <SelectItem value="policy">Politique PCA</SelectItem>
                  <SelectItem value="committee">Comité de pilotage</SelectItem>
                  <SelectItem value="references">Référentiels & rôles</SelectItem>
                  <SelectItem value="bia">Business Impact Analysis</SelectItem>
                  <SelectItem value="form">Identification des risques</SelectItem>
                  <SelectItem value="plan">Plan de continuité</SelectItem>
                  <SelectItem value="benchmark">Benchmark</SelectItem>
                </SelectContent>
              </Select>
            </header>
            <div className="p-6 md:p-10 max-w-7xl mx-auto">
              {section === "dashboard" && <Dashboard />}
              {section === "form" && <RiskForm />}
              {section === "plan" && <PlanSteps />}
              {section === "benchmark" && <Benchmark />}
              {section === "orgchart" && <OrgChart onNavigate={setSection} />}
              {section === "entity" && <EntityProfile onBack={() => setSection("orgchart")} />}
              {section === "calendar" && <AnnualCalendar />}
              {section === "policy" && <PolicyEditor />}
              {section === "committee" && <SteeringCommittee />}
              {section === "references" && <References />}
              {section === "bia" && <BiaModule />}
            </div>
          </main>
        </div>
        </BiaProvider>
      </GovernanceProvider>
    </RoleProvider>
  );
};

export default Index;
