import { useState } from "react";
import type { Risque } from "./RisksInventory";
import { RiskMethodSelection, type RiskMethod } from "./RiskMethodSelection";
import { RiskModule } from "./RiskModule";
import { EBIOSModule } from "./ebios/EBIOSModule";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ShieldAlert, RefreshCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Props = {
  risk: Risque;
  onBackToInventory: () => void;
};

const severityStyle = (s?: string | null) => {
  switch (s) {
    case "Critique": return "bg-rose-100 text-rose-700 border-rose-200";
    case "Élevé":    return "bg-orange-100 text-orange-700 border-orange-200";
    case "Moyen":    return "bg-amber-100 text-amber-700 border-amber-200";
    default:         return "bg-emerald-100 text-emerald-700 border-emerald-200";
  }
};

export const RiskDetailPage = ({ risk, onBackToInventory }: Props) => {
  const [method, setMethod] = useState<RiskMethod | null>(
    risk.method_used === "matrix" || risk.method_used === "ebios" ? (risk.method_used as RiskMethod) : null
  );

  const choose = async (m: RiskMethod) => {
    setMethod(m);
    const { error } = await supabase
      .from("risques")
      .update({ method_used: m, status: risk.status === "À analyser" ? "En cours" : risk.status })
      .eq("id", risk.id);
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
  };

  const resetMethod = () => setMethod(null);

  return (
    <div className="space-y-5">
      {/* Breadcrumb + back */}
      <div className="flex items-center justify-between">
        <nav className="text-sm text-muted-foreground flex items-center gap-1 flex-wrap">
          <button onClick={onBackToInventory} className="hover:text-foreground">Analyse des Risques</button>
          <span className="px-1">›</span>
          <button onClick={onBackToInventory} className="hover:text-foreground">Inventaire</button>
          <span className="px-1">›</span>
          <span className="text-foreground font-medium truncate max-w-[280px]">{risk.title}</span>
          {method && (
            <>
              <span className="px-1">›</span>
              <span className="text-foreground font-medium">
                {method === "ebios" ? "EBIOS RM" : "Méthode 5×5"}
              </span>
            </>
          )}
        </nav>
        <Button variant="outline" size="sm" onClick={onBackToInventory}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Inventaire
        </Button>
      </div>

      {/* Risk header */}
      <Card className="overflow-hidden border-2">
        <div className={cn(
          "h-1.5",
          risk.severity === "Critique" ? "bg-rose-500"
          : risk.severity === "Élevé" ? "bg-orange-500"
          : risk.severity === "Moyen" ? "bg-amber-500"
          : "bg-emerald-500"
        )} />
        <CardContent className="pt-5">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center flex-shrink-0">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl md:text-2xl font-bold">{risk.title}</h1>
              {risk.description && <p className="text-sm text-muted-foreground mt-1">{risk.description}</p>}
              <div className="flex flex-wrap gap-1.5 mt-3">
                {risk.category && <Badge variant="outline">{risk.category}</Badge>}
                <Badge variant="outline" className={severityStyle(risk.severity)}>{risk.severity ?? "Moyen"}</Badge>
                <Badge variant="secondary">{risk.status ?? "À analyser"}</Badge>
                {risk.owner && <Badge variant="outline">👤 {risk.owner}</Badge>}
              </div>
            </div>
            {method && (
              <Button variant="outline" size="sm" onClick={resetMethod}>
                <RefreshCcw className="h-3.5 w-3.5 mr-1" /> Changer de méthode
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Method or analysis */}
      {!method && <RiskMethodSelection active={null} onSelect={choose} />}
      {method === "matrix" && <RiskModule />}
      {method === "ebios" && <EBIOSModule onBack={resetMethod} />}
    </div>
  );
};
