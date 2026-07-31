import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  AlertTriangle, Activity, ShieldCheck, TrendingUp, 
  Zap, PieChart, Grid3x3, Sparkles, Circle, Clock,
  Users, Monitor, Handshake, Shield, FileText, Download
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { RiskData } from "../useRiskData";
import { scoreToNiveau } from "../riskModel";

type Props = {
  data: RiskData;
};

// Palette pastel adoucie et professionnelle (Minuscules pour le look moderne)
const niveauColors = {
  Critique: { bg: "#FEE2E2", text: "#B91C1C" }, // Rouge pastel
  Élevé: { bg: "#FED7AA", text: "#C2410C" },   // Orange pastel
  Modéré: { bg: "#FDE68A", text: "#A16207" },  // Jaune pastel
  Faible: { bg: "#D1FAE5", text: "#047857" },  // Vert pastel
};

export const ComexTab = ({ data }: Props) => {
  const { risques } = data;

  const enriched = useMemo(
    () => risques.map((r) => ({ 
      ...r, 
      niveauCalc: r.niveau || scoreToNiveau(r.score_residuel || 1) 
    })),
    [risques]
  );

  const total = enriched.length;
  const critiques = enriched.filter((r) => r.niveauCalc === "Critique").length;
  const eleves = enriched.filter((r) => r.niveauCalc === "Élevé").length;
  const moderes = enriched.filter((r) => r.niveauCalc === "Modéré").length;
  const faibles = enriched.filter((r) => r.niveauCalc === "Faible").length;
  
  const scoreMoyen = total ? (enriched.reduce((s, r) => s + (r.score_residuel || 0), 0) / total) : 0;
  const reduction = (() => {
    const brut = enriched.reduce((s, r) => s + (r.score_brut || 0), 0);
    const res = enriched.reduce((s, r) => s + (r.score_residuel || 0), 0);
    return brut ? Math.round(((brut - res) / brut) * 100) : 0;
  })();

  const topRisks = [...enriched]
    .sort((a, b) => (b.score_residuel || 0) - (a.score_residuel || 0))
    .slice(0, 5);

  // Matrice
  const matrix = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of enriched) {
      const key = `${r.probabilite}-${r.impact}`;
      map[key] = (map[key] || 0) + 1;
    }
    return map;
  }, [enriched]);

  const getCellColor = (score: number, count: number) => {
    if (count === 0) return { bg: "#F8F6F2", text: "#D1D5DB" };
    if (score <= 6) return { bg: "#D1FAE5", text: "#047857" };
    if (score <= 12) return { bg: "#FDE68A", text: "#A16207" };
    if (score <= 18) return { bg: "#FED7AA", text: "#C2410C" };
    return { bg: "#FEE2E2", text: "#B91C1C" };
  };

  const sansResponsable = enriched.filter(r => !r.owner || r.owner.trim() === "").length;
  const dernierCritique = enriched.find(r => r.niveauCalc === "Critique");

  return (
    <div className="max-w-[1400px] mx-auto p-4 space-y-5" style={{ backgroundColor: "#F5F3EF" }}>
      
      {/* ============================================================
          LIGNE 1 : HEADER
          ============================================================ */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl text-[#172030]">Tableau de bord Analyse des Risques</h2>
          <p className="text-sm text-[#172030]/50 mt-0.5">
            Vue globale du portefeuille de risques · {total} risques analysés
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select className="text-sm border border-[#172030]/10 rounded-lg px-3 py-1.5 bg-white text-[#172030]/60 focus:outline-none focus:ring-1 focus:ring-[#2A5141]">
            <option>Tous les risques</option>
          </select>
          <select className="text-sm border border-[#172030]/10 rounded-lg px-3 py-1.5 bg-white text-[#172030]/60 focus:outline-none focus:ring-1 focus:ring-[#2A5141]">
            <option>Par niveau</option>
          </select>
          <select className="text-sm border border-[#172030]/10 rounded-lg px-3 py-1.5 bg-white text-[#172030]/60 focus:outline-none focus:ring-1 focus:ring-[#2A5141]">
            <option>Par statut</option>
          </select>
          <Button variant="outline" size="sm" className="border-[#172030]/15 text-[#172030]/60 hover:bg-[#F8F6F2] gap-1.5">
            <Download className="h-3.5 w-3.5" />
            Exporter
          </Button>
        </div>
      </div>

      {/* ============================================================
          LIGNE 2 : 4 KPI
          ============================================================ */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="border-[#172030]/8 shadow-sm bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-[#172030]/40">Risques analysés</p>
                <p className="font-serif text-2xl font-bold text-[#172030]">{total}</p>
                <p className="text-[10px] text-[#172030]/30">Score moyen: {scoreMoyen.toFixed(1)}/25</p>
              </div>
              <div className="h-9 w-9 rounded-xl bg-[#172030]/5 flex items-center justify-center">
                <Activity className="h-4 w-4 text-[#172030]/40" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#172030]/8 shadow-sm bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-[#B91C1C]">Risques critiques</p>
                <p className="font-serif text-2xl font-bold text-[#B91C1C]">{critiques}</p>
                <p className="text-[10px] text-[#B91C1C]/50">Attention</p>
              </div>
              <div className="h-9 w-9 rounded-xl bg-[#FEE2E2] flex items-center justify-center">
                <AlertTriangle className="h-4 w-4 text-[#B91C1C]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#172030]/8 shadow-sm bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-[#172030]/40">Score moyen</p>
                <p className="font-serif text-2xl font-bold text-[#172030]">
                  {scoreMoyen.toFixed(1)}<span className="text-base text-[#172030]/30">/25</span>
                </p>
                <p className="text-[10px] text-[#047857]">En hausse</p>
              </div>
              <div className="h-9 w-9 rounded-xl bg-[#D1FAE5] flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-[#2A5141]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#172030]/8 shadow-sm bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-[#172030]/40">Couverture mesures</p>
                <p className="font-serif text-2xl font-bold text-[#172030]">0%</p>
                <p className="text-[10px] text-[#172030]/30">En cours</p>
              </div>
              <div className="h-9 w-9 rounded-xl bg-[#FEF3C7] flex items-center justify-center">
                <ShieldCheck className="h-4 w-4 text-[#A16207]" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ============================================================
          LIGNE 3 : TOP RISQUES + MATRICE (Tailes alignées, contenu centré)
          ============================================================ */}
      <div className="grid grid-cols-5 gap-3">
        
        {/* TOP RISQUES - Taille alignée sur la Matrice, contenu centré avec espacement parfait */}
        <Card className="border-[#172030]/8 shadow-sm bg-white col-span-3 h-full">
          <CardContent className="p-4 pt-3 h-full flex flex-col">
            
            {/* Header parfaitement aligné sur l'axe Y */}
            <div className="flex items-center justify-between mb-2 shrink-0">
              <div className="flex items-center gap-2 h-6">
                <Zap className="h-4 w-4 text-[#2A5141]" />
                <span className="font-serif text-[14px] font-medium text-[#172030] leading-none">Top risques</span>
              </div>
              <Badge variant="outline" className="text-[9px] bg-[#F3F4F6] border-[#E5E7EB] text-[#6B7280] hover:bg-[#E5E7EB] hover:text-[#374151] transition-colors rounded-full px-2.5 py-0.5 cursor-default h-6 flex items-center">
                Score
              </Badge>
            </div>
            
            {/* Conteneur de liste qui occupe tout l'espace et centre son contenu verticalement */}
            <div className="flex-1 flex flex-col justify-center gap-2">
              {topRisks.length === 0 ? (
                <div className="text-center py-4 text-[#172030]/20 text-sm">Aucun risque</div>
              ) : (
                topRisks.map((risk, i) => {
                  const niveau = risk.niveauCalc || "Faible";
                  const style = niveauColors[niveau as keyof typeof niveauColors] || niveauColors.Faible;

                  return (
                    <div key={risk.id} className="grid grid-cols-12 items-center gap-2 py-2 px-2 -mx-2 rounded-lg bg-white hover:bg-[#F8F6F2]/80 transition-colors cursor-default shadow-[0_1px_2px_rgba(0,0,0,0.02)] border border-transparent hover:border-[#172030]/5">
                      
                      {/* Col 1 : Rang */}
                      <div className="col-span-1 flex justify-end">
                        <span className="text-[12px] font-mono text-[#D1D5DB] w-4 text-right">{i + 1}</span>
                      </div>

                      {/* Col 2-6 : Titre */}
                      <div className="col-span-5">
                        <span className="text-[13px] font-medium text-[#111827] truncate block">{risk.title}</span>
                      </div>

                      {/* Col 7-8 : Badge Pastel */}
                      <div className="col-span-2">
                        <span 
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-medium border leading-none"
                          style={{ backgroundColor: style.bg, color: style.text, borderColor: style.text }}
                        >
                          {niveau.toLowerCase()}
                        </span>
                      </div>

                      {/* Col 9-12 : Score */}
                      <div className="col-span-4 flex justify-end">
                        <span className="font-mono text-[14px] font-bold" style={{ color: style.text }}>
                          {risk.score_residuel}
                        </span>
                      </div>

                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Matrice - 2 colonnes */}
        <Card className="border-[#172030]/8 shadow-sm bg-white col-span-2 h-full">
          <CardContent className="p-4 pt-3 h-full flex flex-col">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <div className="flex items-center gap-2 h-6">
                <Grid3x3 className="h-4 w-4 text-[#2A5141]" />
                <span className="font-serif text-[14px] font-medium text-[#172030] leading-none">Matrice</span>
              </div>
              <div className="flex items-center gap-2 h-6">
                <Badge variant="outline" className="text-[9px] border-[#172030]/15 text-[#172030]/40 rounded-full px-2.5 py-0.5 h-5 flex items-center">P × I</Badge>
                <span className="text-[10px] text-[#172030]/30">{total} risques</span>
              </div>
            </div>
            
            <div className="flex-1 flex flex-col justify-center">
              <div className="space-y-0.5 w-full">
                {/* En-tête colonnes */}
                <div className="flex gap-1 pl-5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex-1 text-center text-[7px] font-medium text-[#172030]/20">{i}</div>
                  ))}
                </div>
                
                {/* Lignes */}
                {[5, 4, 3, 2, 1].map((p) => (
                  <div key={p} className="flex gap-1 items-center">
                    <span className="w-4 text-[7px] font-medium text-[#172030]/20 text-right shrink-0">{p}</span>
                    {[1, 2, 3, 4, 5].map((i) => {
                      const score = p * i;
                      const key = `${p}-${i}`;
                      const count = matrix[key] || 0;
                      const style = getCellColor(score, count);
                      const isActive = count > 0;
                      return (
                        <div 
                          key={i} 
                          className={cn(
                            "flex-1 aspect-square rounded-md flex items-center justify-center transition-all",
                            isActive && "shadow-sm"
                          )}
                          style={{ backgroundColor: style.bg }}
                        >
                          {count > 0 ? (
                            <span className="text-[12px] font-bold" style={{ color: style.text }}>{count}</span>
                          ) : (
                            <span className="text-[8px] text-[#D1D5DB]">–</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex gap-3 mt-3 pt-2 border-t border-[#172030]/5 text-[7px] font-medium text-[#172030]/30 shrink-0">
              <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#D1FAE5]" />Faible</span>
              <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#FDE68A]" />Modéré</span>
              <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#FED7AA]" />Élevé</span>
              <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#FEE2E2]" />Critique</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ============================================================
          LIGNE 4 : REPARTITION + SYNTHESE IA + IMPACT
          ============================================================ */}
      <div className="grid grid-cols-12 gap-3">
        {/* Répartition - 3 colonnes */}
        <Card className="border-[#172030]/8 shadow-sm bg-white col-span-3">
          <CardContent className="p-4 pt-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 h-6">
                <PieChart className="h-4 w-4 text-[#2A5141]" />
                <span className="font-serif text-[14px] font-medium text-[#172030] leading-none">Répartition</span>
              </div>
              <span className="text-[10px] text-[#172030]/30 h-6 flex items-center">{total} total</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative h-[90px] w-[90px] shrink-0">
                <svg viewBox="0 0 200 200" className="h-full w-full">
                  {[
                    { value: critiques, color: "#FCA5A5" },
                    { value: eleves, color: "#FDBA74" },
                    { value: moderes, color: "#FCD34D" },
                    { value: faibles, color: "#A7F3D0" },
                  ].map((item, idx) => {
                    const percentage = total ? (item.value / total) * 100 : 0;
                    const angle = (percentage / 100) * 360;
                    const startAngle = idx === 0 ? 0 : [critiques, eleves, moderes, faibles].slice(0, idx).reduce((a, v) => a + (total ? (v / total) * 360 : 0), 0);
                    const endAngle = startAngle + angle;
                    const startRad = (startAngle - 90) * (Math.PI / 180);
                    const endRad = (endAngle - 90) * (Math.PI / 180);
                    const x1 = 100 + 80 * Math.cos(startRad);
                    const y1 = 100 + 80 * Math.sin(startRad);
                    const x2 = 100 + 80 * Math.cos(endRad);
                    const y2 = 100 + 80 * Math.sin(endRad);
                    const largeArc = angle > 180 ? 1 : 0;
                    return (
                      <path
                        key={idx}
                        d={item.value > 0 ? `M 100 100 L ${x1} ${y1} A 80 80 0 ${largeArc} 1 ${x2} ${y2} Z` : ""}
                        fill={item.value > 0 ? item.color : "transparent"}
                        stroke="white"
                        strokeWidth="2"
                      />
                    );
                  })}
                  <circle cx="100" cy="100" r="45" fill="white" />
                  <text x="100" y="95" textAnchor="middle" className="text-lg font-bold fill-[#172030]">{total}</text>
                  <text x="100" y="112" textAnchor="middle" className="text-[7px] fill-[#172030]/30">TOTAL</text>
                </svg>
              </div>
              <div className="flex-1 space-y-1">
                {[
                  { label: "Critique", value: critiques, color: "#FCA5A5" },
                  { label: "Élevé", value: eleves, color: "#FDBA74" },
                  { label: "Modéré", value: moderes, color: "#FCD34D" },
                  { label: "Faible", value: faibles, color: "#A7F3D0" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-0.5">
                    <div className="flex items-center gap-1.5">
                      <Circle className="h-1.5 w-1.5 fill-current shrink-0" style={{ color: item.color }} />
                      <span className="text-[#172030]/60 text-[9px] font-medium">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[#172030]/30 text-[9px]">{item.value}</span>
                      <span className="text-[#172030] font-medium text-[9px] w-8 text-right">
                        {total ? Math.round((item.value / total) * 100) : 0}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Synthèse IA - 5 colonnes */}
        <Card className="border-[#172030]/8 shadow-sm bg-white col-span-5">
          <CardContent className="p-4 pt-3">
            <div className="flex items-center gap-2 mb-3 h-6">
              <Sparkles className="h-4 w-4 text-[#2A5141]" />
              <span className="font-serif text-[14px] font-medium text-[#172030] leading-none">Synthèse IA</span>
            </div>
            <div className="space-y-2.5">
              <div className={cn(
                "flex items-center gap-3 p-2.5 rounded-xl border",
                critiques > 0 ? "bg-[#FEE2E2]/30 border-[#FCA5A5]/20" : "bg-[#D1FAE5]/30 border-[#A7F3D0]/20"
              )}>
                <div className={cn(
                  "h-8 w-8 rounded-xl flex items-center justify-center shrink-0",
                  critiques > 0 ? "bg-[#FEE2E2]" : "bg-[#D1FAE5]"
                )}>
                  {critiques > 0 ? (
                    <AlertTriangle className="h-3.5 w-3.5 text-[#B91C1C]" />
                  ) : (
                    <ShieldCheck className="h-3.5 w-3.5 text-[#047857]" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-[#172030]">
                    {critiques === 0 ? "Tous les risques sont maîtrisés" : `${critiques} risque${critiques > 1 ? 's' : ''} critique${critiques > 1 ? 's' : ''}`}
                  </p>
                  <p className="text-xs text-[#172030]/40">Score: {scoreMoyen.toFixed(1)}/25 • Réduction: {reduction}%</p>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div className="border border-[#172030]/5 rounded-lg text-center p-1.5">
                  <p className="text-sm font-bold text-[#172030]">{total}</p>
                  <p className="text-[7px] uppercase text-[#172030]/20 tracking-wider">Total</p>
                </div>
                <div className="border border-[#FEE2E2] bg-[#FEE2E2]/20 rounded-lg text-center p-1.5">
                  <p className="text-sm font-bold text-[#B91C1C]">{critiques}</p>
                  <p className="text-[7px] uppercase text-[#B91C1C]/50 tracking-wider">Critiques</p>
                </div>
                <div className="border border-[#D1FAE5] bg-[#D1FAE5]/20 rounded-lg text-center p-1.5">
                  <p className="text-sm font-bold text-[#047857]">{reduction}%</p>
                  <p className="text-[7px] uppercase text-[#047857]/50 tracking-wider">Réduction</p>
                </div>
                <div className="border border-[#FDE68A]/30 bg-[#FDE68A]/10 rounded-lg text-center p-1.5">
                  <p className="text-sm font-bold text-[#A16207]">{sansResponsable}</p>
                  <p className="text-[7px] uppercase text-[#A16207]/50 tracking-wider">Sans pilote</p>
                </div>
              </div>

              {dernierCritique && (
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#FEE2E2]/20 border border-[#FCA5A5]/10">
                  <div className="flex items-center gap-2 min-w-0">
                    <Clock className="h-3 w-3 text-[#B91C1C] shrink-0" />
                    <span className="text-xs text-[#B91C1C] truncate">
                      Dernier critique: {dernierCritique.title}
                    </span>
                  </div>
                  <Badge className="text-[8px] bg-[#FEE2E2] text-[#B91C1C] border-0 shrink-0 ml-2 rounded-full px-2 py-0.5">
                    Score: {dernierCritique.score_residuel}
                  </Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Impact - 4 colonnes */}
        <Card className="border-[#172030]/8 shadow-sm bg-white col-span-4">
          <CardContent className="p-4 pt-3">
            <div className="flex items-center justify-between mb-3 h-6">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-[#2A5141]" />
                <span className="font-serif text-[14px] font-medium text-[#172030] leading-none">Impact</span>
              </div>
              <Badge variant="outline" className="text-[7px] border-[#172030]/15 text-[#172030]/30 rounded-full px-2 py-0.5 h-5 flex items-center">Top 5</Badge>
            </div>
            <div className="space-y-1.5">
              {topRisks.slice(0, 5).map((risk) => {
                const brut = risk.score_brut || 0;
                const residuel = risk.score_residuel || 0;
                const reduction = brut > 0 ? Math.round(((brut - residuel) / brut) * 100) : 0;
                const maxVal = Math.max(...topRisks.map(r => r.score_brut || 0), 1);
                const niveau = risk.niveauCalc || "Faible";
                const style = niveauColors[niveau as keyof typeof niveauColors] || niveauColors.Faible;
                const color = style.text;

                return (
                  <div key={risk.id} className="flex items-center gap-2.5 h-6">
                    <span className="text-[9px] text-[#172030]/50 font-medium truncate w-[70px] shrink-0 leading-none">{risk.title}</span>
                    <div className="flex-1 h-2 rounded-full overflow-hidden bg-[#F8F6F2] relative">
                      <div 
                        className="absolute inset-y-0 left-0 rounded-full transition-all" 
                        style={{ width: `${(brut / maxVal) * 100}%`, backgroundColor: "#E5E5E5" }}
                      />
                      <div 
                        className="absolute inset-y-0 left-0 rounded-full transition-all" 
                        style={{ width: `${(residuel / maxVal) * 100}%`, backgroundColor: color, opacity: 0.8 }}
                      />
                      {brut > residuel && (
                        <div 
                          className="absolute inset-y-0 rounded-full transition-all" 
                          style={{ 
                            width: `${((brut - residuel) / maxVal) * 100}%`, 
                            backgroundColor: "#10b981", 
                            opacity: 0.25,
                            left: `${(residuel / maxVal) * 100}%`
                          }}
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[7px] text-[#172030]/20 line-through">{brut}</span>
                      <span className="text-[9px] font-bold leading-none" style={{ color }}>{residuel}</span>
                      <Badge 
                        className="text-[6px] border-0 px-1 py-0.5 rounded-full h-4 flex items-center" 
                        style={{ 
                          backgroundColor: reduction > 50 ? "#D1FAE5" : reduction > 25 ? "#FDE68A" : "#FEE2E2",
                          color: reduction > 50 ? "#047857" : reduction > 25 ? "#A16207" : "#B91C1C"
                        }}
                      >
                        -{reduction}%
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-3 pt-2 mt-1.5 border-t border-[#172030]/5 text-[6px] text-[#172030]/20">
              <span className="flex items-center gap-0.5"><div className="h-1 w-3 rounded-full bg-[#E5E5E5]" />Brut</span>
              <span className="flex items-center gap-0.5"><div className="h-1 w-3 rounded-full bg-[#2A5141] opacity-80" />Résiduel</span>
              <span className="flex items-center gap-0.5"><div className="h-1 w-3 rounded-full bg-[#10b981] opacity-40" />Réduction</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};