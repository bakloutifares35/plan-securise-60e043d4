import { createContext, useContext, useState, ReactNode } from "react";
import { initialScenarios, initialAppetite, RiskScenario, RiskAppetite, TreatmentMeasure, MeasureStatus } from "@/data/risk";

type Ctx = {
  scenarios: RiskScenario[];
  appetite: RiskAppetite;
  updateScenario: (s: RiskScenario) => void;
  updateMeasureStatus: (scenarioId: string, measureId: string, status: MeasureStatus) => void;
  setAppetite: (a: RiskAppetite) => void;
};

const RiskContext = createContext<Ctx | null>(null);

export const RiskProvider = ({ children }: { children: ReactNode }) => {
  const [scenarios, setScenarios] = useState<RiskScenario[]>(initialScenarios);
  const [appetite, setAppetite] = useState<RiskAppetite>(initialAppetite);

  const updateScenario = (s: RiskScenario) =>
    setScenarios((prev) => prev.map((p) => (p.id === s.id ? s : p)));

  const updateMeasureStatus = (scenarioId: string, measureId: string, status: MeasureStatus) =>
    setScenarios((prev) =>
      prev.map((s) =>
        s.id === scenarioId
          ? { ...s, measures: s.measures.map((m) => (m.id === measureId ? { ...m, status } : m)) }
          : s
      )
    );

  return (
    <RiskContext.Provider value={{ scenarios, appetite, updateScenario, updateMeasureStatus, setAppetite }}>
      {children}
    </RiskContext.Provider>
  );
};

export const useRisk = () => {
  const ctx = useContext(RiskContext);
  if (!ctx) throw new Error("useRisk must be used within RiskProvider");
  return ctx;
};
