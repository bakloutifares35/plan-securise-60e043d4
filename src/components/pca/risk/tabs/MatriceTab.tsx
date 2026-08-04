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
    <div className="max-w-[1440px] mx-auto p-6 space-y-6 bg-[#F8F6F2] min-h-screen font-sans">
      
      {/* ==========================================================
          HEADER & CONTROLES
          ========================================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-[#172030]">Matrice des Risques</h1>
          <p className="text-sm text-[#172030]/60 mt-1 font-sans">
            Analyse croisée {vue === "brut" ? "du score brut" : "du score résiduel"} par probabilité et impact
          </p>
        </div>
        <div className="flex gap-1.5 p-1 bg-white rounded-xl border border-[#E5E2DD] shadow-sm">
          {(["residuel", "brut"] as const).map((v) => (
            <button 
              key={v} 
              onClick={() => setVue(v)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                vue === v 
                  ? "bg-[#2A5141] text-white shadow-sm" 
                  : "text-[#172030]/50 hover:text-[#172030] hover:bg-[#F8F6F2]"
              )}
            >
              Risque {v === "brut" ? "brut" : "résiduel"}
            </button>
          ))}
        </div>
      </div>

      {/* ==========================================================
          MATRICE 5x5 PREMIUM
          ========================================================== */}
      <Card className="border-0 shadow-sm bg-white rounded-xl">
        <CardHeader className="p-5 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-serif text-[#172030] text-lg">Matrice 5 × 5</CardTitle>
              <CardDescription className="text-[#172030]/50 font-sans text-sm mt-1">
                Cliquez sur une cellule pour filtrer et voir les risques concernés.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-[9px] border-[#E5E2DD] text-[#172030]/50 font-sans rounded-full px-2.5 py-0.5 bg-[#F8F6F2]">
              P × I
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-5 overflow-x-auto">
          <div className="inline-block min-w-[600px]">
            {/* En-tête des colonnes */}
            <div className="flex">
              <div className="w-20 shrink-0" />
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="w-24 text-center text-xs font-medium text-[#172030]/40 pb-3 uppercase tracking-wider font-sans">
                  Impact {i}
                </div>
              ))}
            </div>
            
            {/* Corps de la matrice */}
            {[5, 4, 3, 2, 1].map((p) => (
              <div key={p} className="flex">
                <div className="w-20 shrink-0 flex items-center justify-end pr-4 text-xs font-medium text-[#172030]/40 font-sans">
                  P {p}
                </div>
                {[1, 2, 3, 4, 5].map((i) => {
                  const items = inCell(p, i);
                  const niveau = scoreToNiveau(p * i, data.params);
                  const style = NIVEAU_STYLE[niveau];
                  const isActive = cell?.p === p && cell?.i === i;
                  const maxScore = p * i;
                  
                  return (
                    <button 
                      key={i} 
                      onClick={() => setCell(isActive ? null : { p, i })}
                      className={cn(
                        "w-24 h-16 m-0.5 rounded-xl flex flex-col items-center justify-center border transition-all duration-200 relative group cursor-pointer",
                        isActive && "ring-2 ring-[#2A5141] ring-offset-2"
                      )}
                      style={{ 
                        backgroundColor: `${style.hex}20`, 
                        borderColor: isActive ? "#2A5141" : `${style.hex}40` 
                      }}
                    >
                      {/* Indicateur de couleur (Dot) */}
                      <div className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: style.hex }} />
                      
                      {/* Nombre de risques */}
                      <span className="text-lg font-bold" style={{ color: style.hex }}>
                        {items.length || ""}
                      </span>
                      
                      {/* Score max de la cellule */}
                      <span className="text-[9px] font-mono text-[#172030]/30">
                        {vue === "brut" ? maxScore : maxScore}
                      </span>
                      
                      {/* Tooltip au survol */}
                      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-[#172030] text-white text-[9px] px-2 py-0.5 rounded whitespace-nowrap z-10 pointer-events-none">
                        {items.length} risque{items.length > 1 ? 's' : ''}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ==========================================================
          DÉTAILS DE LA CELLULE (Apparaît quand une cellule est sélectionnée)
          ========================================================== */}
      {cell && (
        <Card className="border-0 shadow-sm bg-white rounded-xl animate-in fade-in zoom-in duration-300">
          <CardHeader className="p-5 pb-2 border-b border-[#F8F6F2]">
            <div className="flex items-center justify-between">
              <CardTitle className="font-serif text-[#172030] text-lg">
                Probabilité {cell.p} × Impact {cell.i}
              </CardTitle>
              <Badge variant="outline" className="border-[#E5E2DD] text-[#172030]/50 font-sans rounded-full px-2.5 py-0.5">
                {selected.length} risque{selected.length > 1 ? 's' : ''}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
            {selected.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-[#172030]/30">
                <p className="text-sm font-sans">Aucun risque dans cette cellule.</p>
              </div>
            ) : (
              selected.map((r) => {
                const niveau = r.niveau || "Faible";
                const style = NIVEAU_STYLE[niveau as keyof typeof NIVEAU_STYLE];
                
                return (
                  <div 
                    key={r.id} 
                    className="flex items-center justify-between p-3.5 rounded-xl bg-[#F8F6F2]/50 border border-[#F8F6F2] hover:bg-[#F8F6F2] transition-colors"
                  >
                    <div className="flex flex-col min-w-0 flex-1 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[#172030] font-sans truncate">{r.reference} — {r.title}</span>
                        <Badge className={cn("text-[9px] font-medium border-0 rounded-full px-2 py-0.5", style?.badge)}>
                          {niveau}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-[#172030]/50 font-sans">
                        <span>👤 {r.owner || "Sans pilote"}</span>
                        <span className="w-px h-3 bg-[#E5E2DD]" />
                        <span>{r.status || "En cours"}</span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end shrink-0">
                      <span className="text-sm font-bold font-mono" style={{ color: style?.hex || "#172030" }}>
                        {scoreOf(r)}
                      </span>
                      <span className="text-[9px] text-[#172030]/30 font-sans">
                        Score {vue === "brut" ? "brut" : "résiduel"}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      )}
      
      {/* ==========================================================
          STYLE SCROLLBAR PERSONNALISÉ
          ========================================================== */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #E5E2DD;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #C0D8CF;
        }
      `}</style>
    </div>
  );
};

// Helper pour les classes conditionnelles si vous n'utilisez pas la version ultérieure de Tailwind
function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}