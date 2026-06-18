import { useState } from "react";
import { RiskMethodSelection, type RiskMethod } from "./RiskMethodSelection";
import { RiskModule } from "./RiskModule";
import { EBIOSModule } from "./ebios/EBIOSModule";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

const STORAGE_KEY = "risk-method-selected-v1";

export const RiskMethodGate = () => {
  const [method, setMethod] = useState<RiskMethod | null>(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      return v === "matrix" || v === "ebios" ? (v as RiskMethod) : null;
    } catch { return null; }
  });

  const choose = (m: RiskMethod) => {
    setMethod(m);
    try { localStorage.setItem(STORAGE_KEY, m); } catch {}
  };

  const reset = () => {
    setMethod(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  if (!method) return <RiskMethodSelection active={method} onSelect={choose} />;

  if (method === "ebios") return <EBIOSModule onBack={reset} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <nav className="text-sm text-muted-foreground flex items-center gap-1">
          <button onClick={reset} className="hover:text-foreground">Analyse des Risques</button>
          <span className="px-1">›</span>
          <span className="text-foreground font-medium">Méthode Cartographique 5×5</span>
        </nav>
        <Button variant="outline" size="sm" onClick={reset}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Changer de méthode
        </Button>
      </div>
      <RiskModule />
    </div>
  );
};
