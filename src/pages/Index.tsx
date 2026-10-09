import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import type { Section } from "@/components/pca/Sidebar";
import { Dashboard } from "@/components/pca/Dashboard";
import { RiskForm } from "@/components/pca/RiskForm";
import PlansModule from "@/components/plans/PlansModule";
import { Benchmark } from "@/components/pca/Benchmark";
import { GovernanceModule } from "@/components/pca/GovernanceModule";
import { BiaModule } from "@/components/pca/bia/BiaModule";
import { RiskModule } from "@/components/pca/risk/RiskModule";
import { BcmAiConsultant } from "@/components/pca/BcmAiConsultant";
import TenaciaVoice from "@/components/pca/bia/TenaciaVoice";
import BIASynthesis from "@/components/pca/bia/BIASynthesis";
import BIARecoverySequence from "@/components/pca/bia/BIARecoverySequence";
import CMDBModule from "@/components/pca/bia/CMDBModule";
import StrategyModule from "@/components/strategy/StrategyModule";
import ExercicesModule from "@/components/exercices/ExercicesModule";
import WarRoomModule from "@/components/warroom/WarRoomModule"; // âœ… AJOUT
import { GovernanceProvider } from "@/contexts/GovernanceContext";
import { BiaProvider } from "@/contexts/BiaContext";
import { RiskProvider } from "@/contexts/RiskContext";
import { StrategyProvider } from "@/contexts/StrategyContext";
import { ApplicationShell } from "@/components/layout/ApplicationShell";

const Index = () => {
  const location = useLocation();
  const [section, setSection] = useState<Section>("dashboard");
  const [biaTab, setBiaTab] = useState<string>("dashboard");

  useEffect(() => {
    const path = location.pathname;
    if (path === "/") {
      setSection("dashboard");
    } else if (path === "/bia") {
      setSection("bia");
      setBiaTab("dashboard");
    } else if (path === "/bia/synthese") {
      setSection("bia");
      setBiaTab("synthese");
    } else if (path === "/bia/recovery") {
      setSection("bia");
      setBiaTab("recovery");
    } else if (path === "/cmdb") {
      setSection("cmdb");
    } else if (path === "/tenacia-voice") {
      setSection("tenacia");
    } else if (path === "/strategies") {
      setSection("strategies");
    } else if (path === "/plan") {
      setSection("plan");
    } else if (path === "/exercices") {
      setSection("exercices");
    } else if (path === "/warroom") {   // âœ… AJOUT
      setSection("warroom");
    }
  }, [location]);

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
    <GovernanceProvider>
        <BiaProvider>
          <RiskProvider>
            <StrategyProvider>
            <ApplicationShell active={section} onChange={setSection}>
              <div className="mx-auto w-full min-w-0 max-w-7xl">
                  {section === "dashboard" && <Dashboard />}
                  {section === "ai" && <BcmAiConsultant />}
                  {section === "form" && <RiskForm />}
                  {section === "plan" && <PlansModule />}
                  {section === "benchmark" && <Benchmark />}
                  {section === "governance" && <GovernanceModule onNavigateToSection={handleNavigateToSection} />}
                  {section === "bia" && (
                    <div>
                      {biaTab === "synthese" && <BIASynthesis />}
                      {biaTab === "recovery" && <BIARecoverySequence />}
                      {biaTab === "dashboard" && <BiaModule initialTab={biaTab} />}
                    </div>
                  )}
                  {section === "cmdb" && <CMDBModule />}
                  {section === "risk" && <RiskModule />}
                  {section === "tenacia" && <TenaciaVoice />}
                  {section === "strategies" && <StrategyModule />}
                  {section === "warroom" && <WarRoomModule />}
                  {section === "exercices" && <ExercicesModule />} {/* âœ… AJOUT */}
              </div>
            </ApplicationShell>
          </StrategyProvider>
          </RiskProvider>
        </BiaProvider>
      </GovernanceProvider>
  );
};

export default Index;
