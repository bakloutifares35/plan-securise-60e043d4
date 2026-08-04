import { useState, useMemo, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  AlertTriangle, Activity, ShieldCheck, TrendingUp, 
  Zap, PieChart, Grid3x3, Sparkles, Circle, Clock,
  Users, FileText, Download, ChevronRight, Target, Info
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { RiskData } from "../useRiskData";
import { scoreToNiveau } from "../riskModel";

type Props = {
  data: RiskData;
};

type Measure = {
  id: string;
  risque_id: string;
  mesure: string;
};

// ============================================================
// CHARTE GRAPHIQUE RESILLIA PREMIUM
// ============================================================
const COLORS = {
  navy: "#172030",
  cream: "#F8F6F2",
  forest: "#2A5141",
  text: "#172030",
  muted: "#6C7A8A",
  border: "#E5E2DD",
  cardBg: "#FFFFFF",
  
  risk: {
    Critique: { bg: "#FDE8E8", text: "#A52A2A", border: "#EBC5C5", dot: "#A52A2A" },
    Élevé: { bg: "#FDEAD6", text: "#B2572A", border: "#F0D1B8", dot: "#B2572A" },
    Modéré: { bg: "#FDF3D6", text: "#A38730", border: "#F0E3B8", dot: "#A38730" },
    Faible: { bg: "#E5F0EB", text: "#1F4E39", border: "#C0D8CF", dot: "#1F4E39" },
  }
};

// ============================================================
// COMPOSANTS
// ============================================================

const ResilliaBadge = ({ level }: { level: string }) => {
  const style = COLORS.risk[level as keyof typeof COLORS.risk] || COLORS.risk.Faible;
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium border" style={{ backgroundColor: style.bg, color: style.text, borderColor: style.border }}>
      {level.toLowerCase()}
    </span>
  );
};

export const ComexTab = ({ data }: Props) => {
  const { risques } = data;
  const exportRef = useRef<HTMLDivElement>(null);

  // ============================
  // ÉTATS INTERACTIFS & FILTRES
  // ============================
  const [filterDirection, setFilterDirection] = useState<string>("all");
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedCell, setSelectedCell] = useState<{p: number, i: number} | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{p: number, i: number} | null>(null);

  // ============================
  // CHARGEMENT DES VRAIES MESURES (plans_traitement)
  // ============================
  const [allMeasures, setAllMeasures] = useState<Measure[]>([]);
  const [loadingMeasures, setLoadingMeasures] = useState(false);

  useEffect(() => {
    const loadMeasures = async () => {
      setLoadingMeasures(true);
      try {
        const { data: measuresData, error } = await supabase
          .from("plans_traitement")
          .select("id, risque_id, mesure");

        if (error) throw error;
        setAllMeasures(measuresData || []);
      } catch (error) {
        console.error("Erreur chargement mesures pour le dashboard:", error);
      } finally {
        setLoadingMeasures(false);
      }
    };
    loadMeasures();
  }, []);

  // ============================
  // LOGIQUE MÉTIER & CALCULS
  // ============================
  const enriched = useMemo(
    () => risques.map((r) => ({ 
      ...r, 
      niveauCalc: r.niveau || scoreToNiveau(r.score_residuel || 1) 
    })),
    [risques]
  );

  const filteredRisks = useMemo(() => {
    return enriched.filter(r => {
      const matchDir = filterDirection === "all" || r.direction === filterDirection;
      const matchLevel = filterLevel === "all" || r.niveauCalc === filterLevel;
      const matchStatus = filterStatus === "all" || (filterStatus === "owner" && r.owner && r.owner.trim() !== "") || (filterStatus === "no_owner" && (!r.owner || r.owner.trim() === ""));
      let matchCell = true;
      if (selectedCell) {
        matchCell = r.probabilite === selectedCell.p && r.impact === selectedCell.i;
      }
      return matchDir && matchLevel && matchStatus && matchCell;
    });
  }, [enriched, filterDirection, filterLevel, filterStatus, selectedCell]);

  const total = filteredRisks.length;
  const critiques = filteredRisks.filter((r) => r.niveauCalc === "Critique").length;
  const eleves = filteredRisks.filter((r) => r.niveauCalc === "Élevé").length;
  const moderes = filteredRisks.filter((r) => r.niveauCalc === "Modéré").length;
  const faibles = filteredRisks.filter((r) => r.niveauCalc === "Faible").length;
  
  const scoreMoyen = total ? (filteredRisks.reduce((s, r) => s + (r.score_residuel || 0), 0) / total) : 0;
  const reduction = (() => {
    const brut = filteredRisks.reduce((s, r) => s + (r.score_brut || 0), 0);
    const res = filteredRisks.reduce((s, r) => s + (r.score_residuel || 0), 0);
    return brut ? Math.round(((brut - res) / brut) * 100) : 0;
  })();

  // ============================
  // CALCUL DE LA COUVERTURE RÉELLE
  // ============================
  const risqueIdsAvecMesures = new Set(allMeasures.map(m => m.risque_id));
  const withMesures = filteredRisks.filter(r => risqueIdsAvecMesures.has(r.id)).length;
  const couvertureMesures = total > 0 ? Math.round((withMesures / total) * 100) : 0;

  const sansResponsable = filteredRisks.filter(r => !r.owner || r.owner.trim() === "").length;

  // ============================
  // INDICATEUR DE FRAÎCHEUR DES DONNÉES
  // ============================
  const lastUpdateDate = useMemo(() => {
    if (risques.length === 0) return null;
    const dates = risques.map(r => {
      if (r.updated_at) return new Date(r.updated_at);
      if (r.date_identification) return new Date(r.date_identification);
      return null;
    }).filter((d): d is Date => d !== null && !isNaN(d.getTime()));

    if (dates.length === 0) return null;
    const latest = new Date(Math.max(...dates.map(d => d.getTime())));
    return latest.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }, [risques]);

  // ============================
  // TOP RISQUES
  // ============================
  const topRisks = [...filteredRisks]
    .sort((a, b) => (b.score_residuel || 0) - (a.score_residuel || 0))
    .slice(0, 6);

  // ============================
  // DONNÉES MATRICE
  // ============================
  const matrix = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of filteredRisks) {
      const key = `${r.probabilite}-${r.impact}`;
      map[key] = (map[key] || 0) + 1;
    }
    return map;
  }, [filteredRisks]);

  const getCellColor = (score: number, count: number) => {
    if (count === 0) return { bg: "#F8F6F2", text: "#D1D5DB" };
    if (score <= 6) return COLORS.risk.Faible;
    if (score <= 12) return COLORS.risk.Modéré;
    if (score <= 18) return COLORS.risk.Élevé;
    return COLORS.risk.Critique;
  };

  const getRisksInCell = (p: number, i: number) => {
    return filteredRisks.filter(r => r.probabilite === p && r.impact === i);
  };

  // ============================
  // FONCTION EXPORT PDF
  // ============================
  const handleExportPDF = async () => {
    try {
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).default;
      
      if (exportRef.current) {
        const canvas = await html2canvas(exportRef.current, {
          scale: 2,
          backgroundColor: "#F8F6F2",
          logging: false,
        });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('l', 'mm', 'a3');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save('Resillia_Risques_Dashboard.pdf');
      }
    } catch (error) {
      console.error("Erreur lors de l'export PDF:", error);
    }
  };

  if (loadingMeasures) {
    return (
      <div className="max-w-[1440px] mx-auto p-6 bg-[#F8F6F2] min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center text-[#172030]/60">
          <Clock className="h-8 w-8 mb-2 animate-pulse" />
          <p className="font-sans text-sm">Chargement des actions de traitement...</p>
        </div>
      </div>
    );
  }

  // ============================================================
  // RENDU PRINCIPAL
  // ============================================================
  return (
    <div className="max-w-[1440px] mx-auto p-6 space-y-6 bg-[#F8F6F2] min-h-screen font-sans" ref={exportRef}>
      
      {/* ==========================================================
          HEADER & FILTRES ACTIFS + FRAÎCHEUR
          ========================================================== */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-serif text-3xl font-bold tracking-tight text-[#172030]">Analyse des Risques</h1>
          <p className="text-sm text-[#172030]/60 font-sans flex flex-col sm:flex-row sm:items-center gap-2">
            <span>Portefeuille actif · <span className="font-medium text-[#2A5141]">{risques.length} risques</span> identifiés</span>
            {lastUpdateDate && (
              <span className="text-[10px] text-[#172030]/40 bg-white px-2 py-0.5 rounded-full border border-[#E5E2DD] flex items-center gap-1 w-fit">
                <Clock className="h-3 w-3" /> Dernière MAJ : {lastUpdateDate}
              </span>
            )}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <select 
            className="text-sm border border-[#E5E2DD] rounded-lg px-3 py-1.5 bg-white text-[#172030] focus:outline-none focus:ring-1 focus:ring-[#2A5141] shadow-sm"
            value={filterDirection}
            onChange={(e) => setFilterDirection(e.target.value)}
          >
            <option value="all">Toutes directions</option>
            {Array.from(new Set(risques.map(r => r.direction).filter(Boolean))).map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <select 
            className="text-sm border border-[#E5E2DD] rounded-lg px-3 py-1.5 bg-white text-[#172030] focus:outline-none focus:ring-1 focus:ring-[#2A5141] shadow-sm"
            value={filterLevel}
            onChange={(e) => { setFilterLevel(e.target.value); setSelectedCell(null); }}
          >
            <option value="all">Tous niveaux</option>
            <option value="Critique">Critique</option>
            <option value="Élevé">Élevé</option>
            <option value="Modéré">Modéré</option>
            <option value="Faible">Faible</option>
          </select>
          <select 
            className="text-sm border border-[#E5E2DD] rounded-lg px-3 py-1.5 bg-white text-[#172030] focus:outline-none focus:ring-1 focus:ring-[#2A5141] shadow-sm"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">Tous statuts</option>
            <option value="owner">Avec pilote</option>
            <option value="no_owner">Sans pilote</option>
          </select>

          <Button onClick={handleExportPDF} variant="outline" size="sm" className="border-[#172030]/10 text-[#172030] hover:bg-[#F8F6F2] hover:text-[#2A5141] gap-1.5 shadow-sm bg-white">
            <Download className="h-4 w-4" />
            Exporter
          </Button>
        </div>
      </div>

      {/* ==========================================================
          LIGNE 1 : KPIs DYNAMIQUES (BORDURES NEUTRES, FONDS D'ICÔNES EN DÉGRADÉ)
          ========================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm bg-white rounded-xl">
          <CardContent className="p-5 flex justify-between items-start">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[#172030]/50 font-sans">Risques actifs</p>
              <div className="flex items-end gap-2 mt-1">
                <p className="font-serif text-3xl font-bold text-[#172030]">{total}</p>
                {selectedCell && <Badge variant="outline" className="text-[9px] border-[#2A5141] text-[#2A5141] bg-[#F8F6F2]">Cellule filtrée</Badge>}
              </div>
              <p className="text-[10px] text-[#172030]/40 mt-0.5 font-sans">Score moy. {scoreMoyen.toFixed(1)}/25</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#172030]/5 to-[#172030]/10 flex items-center justify-center">
              <Activity className="h-5 w-5 text-[#172030]/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-white rounded-xl">
          <CardContent className="p-5 flex justify-between items-start">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[#A52A2A]/70 font-sans">Risques critiques</p>
              <p className="font-serif text-3xl font-bold text-[#A52A2A] mt-1">{critiques + eleves}</p>
              <p className="text-[10px] text-[#A52A2A]/50 mt-0.5 font-sans">{total > 0 ? Math.round(((critiques+eleves)/total)*100) : 0}% du portefeuille</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#FDE8E8] to-[#FDE8E8]/60 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-[#A52A2A]" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-white rounded-xl">
          <CardContent className="p-5 flex justify-between items-start">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[#172030]/50 font-sans">Couverture mesures</p>
              <p className="font-serif text-3xl font-bold text-[#2A5141] mt-1">{couvertureMesures}%</p>
              <p className="text-[10px] text-[#2A5141]/60 mt-0.5 font-sans">{withMesures} risques couverts</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#2A5141]/10 to-[#2A5141]/5 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-[#2A5141]" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-white rounded-xl">
          <CardContent className="p-5 flex justify-between items-start">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[#172030]/50 font-sans">Réduction du risque</p>
              <p className="font-serif text-3xl font-bold text-[#172030] mt-1">{reduction}%</p>
              <p className="text-[10px] text-[#172030]/40 mt-0.5 font-sans">Écart Brut → Résiduel</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#F8F6F2] to-[#F8F6F2]/80 border border-[#172030]/10 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-[#2A5141]" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ==========================================================
          LIGNE 2 : TOP RISQUES + MATRICE
          ========================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
        
        {/* TOP RISQUES */}
        <Card className="border-0 shadow-sm bg-white rounded-xl lg:col-span-4 flex flex-col h-full">
          <CardHeader className="p-5 pb-2 border-b-2 border-b-[#2A5141]/20 border-[#F8F6F2]">
            <div className="flex items-center justify-between">
              <CardTitle className="font-serif text-[#172030] text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-[#2A5141]" />
                Top risques
              </CardTitle>
              <Badge variant="outline" className="text-[9px] border-[#E5E2DD] text-[#172030]/50 font-sans rounded-full px-2.5 py-0.5">Cliquez pour filtrer</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 flex-1 flex flex-col justify-center gap-1">
            {topRisks.length === 0 ? (
              <div className="text-center py-8 text-[#172030]/30 font-sans text-sm">Aucun risque ne correspond aux critères</div>
            ) : (
              topRisks.map((risk) => {
                const style = COLORS.risk[risk.niveauCalc as keyof typeof COLORS.risk] || COLORS.risk.Faible;
                const isActiveCell = selectedCell && risk.probabilite === selectedCell.p && risk.impact === selectedCell.i;

                return (
                  <div 
                    key={risk.id} 
                    onClick={() => setSelectedCell(selectedCell && selectedCell.p === risk.probabilite && selectedCell.i === risk.impact ? null : {p: risk.probabilite, i: risk.impact})}
                    className={cn(
                      "grid grid-cols-12 items-center gap-2 px-3 py-2.5 rounded-lg transition-all cursor-pointer border",
                      isActiveCell 
                        ? "bg-[#F8F6F2] border-[#2A5141] shadow-[0_2px_8px_rgba(42,81,65,0.15)]" 
                        : "bg-transparent border-transparent hover:bg-[#F8F6F2] hover:border-[#E5E2DD] hover:shadow-sm"
                    )}
                  >
                    <div className="col-span-6 md:col-span-5 flex items-center gap-3 min-w-0">
                      <div className={cn("h-2 w-2 rounded-full shrink-0", style.dot)} />
                      <span className="text-sm font-medium text-[#172030] truncate font-sans" title={risk.title}>{risk.title}</span>
                    </div>
                    <div className="col-span-3 md:col-span-3 flex justify-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-medium border" style={{ backgroundColor: style.bg, color: style.text, borderColor: style.border }}>
                        {risk.niveauCalc.toLowerCase()}
                      </span>
                    </div>
                    <div className="col-span-3 md:col-span-4 flex justify-end items-center gap-3">
                      <span className="text-[10px] font-mono text-[#172030]/40 hidden sm:block">P{risk.probabilite}×I{risk.impact}</span>
                      <span className="font-mono font-bold text-sm" style={{ color: style.text }}>{risk.score_residuel}</span>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* MATRICE AVEC LÉGENDE */}
        <Card className="border-0 shadow-sm bg-white rounded-xl lg:col-span-3 flex flex-col h-full">
          <CardHeader className="p-5 pb-0 border-b-2 border-b-[#2A5141]/20 border-[#F8F6F2] shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="font-serif text-[#172030] text-base flex items-center gap-2">
                <Grid3x3 className="h-4 w-4 text-[#2A5141]" />
                Matrice
              </CardTitle>
              <Badge variant="outline" className="text-[9px] border-[#E5E2DD] text-[#172030]/50 font-sans rounded-full px-2.5 py-0.5">{total} risques</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 flex-1 flex items-center justify-center flex-col gap-2">
            <div className="w-full max-w-[300px] space-y-0.5">
              <div className="flex gap-0.5 pl-5 mb-0.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex-1 text-center text-[8px] font-medium text-[#172030]/30 font-sans">{i}</div>
                ))}
              </div>
              {[5, 4, 3, 2, 1].map((p) => (
                <div key={p} className="flex gap-0.5 items-center h-8 md:h-9 relative group">
                  <span className="w-4 text-[8px] font-medium text-[#172030]/30 text-right pr-0.5 font-sans">{p}</span>
                  {[1, 2, 3, 4, 5].map((i) => {
                    const count = matrix[`${p}-${i}`] || 0;
                    const isSelected = selectedCell?.p === p && selectedCell?.i === i;
                    const style = getCellColor(p * i, count);
                    const hasRisks = count > 0;
                    const risksInCell = hasRisks ? getRisksInCell(p, i) : [];
                    
                    return (
                      <div 
                        key={i} 
                        onClick={hasRisks ? () => setSelectedCell(isSelected ? null : {p, i}) : undefined}
                        onMouseEnter={() => hasRisks && setHoveredCell({p, i})}
                        onMouseLeave={() => setHoveredCell(null)}
                        className={cn(
                          "flex-1 h-full rounded-md flex items-center justify-center transition-all relative",
                          hasRisks ? "cursor-pointer shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)] hover:shadow-md" : "cursor-not-allowed",
                          isSelected && "ring-2 ring-[#2A5141] ring-offset-1 bg-[#F8F6F2] shadow-[0_2px_8px_rgba(42,81,65,0.15)]"
                        )}
                        style={{ backgroundColor: hasRisks ? style.bg : "#F8F6F2" }}
                      >
                        {count > 0 ? (
                          <span className="text-xs font-bold" style={{ color: style.text }}>{count}</span>
                        ) : (
                          <span className="text-[10px] text-[#E5E2DD]">·</span>
                        )}

                        {/* Tooltip au survol */}
                        {hasRisks && hoveredCell?.p === p && hoveredCell?.i === i && (
                          <div className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full z-50 bg-[#172030] text-white text-[9px] px-2 py-1 rounded shadow-lg whitespace-nowrap pointer-events-none min-w-[100px]">
                            {risksInCell.map(r => (
                              <div key={r.id} className="truncate max-w-[150px]">{r.title}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Légende */}
            <div className="flex gap-2 pt-1.5 border-t border-[#F8F6F2] w-full justify-center text-[9px] font-medium text-[#172030]/50 font-sans flex-wrap">
              {[
                { label: "Faible", key: "Faible", color: COLORS.risk.Faible.bg },
                { label: "Modéré", key: "Modéré", color: COLORS.risk.Modéré.bg },
                { label: "Élevé", key: "Élevé", color: COLORS.risk.Élevé.bg },
                { label: "Critique", key: "Critique", color: COLORS.risk.Critique.bg },
              ].map((item) => (
                <button 
                  key={item.key}
                  onClick={() => {
                    setFilterLevel(filterLevel === item.key ? "all" : item.key);
                    setSelectedCell(null);
                  }}
                  className={cn(
                    "flex items-center gap-1 px-2 py-0.5 rounded-full transition-colors hover:bg-[#F8F6F2]",
                    filterLevel === item.key && "ring-1 ring-[#2A5141] bg-[#F8F6F2]"
                  )}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className={filterLevel === item.key ? "text-[#2A5141]" : ""}>{item.label}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ==========================================================
          LIGNE 3 : RÉPARTITION (DONUT REFONDU) + ÉTAT MESURES + IMPACT
          ========================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        
        {/* RÉPARTITION (Donut totalement retravaillé - Plus grand, plus contrasté, séparé) */}
        <Card className="border-0 shadow-sm bg-white rounded-xl col-span-12 md:col-span-3">
          <CardHeader className="p-5 pb-2 border-b-2 border-b-[#2A5141]/10">
            <div className="flex items-center justify-between">
              <CardTitle className="font-serif text-[#172030] text-base flex items-center gap-2">
                <PieChart className="h-4 w-4 text-[#2A5141]" />
                Répartition
              </CardTitle>
              <span className="text-[10px] text-[#172030]/40 font-sans">{total} total</span>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-2 flex flex-col justify-center h-[190px]">
             <div className="flex items-center gap-4 h-full">
               {/* Donut Chart agrandi */}
               <div className="relative h-28 w-28 shrink-0 cursor-pointer group" onClick={() => { setFilterLevel("all"); setSelectedCell(null); }}>
                 <svg viewBox="0 0 200 200" className="h-full w-full drop-shadow-sm">
                   {[
                     // Couleurs légèrement renforcées pour un meilleur contraste visuel entre elles
                     { value: critiques, color: "#FCA5A5", hoverColor: "#F87171", label: "Critique" },
                     { value: eleves, color: "#FDBA74", hoverColor: "#FB923C", label: "Élevé" },
                     { value: moderes, color: "#FCD34D", hoverColor: "#FBBF24", label: "Modéré" },
                     { value: faibles, color: "#A7F3D0", hoverColor: "#6EE7B7", label: "Faible" },
                   ].map((item, idx) => {
                     const isActive = filterLevel === item.label;
                     const percent = total ? (item.value / total) * 100 : 0;
                     const angle = (percent / 100) * 360;
                     const sA = idx === 0 ? 0 : [critiques, eleves, moderes, faibles].slice(0, idx).reduce((a, v) => a + (total ? (v / total) * 360 : 0), 0);
                     const eA = sA + angle;
                     const sR = (sA - 90) * (Math.PI / 180);
                     const eR = (eA - 90) * (Math.PI / 180);
                     const x1 = 100 + 80 * Math.cos(sR);
                     const y1 = 100 + 80 * Math.sin(sR);
                     const x2 = 100 + 80 * Math.cos(eR);
                     const y2 = 100 + 80 * Math.sin(eR);
                     const largeArc = angle > 180 ? 1 : 0;
                     return (
                       <g key={idx} onClick={() => setFilterLevel(isActive ? "all" : item.label)} className="cursor-pointer">
                         <path 
                           d={item.value > 0 ? `M 100 100 L ${x1} ${y1} A 80 80 0 ${largeArc} 1 ${x2} ${y2} Z` : ""} 
                           fill={item.value > 0 ? (isActive ? item.hoverColor : item.color) : "transparent"} 
                           stroke="white" strokeWidth="3" // Espace blanc pour séparer les parts
                           className={cn(
                             "transition-all duration-200 origin-center",
                             item.value > 0 && "hover:scale-105 hover:drop-shadow-md"
                           )} 
                         />
                       </g>
                     );
                   })}
                   <circle cx="100" cy="100" r="40" fill="white" />
                   <text x="100" y="93" textAnchor="middle" className="text-xl font-bold fill-[#172030] font-sans tracking-tight">{total}</text>
                   <text x="100" y="113" textAnchor="middle" className="text-[8px] fill-[#172030]/40 font-sans uppercase tracking-wider">TOTAL</text>
                 </svg>
               </div>
               
               {/* Légende alignée */}
               <div className="flex-1 flex flex-col justify-center space-y-1.5">
                 {[
                   { label: "Critique", value: critiques, color: "#FCA5A5" },
                   { label: "Élevé", value: eleves, color: "#FDBA74" },
                   { label: "Modéré", value: moderes, color: "#FCD34D" },
                   { label: "Faible", value: faibles, color: "#A7F3D0" },
                 ].map((item) => {
                   const isActive = filterLevel === item.label;
                   return (
                     <div key={item.label} onClick={() => setFilterLevel(isActive ? "all" : item.label)} className={cn("flex items-center justify-between px-1 py-1 rounded cursor-pointer transition-colors", isActive ? "bg-[#F8F6F2] ring-1 ring-[#2A5141]" : "hover:bg-[#F8F6F2]")}>
                       <div className="flex items-center gap-2">
                         <Circle className="h-2.5 w-2.5 fill-current shrink-0" style={{ color: item.color }} />
                         <span className="text-[10px] text-[#172030]/60 font-sans font-medium">{item.label}</span>
                       </div>
                       <span className="text-[10px] font-semibold text-[#172030] font-sans">{item.value}</span>
                     </div>
                   );
                 })}
               </div>
             </div>
          </CardContent>
        </Card>

        {/* ÉTAT D'AVANCEMENT DES PLANS D'ACTION */}
        <Card className="border-0 shadow-sm bg-white rounded-xl col-span-12 md:col-span-6">
          <CardHeader className="p-5 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="font-serif text-[#172030] text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#2A5141]" />
                Couverture des plans d'action
              </CardTitle>
              <Badge variant="outline" className="text-[9px] border-[#E5E2DD] text-[#172030]/50 font-sans rounded-full px-2.5 py-0.5">{couvertureMesures}% couvert</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 h-[180px] flex items-center justify-center relative">
            <div className="flex flex-col md:flex-row items-center justify-center gap-8 w-full">
              
              {/* Jauge Circulaire */}
              <div className="relative h-32 w-32 shrink-0">
                <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                  <circle cx="50" cy="50" r="44" fill="none" stroke="#F8F6F2" strokeWidth="8" />
                  <circle 
                    cx="50" cy="50" r="44" fill="none" stroke="#2A5141" strokeWidth="8" 
                    strokeLinecap="round" 
                    strokeDasharray={`${2 * Math.PI * 44}`} 
                    strokeDashoffset={`${2 * Math.PI * 44 * (1 - couvertureMesures / 100)}`} 
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-bold text-[#172030] font-sans">{couvertureMesures}%</span>
                  <span className="text-[9px] text-[#172030]/40 font-sans">de couverture</span>
                </div>
              </div>

              {/* Légende et chiffres clés */}
              <div className="flex flex-col gap-3 w-full max-w-[250px]">
                <div className="flex items-center justify-between border-b border-[#F8F6F2] pb-1.5">
                  <span className="text-xs text-[#172030]/60 font-sans">Risques avec mesures</span>
                  <span className="text-sm font-bold text-[#2A5141] font-sans">{withMesures}</span>
                </div>
                <div className="flex items-center justify-between border-b border-[#F8F6F2] pb-1.5">
                  <span className="text-xs text-[#172030]/60 font-sans">Risques sans mesures</span>
                  <span className="text-sm font-bold text-[#A52A2A] font-sans">{total - withMesures}</span>
                </div>
                <div className="flex items-center justify-between pt-0.5">
                  <span className="text-xs font-medium text-[#172030]/80 font-sans">Total risques</span>
                  <span className="text-sm font-bold text-[#172030] font-sans">{total}</span>
                </div>
              </div>

            </div>
          </CardContent>
        </Card>

        {/* IMPACT DES MESURES (Bordure gauche retirée) */}
        <Card className="border-0 shadow-sm bg-white rounded-xl col-span-12 md:col-span-3">
          <CardHeader className="p-5 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="font-serif text-[#172030] text-base flex items-center gap-2">
                <Target className="h-4 w-4 text-[#2A5141]" />
                Impact
              </CardTitle>
              <Badge variant="outline" className="text-[9px] border-[#E5E2DD] text-[#172030]/50 font-sans rounded-full px-2.5 py-0.5">Réduction</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 h-[180px] flex flex-col justify-center gap-2">
            {topRisks.slice(0, 5).map((risk) => {
              const brut = risk.score_brut || 0;
              const residuel = risk.score_residuel || 0;
              const reductionVal = brut > 0 ? Math.round(((brut - residuel) / brut) * 100) : 0;
              const maxVal = Math.max(...topRisks.map(r => r.score_brut || 0), 1);
              const style = COLORS.risk[risk.niveauCalc as keyof typeof COLORS.risk] || COLORS.risk.Faible;

              return (
                <div key={risk.id} className="flex flex-col gap-0.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-[#172030] font-sans font-medium truncate max-w-[100px]" title={risk.title}>{risk.title}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[8px] text-[#172030]/30 line-through font-mono">{brut}</span>
                      <span className="text-[10px] font-bold font-mono" style={{ color: style.text }}>{residuel}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                     <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-[#F8F6F2] relative">
                        <div className="absolute inset-y-0 left-0 bg-[#E5E2DD] rounded-full" style={{ width: `${(brut / maxVal) * 100}%` }} />
                        <div className="absolute inset-y-0 left-0 bg-[#2A5141] rounded-full" style={{ width: `${(residuel / maxVal) * 100}%`, opacity: 0.8 }} />
                     </div>
                     <span className="text-[8px] font-medium text-[#2A5141]/80 font-sans w-8 text-right">-{reductionVal}%</span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* ==========================================================
          LIGNE 4 : SYNTHÈSE IA
          ========================================================== */}
      <Card className="border-0 shadow-sm bg-[#F8F6F2] rounded-xl shadow-sm border-l-4 border-l-[#2A5141]/40">
        <CardContent className="p-5 flex flex-col md:flex-row md:items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-[#2A5141]/10 flex items-center justify-center shrink-0">
            <Sparkles className="h-5 w-5 text-[#2A5141]" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-medium text-[#172030]/50 uppercase tracking-wider font-sans">Synthèse IA</p>
            <p className="text-sm text-[#172030] mt-0.5 font-sans leading-relaxed">
              {total === 0 ? (
                "Aucun risque ne correspond aux filtres actuels."
              ) : critiques + eleves === 0 ? (
                `✅ Le portefeuille est globalement maîtrisé. Aucun risque Critique ou Élevé parmi les ${total} éléments actifs. Le score résiduel moyen est de ${scoreMoyen.toFixed(1)}/25.`
              ) : reduction > 30 ? (
                `⚠️ ${critiques + eleves} risque(s) critique(s) ou élevé(s) nécessite(nt) une attention immédiate. Le score résiduel moyen est de ${scoreMoyen.toFixed(1)}/25. Les mesures en place ont permis une réduction de ${reduction}% du risque.`
              ) : (
                `⚠️ Portefeuille à surveiller. ${critiques + eleves} risques critiques/élevés identifiés. Action recommandée. Taux de couverture des mesures à ${couvertureMesures}%.`
              )}
              {sansResponsable > 0 && ` ${sansResponsable} risque(s) n'ont pas de pilote assigné.`}
            </p>
          </div>
          <Button variant="outline" className="shrink-0 border-[#2A5141] text-[#2A5141] hover:bg-[#2A5141] hover:text-white transition-colors rounded-full px-5 font-sans text-xs">
            Voir le registre <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};