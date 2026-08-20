import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Info, ArrowDownRight, ArrowRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { RiskData } from "../useRiskData";
import { NIVEAU_STYLE, Risque, scoreToNiveau, recompute } from "../riskModel";

export const MatriceTab = ({ data }: { data: RiskData }) => {
  const [vue, setVue] = useState<"residuel" | "brut">("brut");
  const [cell, setCell] = useState<{ p: number; i: number } | null>(null);
  const [showAppetite, setShowAppetite] = useState(false);

  // ==========================================================
  // 1. LOGIQUE DE POSITION RÉSIDUELLE (Basée sur recompute)
  // ==========================================================
  const getResidualPosition = (r: Risque) => {
    // On utilise la fonction recompute existante pour obtenir le score résiduel
    const recomputed = recompute(r);
    
    // On déduit une probabilité et un impact résiduels en fonction du score résiduel
    // Formule simple : on répartit le score résiduel sur une échelle de 1 à 5
    const residualScore = recomputed.score_residuel || 0;
    
    // Si le score est 0, on le met en (1,1)
    if (residualScore === 0) return { p: 1, i: 1 };
    
    // On cherche la combinaison P x I la plus proche du score résiduel
    let bestP = 1, bestI = 1, bestDiff = Infinity;
    for (let p = 1; p <= 5; p++) {
      for (let i = 1; i <= 5; i++) {
        const diff = Math.abs(p * i - residualScore);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestP = p;
          bestI = i;
        }
      }
    }
    return { p: bestP, i: bestI };
  };

  // ==========================================================
  // 2. FILTRAGE DES RISQUES PAR CELLULE
  // ==========================================================
  const inCell = (p: number, i: number) => {
    return data.risques.filter((r) => {
      if (vue === "brut") {
        return r.probabilite === p && (r.impact_global || r.impact || 1) === i;
      } else {
        const pos = getResidualPosition(r);
        return pos.p === p && pos.i === i;
      }
    });
  };

  const scoreOf = (r: Risque) => {
    if (vue === "brut") return r.score_brut || 0;
    // Pour le résiduel, on utilise le score calculé par recompute
    return recompute(r).score_residuel || 0;
  };

  const selected = cell ? inCell(cell.p, cell.i) : [];

  // ==========================================================
  // 3. STATISTIQUES DE LA CELLULE SÉLECTIONNÉE
  // ==========================================================
  const cellStats = useMemo(() => {
    if (!cell || selected.length === 0) return null;
    const scores = selected.map(r => scoreOf(r));
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const criticalCount = selected.filter(r => r.niveau === "Critique").length;
    return { total: selected.length, critical: criticalCount, avgScore: Math.round(avgScore * 10) / 10 };
  }, [selected, cell]);

  // ==========================================================
  // 4. LÉGENDE DE SÉVÉRITÉ
  // ==========================================================
  const severityLevels = [
    { label: "Faible", key: "Faible" },
    { label: "Modéré", key: "Modéré" },
    { label: "Élevé", key: "Élevé" },
    { label: "Critique", key: "Critique" },
  ];

  // Helper cn local
  const cn = (...classes: (string | boolean | undefined | null)[]) => classes.filter(Boolean).join(' ');

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
        <div className="flex flex-wrap items-center gap-2">
          {/* Toggle Appétence */}
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowAppetite(!showAppetite)}
            className={cn(
              "border-[#E5E2DD] text-[#172030]/60 hover:text-[#2A5141]",
              showAppetite && "border-[#2A5141] text-[#2A5141] bg-[#E8F0EC]"
            )}
          >
            {showAppetite ? "Seuil masqué" : "Afficher le seuil"}
          </Button>

          {/* Toggle Brut / Résiduel */}
          <div className="flex gap-1.5 p-1 bg-white rounded-xl border border-[#E5E2DD] shadow-sm">
            {(["brut", "residuel"] as const).map((v) => (
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

          {/* Bouton Export (futur) */}
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-[#172030]/40 hover:text-[#2A5141]"
            onClick={() => toast({ title: "Export à venir", description: "Cette fonctionnalité sera disponible prochainement." })}
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ==========================================================
          MATRICE 5x5 PREMIUM
          ========================================================== */}
      <Card className="border-0 shadow-sm bg-white rounded-xl overflow-hidden">
        <CardHeader className="p-5 pb-3 border-b border-[#E5E2DD]">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-serif text-[#172030] text-lg">Matrice 5 × 5</CardTitle>
              <CardDescription className="text-[#172030]/50 font-sans text-sm mt-1">
                Cliquez sur une cellule pour filtrer et voir les risques concernés.
              </CardDescription>
            </div>
            <Badge variant="outline" className="border-[#E5E2DD] text-[#172030]/50 font-sans rounded-full px-2.5 py-0.5 bg-[#F8F6F2]">
              P × I
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-5 overflow-x-auto">
          <div className="inline-block min-w-[650px]">
            {/* En-tête des colonnes + Label Impact */}
            <div className="flex">
              <div className="w-24 shrink-0 flex items-end justify-center pb-3">
                <span className="text-[10px] font-medium text-[#172030]/40 uppercase tracking-wider font-sans -rotate-90 whitespace-nowrap">
                  Probabilité
                </span>
              </div>
              <div className="flex flex-col flex-1">
                <div className="flex justify-between px-2 pb-1">
                  <span className="text-[9px] font-medium text-[#172030]/30 uppercase tracking-wider font-sans">Impact →</span>
                  <span className="text-[9px] font-medium text-[#172030]/30 uppercase tracking-wider font-sans">(croissant)</span>
                </div>
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex-1 text-center text-xs font-medium text-[#172030]/40 pb-3 uppercase tracking-wider font-sans">
                      {i}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Corps de la matrice */}
            {[5, 4, 3, 2, 1].map((p) => (
              <div key={p} className="flex">
                <div className="w-24 shrink-0 flex items-center justify-end pr-4 text-xs font-medium text-[#172030]/40 font-sans">
                  {p}
                </div>
                {[1, 2, 3, 4, 5].map((i) => {
                  const items = inCell(p, i);
                  const niveau = scoreToNiveau(p * i, data.params);
                  const style = NIVEAU_STYLE[niveau];
                  const isActive = cell?.p === p && cell?.i === i;
                  
                  // Vérifier si ce risque a bougé (pour l'indicateur de tendance)
                  const hasMoved = vue === "residuel" && items.some(r => {
                    const brutPos = { p: r.probabilite, i: r.impact_global || r.impact || 1 };
                    const resPos = getResidualPosition(r);
                    return brutPos.p !== resPos.p || brutPos.i !== resPos.i;
                  });
                  
                  return (
                    <button 
                      key={i} 
                      onClick={() => setCell(isActive ? null : { p, i })}
                      className={cn(
                        "flex-1 h-16 m-0.5 rounded-xl flex flex-col items-center justify-center border transition-all duration-200 relative group cursor-pointer",
                        isActive && "ring-2 ring-[#2A5141] ring-offset-2"
                      )}
                      style={{ 
                        backgroundColor: `${style.hex}20`, 
                        borderColor: isActive ? "#2A5141" : `${style.hex}40` 
                      }}
                    >
                      {/* Ligne de seuil d'appétence (diagonale schématique) */}
                      {showAppetite && p + i >= 7 && (
                        <div className="absolute inset-0 pointer-events-none opacity-30">
                          <div className="absolute top-0 left-0 w-full h-px bg-[#B91C1C] transform rotate-45 origin-top-left" />
                        </div>
                      )}
                      
                      {/* Indicateur de tendance (flèche) */}
                      {hasMoved && (
                        <div className="absolute -bottom-1 -right-1 text-[#2A5141]">
                          <ArrowDownRight className="h-3 w-3" />
                        </div>
                      )}
                      
                      {/* Indicateur de couleur (Dot) */}
                      <div className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: style.hex }} />
                      
                      {/* Nombre de risques */}
                      <span className="text-lg font-bold" style={{ color: style.hex }}>
                        {items.length || ""}
                      </span>
                      
                      {/* Score moyen de la cellule */}
                      <span className="text-[9px] font-mono text-[#172030]/30">
                        {items.length > 0 ? Math.round(items.reduce((acc, r) => acc + scoreOf(r), 0) / items.length) : ""}
                      </span>
                      
                      {/* Tooltip au survol (avec noms des risques) */}
                      {items.length > 0 && (
                        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-[#172030] text-white text-[9px] px-2.5 py-1 rounded-md whitespace-nowrap z-10 pointer-events-none shadow-lg">
                          <div className="font-medium">{items.length} risque{items.length > 1 ? 's' : ''}</div>
                          {items.slice(0, 2).map(r => (
                            <div key={r.id} className="text-[8px] opacity-80">{r.title}</div>
                          ))}
                          {items.length > 2 && <div className="text-[8px] opacity-60">+{items.length - 2} autre{items.length - 2 > 1 ? 's' : ''}</div>}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
            
            {/* LÉGENDE DE SÉVÉRITÉ */}
            <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-[#E5E2DD] pt-4">
              <span className="text-[9px] font-semibold text-[#172030]/40 uppercase tracking-wider font-sans mr-1">Sévérité :</span>
              {severityLevels.map((level) => {
                const style = NIVEAU_STYLE[level.key as keyof typeof NIVEAU_STYLE];
                return (
                  <div key={level.key} className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: style?.hex || "#E5E2DD" }} />
                    <span className="text-[10px] text-[#172030]/60 font-sans">{level.label}</span>
                  </div>
                );
              })}
            </div>

            {/* Mention des flèches */}
            {vue === "residuel" && (
              <div className="mt-2 flex items-center gap-2 text-[9px] text-[#172030]/40 font-sans">
                <ArrowDownRight className="h-3 w-3 text-[#2A5141]" />
                <span>Indique un risque ayant diminué entre le brut et le résiduel</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ==========================================================
          DÉTAILS DE LA CELLULE (Apparaît quand une cellule est sélectionnée)
          ========================================================== */}
      {cell && selected.length > 0 && (
        <Card className="border-0 shadow-sm bg-white rounded-xl animate-in fade-in zoom-in duration-300">
          <CardHeader className="p-5 pb-2 border-b border-[#E8F6F2]">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="font-serif text-[#172030] text-lg">
                  Probabilité {cell.p} × Impact {cell.i}
                </CardTitle>
                <CardDescription className="text-[#172030]/40 font-sans text-xs mt-0.5">
                  {cellStats && (
                    <span>
                      {cellStats.total} risque{cellStats.total > 1 ? 's' : ''} • 
                      {cellStats.critical > 0 && <span className="text-[#B91C1C] ml-1">{cellStats.critical} critique{cellStats.critical > 1 ? 's' : ''}</span>}
                      {cellStats.critical > 0 && <span className="text-[#172030]/30 mx-1">•</span>}
                      Score moyen : {cellStats.avgScore}
                    </span>
                  )}
                </CardDescription>
              </div>
              <Badge variant="outline" className="border-[#E5E2DD] text-[#172030]/50 font-sans rounded-full px-2.5 py-0.5">
                {selected.length} risque{selected.length > 1 ? 's' : ''}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
            {selected.map((r) => {
              const niveau = r.niveau || "Faible";
              const style = NIVEAU_STYLE[niveau as keyof typeof NIVEAU_STYLE];
              const score = scoreOf(r);
              const hasMoved = vue === "residuel" && r.maitrise && r.maitrise > 1;
              
              return (
                <div 
                  key={r.id} 
                  className="flex items-center justify-between p-3.5 rounded-xl bg-[#F8F6F2]/50 border border-[#F8F6F2] hover:bg-[#F8F6F2] transition-colors"
                >
                  <div className="flex flex-col min-w-0 flex-1 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[#172030] font-sans truncate">{r.reference || r.id?.slice(0, 8)} — {r.title}</span>
                      <Badge className={cn("text-[9px] font-medium border-0 rounded-full px-2 py-0.5", style?.badge)}>
                        {niveau}
                      </Badge>
                      {hasMoved && (
                        <div className="text-[#2A5141]">
                          <ArrowRight className="h-3 w-3" />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-[#172030]/50 font-sans">
                      <span>👤 {r.owner || "Sans pilote"}</span>
                      <span className="w-px h-3 bg-[#E5E2DD]" />
                      <span>{r.status || "En cours"}</span>
                      {r.maitrise && (
                        <>
                          <span className="w-px h-3 bg-[#E5E2DD]" />
                          <span>Maîtrise {r.maitrise}/5</span>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end shrink-0">
                    <span className="text-sm font-bold font-mono" style={{ color: style?.hex || "#172030" }}>
                      {score}
                    </span>
                    <span className="text-[9px] text-[#172030]/30 font-sans">
                      Score {vue === "brut" ? "brut" : "résiduel"}
                    </span>
                  </div>
                </div>
              );
            })}
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