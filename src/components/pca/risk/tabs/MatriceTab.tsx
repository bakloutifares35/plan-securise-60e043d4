import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { RiskData } from "../useRiskData";
import { NIVEAU_STYLE, Risque, scoreToNiveau } from "../riskModel";

export const MatriceTab = ({ data }: { data: RiskData }) => {
  const [vue, setVue] = useState<"residuel" | "brut">("residuel");
  const [cell, setCell] = useState<{ p: number; i: number } | null>(null);

  const impactOf = (r: Risque) => r.impact_global || 1;
  const scoreOf = (r: Risque) => (vue === "brut" ? r.score_brut : r.score_residuel);

  const inCell = (p: number, i: number) =>
    data.risques.filter((r) => r.probabilite === p && impactOf(r) === i);

  const selected = cell ? inCell(cell.p, cell.i) : [];

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5">
        {(["residuel", "brut"] as const).map((v) => (
          <button key={v} onClick={() => setVue(v)}
            className={`px-3.5 py-2 rounded-lg text-sm font-medium border transition-colors ${
              vue === v ? "bg-[#2A5141] text-white border-[#2A5141]" : "bg-white text-[#172030]/70 border-[#172030]/10 hover:bg-[#F8F6F2]"
            }`}>Risque {v === "brut" ? "brut" : "résiduel"}</button>
        ))}
      </div>

      <Card className="border-[#172030]/10">
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-[#172030] text-base">Matrice 5 × 5 — probabilité / impact</CardTitle>
          <CardDescription>Cliquez sur une cellule pour voir les risques concernés.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <div className="inline-block">
            <div className="flex">
              <div className="w-24" />
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="w-24 text-center text-xs font-medium text-[#172030]/60 pb-2">Impact {i}</div>
              ))}
            </div>
            {[5, 4, 3, 2, 1].map((p) => (
              <div key={p} className="flex">
                <div className="w-24 flex items-center justify-end pr-3 text-xs font-medium text-[#172030]/60">Proba. {p}</div>
                {[1, 2, 3, 4, 5].map((i) => {
                  const items = inCell(p, i);
                  const niveau = scoreToNiveau(p * i, data.params);
                  const st = NIVEAU_STYLE[niveau];
                  const active = cell?.p === p && cell?.i === i;
                  return (
                    <button key={i} onClick={() => setCell(active ? null : { p, i })}
                      className={`w-24 h-20 m-0.5 rounded-lg border flex flex-col items-center justify-center transition-all ${
                        active ? "ring-2 ring-[#2A5141]" : ""
                      }`}
                      style={{ backgroundColor: `${st.hex}1A`, borderColor: `${st.hex}55` }}>
                      <span className="text-lg font-semibold text-[#172030]">{items.length || ""}</span>
                      <span className="text-[10px] text-[#172030]/50">{p * i}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {cell && (
        <Card className="border-[#172030]/10">
          <CardHeader className="pb-2">
            <CardTitle className="font-serif text-[#172030] text-base">
              Probabilité {cell.p} × Impact {cell.i} — {selected.length} risque(s)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {selected.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border border-[#172030]/10">
                <div>
                  <div className="font-medium text-[#172030]">{r.reference} — {r.title}</div>
                  <div className="text-xs text-[#172030]/50">{r.owner || "Sans pilote"} · {r.status}</div>
                </div>
                <Badge variant="outline" className={NIVEAU_STYLE[(r.niveau as any) ?? "Faible"]?.badge}>
                  Score {scoreOf(r)}
                </Badge>
              </div>
            ))}
            {selected.length === 0 && <p className="text-sm italic text-[#172030]/50">Aucun risque dans cette cellule.</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
