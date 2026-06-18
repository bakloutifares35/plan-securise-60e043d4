import { useState } from "react";
import { Sidebar, type Section } from "@/components/pca/Sidebar";
import { Dashboard } from "@/components/pca/Dashboard";
import { RiskForm } from "@/components/pca/RiskForm";
import { PlanSteps } from "@/components/pca/PlanSteps";
import { Benchmark } from "@/components/pca/Benchmark";
import { GovernanceModule } from "@/components/pca/GovernanceModule";
import { BiaModule } from "@/components/pca/bia/BiaModule";
import { RiskMethodGate } from "@/components/pca/risk/RiskMethodGate";
import { BcmAiConsultant } from "@/components/pca/BcmAiConsultant";
import TenaciaVoice from "@/components/pca/bia/TenaciaVoice"; // 👈 AJOUTE CETTE LIGNE
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GovernanceProvider } from "@/contexts/GovernanceContext";
import { RoleProvider } from "@/contexts/RoleContext";
import { BiaProvider } from "@/contexts/BiaContext";
import { RiskProvider } from "@/contexts/RiskContext";

const Index = () => {
  const [section, setSection] = useState<Section>("dashboard");
  const [biaTab, setBiaTab] = useState<string>("dashboard");

  const handleNavigateToSection = (targetSection: string, targetTab?: string, entityId?: string) => {
    if (targetSection === "bia") {
      setSection("bia");
      if (targetTab) {
        setBiaTab(targetTab);
      }
      if (entityId) {
        localStorage.setItem("currentDepartmentId", entityId);
      }
    }
  };

  return (
    <RoleProvider>
      <GovernanceProvider>
        <BiaProvider>
          <RiskProvider>
            <div className="min-h-screen flex bg-[image:var(--gradient-subtle)]">
              <Sidebar active={section} onChange={setSection} />
              <main className="flex-1 min-w-0">
                <header className="md:hidden border-b border-border bg-card px-4 py-3">
                  <Select value={section} onValueChange={(v) => setSection(v as Section)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dashboard">Tableau de bord</SelectItem>
                      <SelectItem value="ai">BCM AI Consultant</SelectItem>
                      <SelectItem value="governance">Gouvernance PCA</SelectItem>
                      <SelectItem value="bia">Business Impact Analysis</SelectItem>
                      <SelectItem value="risk">Analyse des Risques</SelectItem>
                      <SelectItem value="form">Identification des risques</SelectItem>
                      <SelectItem value="plan">Plan de continuité</SelectItem>
                      <SelectItem value="benchmark">Benchmark</SelectItem>
                      <SelectItem value="tenacia">🎤 Tenacia Voice AI</SelectItem> {/* 👈 AJOUTE CETTE LIGNE */}
                    </SelectContent>
                  </Select>
                </header>
                <div className="p-6 md:p-10 max-w-7xl mx-auto">
                  {section === "dashboard" && <Dashboard />}
                  {section === "ai" && <BcmAiConsultant />}
                  {section === "form" && <RiskForm />}
                  {section === "plan" && <PlanSteps />}
                  {section === "benchmark" && <Benchmark />}
                  {section === "governance" && <GovernanceModule onNavigateToSection={handleNavigateToSection} />}
                  {section === "bia" && <BiaModule initialTab={biaTab} />}
                  {section === "risk" && <RiskMethodGate />}
                  {section === "tenacia" && <TenaciaVoice />} {/* 👈 AJOUTE CETTE LIGNE */}
                </div>
              </main>
            </div>
          </RiskProvider>
        </BiaProvider>
      </GovernanceProvider>
    </RoleProvider>
  );
};

export default Index;