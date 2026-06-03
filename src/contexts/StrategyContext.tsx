import { createContext, useContext, useState, ReactNode } from "react";
import { Strategy, StrategyAssociation, initialStrategies, initialAssociations } from "@/data/strategy";

type Ctx = {
  strategies: Strategy[];
  associations: StrategyAssociation[];
  addAssociation: (a: StrategyAssociation) => void;
  updateAssociation: (a: StrategyAssociation) => void;
  deleteAssociation: (id: string) => void;
};

const StrategyContext = createContext<Ctx | null>(null);

export const StrategyProvider = ({ children }: { children: ReactNode }) => {
  const [strategies] = useState<Strategy[]>(initialStrategies);
  const [associations, setAssociations] = useState<StrategyAssociation[]>(initialAssociations);

  const addAssociation = (a: StrategyAssociation) => setAssociations((p) => [...p, a]);
  const updateAssociation = (a: StrategyAssociation) =>
    setAssociations((p) => p.map((x) => (x.id === a.id ? a : x)));
  const deleteAssociation = (id: string) =>
    setAssociations((p) => p.filter((x) => x.id !== id));

  return (
    <StrategyContext.Provider value={{ strategies, associations, addAssociation, updateAssociation, deleteAssociation }}>
      {children}
    </StrategyContext.Provider>
  );
};

export const useStrategy = () => {
  const ctx = useContext(StrategyContext);
  if (!ctx) throw new Error("useStrategy must be used within StrategyProvider");
  return ctx;
};
