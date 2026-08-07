// src/components/strategy/tabs/ComparaisonTab.tsx
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { StrategyData } from "../useStrategyData";
import { STATUT_STYLE } from "../types";

export const ComparaisonTab = ({ data }: { data: StrategyData }) => {
  const { associations, catalogue } = data;
  const [processId, setProcessId] = useState<string>("");

  const filtered = useMemo(() => {
    return associations.filter((a: any) => a.processId === processId);
  }, [associations, processId]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h3 className="font-serif text-xl font-bold text-[#172030]">Comparaison des stratégies</h3>
          <p className="text-sm text-[#172030]/60">Comparez les options d'un même processus.</p>
        </div>
        <Select value={processId} onValueChange={setProcessId}>
          <SelectTrigger className="w-full md:w-[320px] border-[#E5E2DD] focus:ring-[#2A5141] bg-white shadow-sm">
            <SelectValue placeholder="Sélectionner un processus" />
          </SelectTrigger>
          <SelectContent>
            {/* Vous pouvez ajouter vos processus ici */}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card className="border-0 shadow-sm bg-white rounded-xl">
          <CardContent className="py-12 text-center text-[#172030]/40">
            Aucune stratégie associée à ce processus.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((a: any) => {
            const strategy = catalogue.find((s: any) => s.id === a.strategyId);
            const ss = STATUT_STYLE[a.status] || STATUT_STYLE.Proposée;
            return (
              <Card key={a.id} className="border shadow-sm bg-white rounded-xl">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-serif font-bold text-[#172030]">{strategy?.nom || "—"}</p>
                  </div>
                  <p className="text-xs text-[#172030]/50">{a.scenarioId || "Tous scénarios"}</p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="rounded-full px-2.5 py-1 text-xs font-medium" style={{ backgroundColor: ss.bg, color: ss.text }}>
                      {a.status}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};