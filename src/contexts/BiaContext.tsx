import { createContext, useContext, useState, ReactNode } from "react";
import { initialProcesses, initialCampaigns, type Process, type Campaign } from "@/data/bia";

type Ctx = {
  processes: Process[];
  setProcesses: (p: Process[]) => void;
  upsertProcess: (p: Process) => void;
  deleteProcess: (id: string) => void;
  campaigns: Campaign[];
};

const BiaContext = createContext<Ctx | null>(null);

export const BiaProvider = ({ children }: { children: ReactNode }) => {
  const [processes, setProcesses] = useState<Process[]>(initialProcesses);
  const [campaigns] = useState<Campaign[]>(initialCampaigns);

  const upsertProcess = (p: Process) => {
    setProcesses((prev) => {
      const ix = prev.findIndex((x) => x.id === p.id);
      if (ix === -1) return [...prev, p];
      const next = [...prev];
      next[ix] = p;
      return next;
    });
  };
  const deleteProcess = (id: string) =>
    setProcesses((prev) => prev.filter((x) => x.id !== id).map((p) => ({ ...p, dependsOn: p.dependsOn.filter((d) => d !== id) })));

  return (
    <BiaContext.Provider value={{ processes, setProcesses, upsertProcess, deleteProcess, campaigns }}>
      {children}
    </BiaContext.Provider>
  );
};

export const useBia = () => {
  const ctx = useContext(BiaContext);
  if (!ctx) throw new Error("useBia must be used within BiaProvider");
  return ctx;
};
