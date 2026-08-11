// src/components/strategy/tabs/GapsTab.tsx
import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const GapsTab = ({ data, onDefineStrategy }: { data: any, onDefineStrategy: (processId: string) => void }) => {
  const { processus, associations } = data;

  // 🔥 Identifier les processus qui n'ont AUCUNE association
  const gaps = useMemo(() => {
    const linkedIds = new Set(associations.map((a: any) => a.processus_id));
    return processus.filter((p: any) => !linkedIds.has(p.id));
  }, [processus, associations]);

  if (gaps.length === 0) {
    return (
      <Card className="border-0 shadow-sm bg-white rounded-xl p-12 text-center">
        <div className="text-[#172030]/40 space-y-2">
          <p className="text-lg font-serif">🎉 Tout est couvert !</p>
          <p className="text-sm">Tous les processus critiques ont au moins une stratégie associée.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-sm bg-white rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[#F8F6F2] border-b border-[#E5E2DD]">
              <th className="text-left text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider p-4">Processus</th>
              <th className="text-left text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider p-4">Criticité</th>
              <th className="text-left text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider p-4">RTO</th>
              <th className="text-right text-[10px] font-semibold text-[#172030]/50 uppercase tracking-wider p-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {gaps.map((p: any) => (
              <tr key={p.id} className="border-b border-[#EFEDE8] hover:bg-[#FAF9F6]">
                <td className="p-4 font-medium text-[#172030]">{p.name}</td>
                <td className="p-4">
                  <Badge variant="outline" className="bg-[#FCE9E9] text-[#B91C1C] border-[#FCE9E9]">
                    {p.criticality_level || "Non défini"}
                  </Badge>
                </td>
                <td className="p-4 font-mono text-[#172030]/70">{p.rto_hours || "—"}h</td>
                <td className="p-4 text-right">
                  <Button 
                    size="sm" 
                    className="bg-[#2A5141] hover:bg-[#1F3E32] text-white"
                    onClick={() => onDefineStrategy(p.id)}
                  >
                    + Définir
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};