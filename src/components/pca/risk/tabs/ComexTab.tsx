// src/components/pca/risk/tabs/ComexTab.tsx
import { useState, useMemo, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  AlertTriangle, Activity, ShieldCheck, TrendingUp, 
  Zap, PieChart, Grid3x3, Sparkles, Circle, Clock,
  Users, FileText, Download, ChevronRight, Target, Info,
  Eye, ArrowUpRight, RefreshCw, User, Building2,
  Gauge, BarChart3, Shield, AlertOctagon, CheckCircle,
  ArrowDown, ArrowUp, Minus, Layers, Fingerprint,
  ListChecks, ClipboardCheck, AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { RiskData } from "../useRiskData";
import { scoreToNiveau } from "../riskModel";
// Import Recharts pour un rendu PRO
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

type Props = {
  data: RiskData;
};

type Measure = {
  id: string;
  risque_id: string;
  mesure: string;
  avancement?: number;
};

// ============================================================
// CHARTE GRAPHIQUE RESILLIA PREMIUM (Pastel & PRO)
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
    Critique: { bg: "#FDE8E8", text: "#C62828", border: "#EBC5C5", dot: "#C62828", light: "#FFF5F5" },
    Élevé: { bg: "#FDEAD6", text: "#B2572A", border: "#F0D1B8", dot: "#B2572A", light: "#FFFAF5" },
    Modéré: { bg: "#FDF3D6", text: "#A38730", border: "#F0E3B8", dot: "#A38730", light: "#FFFDF5" },
    Faible: { bg: "#E5F0EB", text: "#1F4E39", border: "#C0D8CF", dot: "#1F4E39", light: "#F5FFF5" },
  },
  badge: {
    Critique: { bg: "#FDE8E8", text: "#C62828" },
    Élevé: { bg: "#FDEAD6", text: "#B2572A" },
    Modéré: { bg: "#FDF3D6", text: "#A38730" },
    Faible: { bg: "#E5F0EB", text: "#1F4E39" },
  },
  matrix: {
    Faible: "#E8F5E9",
    Modéré: "#FFF8E1",
    Élevé: "#FFE0B2",
    Critique: "#FFCDD2",
  },
  kpi: {
    light: { bg: "#FFFFFF", text: "#172030", iconBg: "#F0EDE8", border: "border-[#E5E2DD]" },
    green: { bg: "#FFFFFF", text: "#2E7D32", iconBg: "#E8F5E9", border: "border-emerald-200" },
    red: { bg: "#FFFFFF", text: "#C62828", iconBg: "#FFEBEE", border: "border-rose-200" },
    amber: { bg: "#FFFFFF", text: "#F57F17", iconBg: "#FFF8E1", border: "border-amber-200" },
    blue: { bg: "#FFFFFF", text: "#1A56DB", iconBg: "#EBF5FF", border: "border-blue-200" },
  }
};

// ============================================================
// COMPOSANT: KPI CARD
// ============================================================
const KpiCard = ({ 
  label, 
  value, 
  subValue, 
  description,
  icon: Icon, 
  color = "light",
  badge,
  className
}: { 
  label: string;
  value: string | number;
  subValue?: string;
  description?: string;
  icon: any;
  color?: "light" | "green" | "red" | "amber" | "blue";
  badge?: { label: string; color?: string };
  className?: string;
}) => {
  const colorStyles = {
    light: { bg: "#FFFFFF", text: "#172030", iconBg: "#F0EDE8", border: "border-[#E5E2DD]" },
    green: { bg: "#FFFFFF", text: "#2E7D32", iconBg: "#E8F5E9", border: "border-emerald-200" },
    red: { bg: "#FFFFFF", text: "#C62828", iconBg: "#FFEBEE", border: "border-rose-200" },
    amber: { bg: "#FFFFFF", text: "#F57F17", iconBg: "#FFF8E1", border: "border-amber-200" },
    blue: { bg: "#FFFFFF", text: "#1A56DB", iconBg: "#EBF5FF", border: "border-blue-200" },
  };

  const style = colorStyles[color] || colorStyles.light;

  return (
    <Card className={cn(
      "border shadow-sm rounded-xl transition-all hover:shadow-md bg-white",
      style.border,
      className
    )}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-medium uppercase tracking-wider text-[#172030]/40 font-sans">
                {label}
              </p>
              {badge && (
                <span className={cn(
                  "text-[8px] font-medium px-2 py-0.5 rounded-full",
                  badge.color || "bg-[#F8F6F2] text-[#172030]/50"
                )}>
                  {badge.label}
                </span>
              )}
            </div>
            <p className="font-serif text-2xl font-bold mt-0.5" style={{ color: style.text }}>
              {value}
            </p>
            {subValue && (
              <p className="text-[11px] text-[#172030]/50 mt-0.5 font-sans font-medium">
                {subValue}
              </p>
            )}
            {description && (
              <p className="text-[10px] text-[#172030]/40 mt-0.5 font-sans">
                {description}
              </p>
            )}
          </div>
          <div className={cn("h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0")} style={{ backgroundColor: style.iconBg }}>
            <Icon className={cn("h-4.5 w-4.5")} style={{ color: style.text }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// ============================================================
// COMPOSANT: Badge de niveau
// ============================================================
const RiskLevelBadge = ({ level, className }: { level: string; className?: string }) => {
  const style = COLORS.badge[level as keyof typeof COLORS.badge] || COLORS.badge.Faible;
  return (
    <span 
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium",
        className
      )} 
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {level.toLowerCase()}
    </span>
  );
};

// ============================================================
// COMPOSANT: ModernPieChart (RECHARTS - DESIGN DONUT PRO)
// ============================================================
const ModernPieChart = ({ 
  data, 
  total, 
  onSliceClick,
  activeLabel
}: { 
  data: { label: string; value: number; color: string; borderColor: string }[];
  total: number;
  onSliceClick: (label: string) => void;
  activeLabel: string | null;
}) => {
  
  const filteredData = data.filter(d => d.value > 0);
  
  if (filteredData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <div className="text-center">
          <p className="text-lg font-bold text-[#172030] font-sans">0</p>
          <p className="text-[8px] text-[#172030]/40 font-sans uppercase tracking-wider">Total</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-28 w-28 shrink-0 cursor-pointer">
      {/* Le graphique Donut avec Recharts */}
      <ResponsiveContainer width="100%" height="100%">
        <RePieChart>
          <Pie
            data={filteredData}
            cx="50%"
            cy="50%"
            innerRadius={38} // Le grand trou au centre
            outerRadius={52} // Épaisseur de l'anneau
            dataKey="value"
            stroke="none" // On gère la bordure via Cell
            onClick={(e) => onSliceClick(activeLabel === e.label ? "all" : e.label)}
          >
            {filteredData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.color}
                // Bordure fine et colorée pour le style de votre image
                stroke={entry.borderColor} 
                strokeWidth={1.5}
                // Effet de survol et de sélection
                className="transition-all duration-200 hover:opacity-90 hover:drop-shadow-sm"
              />
            ))}
          </Pie>
          {/* Texte Tooltip personnalisé ou suppression */}
          <Tooltip content={<div className="hidden"/>} />
        </RePieChart>
      </ResponsiveContainer>

      {/* Texte centré dans le trou de l'anneau */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-base font-bold font-sans text-[#172030] tracking-tight leading-none">
          {total}
        </span>
        <span className="text-[7px] font-medium text-[#172030]/40 font-sans uppercase tracking-wider mt-1">
          Total
        </span>
      </div>
    </div>
  );
};

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================
export const ComexTab = ({ data }: Props) => {
  const { risques } = data;
  const exportRef = useRef<HTMLDivElement>(null);

  // ============================
  // ÉTATS INTERACTIFS & FILTRES
  // ============================
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedCell, setSelectedCell] = useState<{p: number, i: number} | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{p: number, i: number} | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // ============================
  // LOGIQUE MÉTIER
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
      const matchLevel = filterLevel === "all" || r.niveauCalc === filterLevel;
      const matchStatus = filterStatus === "all" || (filterStatus === "owner" && r.owner && r.owner.trim() !== "") || (filterStatus === "no_owner" && (!r.owner || r.owner.trim() === ""));
      let matchCell = true;
      if (selectedCell) {
        matchCell = r.probabilite === selectedCell.p && r.impact === selectedCell.i;
      }
      return matchLevel && matchStatus && matchCell;
    });
  }, [enriched, filterLevel, filterStatus, selectedCell]);

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

  // ==========================================================
  // CORRECTION : LOGIQUE DE COUVERTURE (Utilisation des données Risques)
  // ==========================================================
  
  // On vérifie le champ 'mesures_existantes' directement dans l'objet risque
  const withMesures = filteredRisks.filter(r => {
    if (!r.mesures_existantes) return false;
    if (Array.isArray(r.mesures_existantes) && r.mesures_existantes.length === 0) return false;
    if (typeof r.mesures_existantes === 'string' && r.mesures_existantes.trim() === '') return false;
    return true;
  }).length;
  
  const couvertureMesures = total > 0 ? Math.round((withMesures / total) * 100) : 0;
  
  const sansResponsable = filteredRisks.filter(r => !r.owner || r.owner.trim() === "").length;

  const risquesCritiquesSansMesures = filteredRisks.filter(r => 
    (r.niveauCalc === "Critique" || r.niveauCalc === "Élevé") && 
    !(r.mesures_existantes && r.mesures_existantes.length > 0)
  ).length;

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
  // TOP RISQUES - LIMITÉ À 5
  // ============================
  const topRisks = [...filteredRisks]
    .sort((a, b) => (b.score_residuel || 0) - (a.score_residuel || 0))
    .slice(0, 5);

  // ============================
  // DONNÉES MATRICE
  // ============================
  const matrix = useMemo(() => {
    const map: Record<string, { count: number; risks: any[] }> = {};
    for (const r of filteredRisks) {
      const key = `${r.probabilite}-${r.impact}`;
      if (!map[key]) {
        map[key] = { count: 0, risks: [] };
      }
      map[key].count++;
      map[key].risks.push(r);
    }
    return map;
  }, [filteredRisks]);

  const getCellStyle = (p: number, i: number) => {
    const score = p * i;
    const cell = matrix[`${p}-${i}`];
    const count = cell?.count || 0;
    
    if (count === 0) {
      return { bg: "#F8F6F2", text: "#D1D5DB", border: "#F0EDE8" };
    }
    
    if (score <= 6) {
      return { bg: COLORS.matrix.Faible, text: "#1F4E39", border: "#C8E6C9" };
    } else if (score <= 12) {
      return { bg: COLORS.matrix.Modéré, text: "#A38730", border: "#FFE082" };
    } else if (score <= 18) {
      return { bg: COLORS.matrix.Élevé, text: "#B2572A", border: "#FFCC80" };
    } else {
      return { bg: COLORS.matrix.Critique, text: "#C62828", border: "#EF9A9A" };
    }
  };

  const getRisksInCell = (p: number, i: number) => {
    const cell = matrix[`${p}-${i}`];
    return cell?.risks || [];
  };

  // ============================
  // DONNÉES POUR LE PIE CHART (PASTEL AVEC BORDURE)
  // ============================
  const pieData = [
    { label: "Critique", value: critiques, color: "#FDE8E8", borderColor: "#EBC5C5" },
    { label: "Élevé", value: eleves, color: "#FDEAD6", borderColor: "#F0D1B8" },
    { label: "Modéré", value: moderes, color: "#FDF3D6", borderColor: "#F0E3B8" },
    { label: "Faible", value: faibles, color: "#E5F0EB", borderColor: "#C0D8CF" },
  ];

  // ============================
  // EXPORT PDF
  // ============================
  const handleExportPDF = async () => {
    setIsExporting(true);
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
    } finally {
      setIsExporting(false);
    }
  };

  const resetFilters = () => {
    setFilterLevel("all");
    setFilterStatus("all");
    setSelectedCell(null);
  };

  const hasActiveFilters = filterLevel !== "all" || filterStatus !== "all" || selectedCell !== null;

  // ============================================================
  // RENDU PRINCIPAL
  // ============================================================
  return (
    <div className="space-y-6" ref={exportRef}>
      
      {/* ==========================================================
          FILTRES - Style BIA Dashboard
          ========================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#172030]/40 font-sans">
            {risques.length} risque{risques.length > 1 ? 's' : ''} identifié{risques.length > 1 ? 's' : ''}
          </span>
          {lastUpdateDate && (
            <span className="text-xs text-[#172030]/40 flex items-center gap-1 bg-white px-2 py-0.5 rounded-full border border-[#E5E2DD]">
              <Clock className="h-3 w-3" /> MAJ {lastUpdateDate}
            </span>
          )}
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-white rounded-lg border border-[#E5E2DD] p-1 shadow-sm">
            <select 
              className="text-xs border-0 bg-transparent px-3 py-1.5 text-[#172030] focus:outline-none focus:ring-0"
              value={filterLevel}
              onChange={(e) => { setFilterLevel(e.target.value); setSelectedCell(null); }}
            >
              <option value="all">Niveau</option>
              <option value="Critique">Critique</option>
              <option value="Élevé">Élevé</option>
              <option value="Modéré">Modéré</option>
              <option value="Faible">Faible</option>
            </select>
            <div className="w-px h-5 bg-[#E5E2DD]" />
            <select 
              className="text-xs border-0 bg-transparent px-3 py-1.5 text-[#172030] focus:outline-none focus:ring-0"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">Statut</option>
              <option value="owner">Avec pilote</option>
              <option value="no_owner">Sans pilote</option>
            </select>
          </div>

          <Button 
            onClick={handleExportPDF} 
            variant="outline" 
            size="sm" 
            className="border-[#E5E2DD] text-[#172030]/60 hover:text-[#172030] hover:bg-[#F8F6F2] gap-1.5 bg-white shadow-sm"
            disabled={isExporting}
          >
            <Download className="h-4 w-4" />
            {isExporting ? "Export..." : "Exporter"}
          </Button>
        </div>
      </div>

      {/* ==========================================================
          LIGNE 1 : KPIs
          ========================================================== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard 
          label="Couverture plans"
          value={`${couvertureMesures}%`}
          subValue={`${withMesures} sur ${total} risques traités`}
          icon={ClipboardCheck}
          color="green"
          badge={{ label: "✅ Bonne", color: "bg-emerald-100 text-emerald-700" }}
        />

        <KpiCard 
          label="Sans plan d'action"
          value={total - withMesures}
          subValue={`dont ${risquesCritiquesSansMesures} critique${risquesCritiquesSansMesures > 1 ? 's' : ''}`}
          icon={AlertCircle}
          color="red"
          badge={{ label: "✅ OK", color: "bg-emerald-100 text-emerald-700" }}
        />

        <KpiCard 
          label="Risques suivis"
          value={total}
          subValue={`${withMesures} associé${withMesures > 1 ? 's' : ''} à une stratégie`}
          icon={ListChecks}
          color="blue"
        />

        <KpiCard 
          label="Risques critiques"
          value={critiques + eleves}
          subValue={`${couvertureMesures}% de couverture`}
          icon={AlertTriangle}
          color="red"
          badge={{ label: "⚠️ Attention", color: "bg-rose-100 text-rose-700" }}
        />
      </div>

      {/* ==========================================================
          LIGNE 2 : TOP RISQUES + MATRICE
          ========================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* TOP RISQUES */}
        <Card className="border-0 shadow-sm bg-white rounded-xl lg:col-span-7 flex flex-col h-[320px]">
          <CardHeader className="p-5 pb-2 border-b border-[#F8F6F2] flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-[#2A5141]/10 flex items-center justify-center">
                  <Zap className="h-4 w-4 text-[#2A5141]" />
                </div>
                <CardTitle className="font-serif text-[#172030] text-base">
                  Top risques à traiter
                </CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[9px] border-[#E5E2DD] text-[#172030]/40 font-sans">
                  {topRisks.length} affichés
                </Badge>
                <span className="text-[9px] text-[#172030]/30">Cliquez pour filtrer</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 flex-1 overflow-y-auto">
            {topRisks.length === 0 ? (
              <div className="flex items-center justify-center h-full text-[#172030]/30 font-sans text-sm">
                {hasActiveFilters ? "Aucun risque ne correspond aux critères" : "Aucun risque identifié"}
              </div>
            ) : (
              <div className="space-y-2">
                {topRisks.map((risk, index) => {
                  const style = COLORS.risk[risk.niveauCalc as keyof typeof COLORS.risk] || COLORS.risk.Faible;
                  const isActiveCell = selectedCell && risk.probabilite === selectedCell.p && risk.impact === selectedCell.i;

                  return (
                    <div 
                      key={risk.id} 
                      onClick={() => setSelectedCell(isActiveCell ? null : {p: risk.probabilite, i: risk.impact})}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-xl border transition-all duration-200 cursor-pointer group",
                        isActiveCell 
                          ? "bg-[#F8F6F2] border-[#2A5141] shadow-[0_2px_8px_rgba(42,81,65,0.12)]" 
                          : "bg-white border-[#F0EDE8] hover:border-[#2A5141]/30 hover:shadow-sm hover:-translate-y-0.5"
                      )}
                    >
                      <div className="flex items-center justify-center h-6 w-6 rounded-full bg-[#F8F6F2] text-[10px] font-medium text-[#172030]/40 flex-shrink-0">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-[#172030] truncate">{risk.title}</p>
                          <RiskLevelBadge level={risk.niveauCalc} />
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-[#172030]/40">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {risk.owner || "Non assigné"}
                          </span>
                          <span className="text-[#172030]/20">·</span>
                          <span className="font-mono">P{risk.probabilite}×I{risk.impact}</span>
                          <span className="text-[#172030]/20">·</span>
                          <span>{risk.categorie || "Non catégorisé"}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="font-mono font-bold text-sm" style={{ color: style.text }}>
                          {risk.score_residuel}
                        </span>
                        <ChevronRight className={cn(
                          "h-4 w-4 transition-all",
                          isActiveCell ? "text-[#2A5141]" : "text-[#172030]/20 group-hover:text-[#172030]/50"
                        )} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* MATRICE */}
        <Card className="border-0 shadow-sm bg-white rounded-xl lg:col-span-5 flex flex-col h-[320px]">
          <CardHeader className="p-5 pb-2 border-b border-[#F8F6F2] shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-[#2A5141]/10 flex items-center justify-center">
                  <Grid3x3 className="h-4 w-4 text-[#2A5141]" />
                </div>
                <CardTitle className="font-serif text-[#172030] text-base">
                  Matrice des risques
                </CardTitle>
              </div>
              <Badge variant="outline" className="text-[9px] border-[#E5E2DD] text-[#172030]/40 font-sans">
                {total} risques
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 flex-1 flex flex-col items-center justify-center">
            <div className="w-full max-w-[280px]">
              <div className="flex gap-0.5 pl-6 mb-0.5">
                <div className="w-5 flex-shrink-0"></div>
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex-1 text-center text-[8px] font-medium text-[#172030]/30 font-sans">I{i}</div>
                ))}
              </div>
              
              {[5, 4, 3, 2, 1].map((p) => (
                <div key={p} className="flex gap-0.5 items-center h-8 md:h-9 relative group">
                  <span className="w-5 text-[8px] font-medium text-[#172030]/30 text-right pr-1 font-sans flex-shrink-0">P{p}</span>
                  {[1, 2, 3, 4, 5].map((i) => {
                    const cell = matrix[`${p}-${i}`];
                    const count = cell?.count || 0;
                    const isSelected = selectedCell?.p === p && selectedCell?.i === i;
                    const style = getCellStyle(p, i);
                    const hasRisks = count > 0;
                    const risksInCell = hasRisks ? getRisksInCell(p, i) : [];
                    
                    return (
                      <div 
                        key={i} 
                        onClick={hasRisks ? () => setSelectedCell(isSelected ? null : {p, i}) : undefined}
                        onMouseEnter={() => hasRisks && setHoveredCell({p, i})}
                        onMouseLeave={() => setHoveredCell(null)}
                        className={cn(
                          "flex-1 h-full rounded-md flex items-center justify-center transition-all duration-200 relative",
                          hasRisks ? "cursor-pointer hover:scale-105 hover:shadow-md" : "cursor-not-allowed opacity-30",
                          isSelected && "ring-2 ring-[#2A5141] ring-offset-1 shadow-[0_2px_8px_rgba(42,81,65,0.20)]"
                        )}
                        style={{ 
                          backgroundColor: hasRisks ? style.bg : "#F8F6F2",
                          border: hasRisks ? `1px solid ${style.border}` : "1px solid transparent"
                        }}
                      >
                        {count > 0 ? (
                          <span className="text-xs font-bold" style={{ color: style.text }}>{count}</span>
                        ) : (
                          <span className="text-[10px] text-[#E5E2DD]">·</span>
                        )}

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

            <div className="flex gap-3 pt-2 border-t border-[#F8F6F2] w-full justify-center text-[9px] font-medium text-[#172030]/50 font-sans flex-wrap">
              {[
                { label: "Faible", key: "Faible", color: COLORS.matrix.Faible },
                { label: "Modéré", key: "Modéré", color: COLORS.matrix.Modéré },
                { label: "Élevé", key: "Élevé", color: COLORS.matrix.Élevé },
                { label: "Critique", key: "Critique", color: COLORS.matrix.Critique },
              ].map((item) => (
                <button 
                  key={item.key}
                  onClick={() => {
                    setFilterLevel(filterLevel === item.key ? "all" : item.key);
                    setSelectedCell(null);
                  }}
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-0.5 rounded-full transition-colors hover:bg-[#F8F6F2]",
                    filterLevel === item.key && "ring-1 ring-[#2A5141] bg-[#F8F6F2]"
                  )}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className={filterLevel === item.key ? "text-[#2A5141]" : ""}>{item.label}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ==========================================================
          LIGNE 3 : RÉPARTITION + COUVERTURE + IMPACT
          ========================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        
        {/* RÉPARTITION - ModernPieChart avec Recharts (Design Anneau) */}
        <Card className="border-0 shadow-sm bg-white rounded-xl col-span-12 md:col-span-3">
          <CardHeader className="p-4 pb-2 border-b border-[#F8F6F2]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-[#2A5141]/10 flex items-center justify-center">
                  <PieChart className="h-3.5 w-3.5 text-[#2A5141]" />
                </div>
                <CardTitle className="font-serif text-[#172030] text-sm">
                  Répartition
                </CardTitle>
              </div>
              <span className="text-[10px] text-[#172030]/40 font-sans">{total} total</span>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-3 flex items-center gap-3">
            {/* Le graphique DONUT PRO */}
            <ModernPieChart 
              data={pieData}
              total={total}
              onSliceClick={(label) => {
                if (label === "all") {
                  setFilterLevel("all");
                  setSelectedCell(null);
                } else {
                  setFilterLevel(filterLevel === label ? "all" : label);
                  setSelectedCell(null);
                }
              }}
              activeLabel={filterLevel !== "all" ? filterLevel : null}
            />
            
            {/* La liste des risques à côté */}
            <div className="flex-1 flex flex-col justify-center space-y-1.5">
              {pieData.map((item) => {
                const isActive = filterLevel === item.label;
                return (
                  <div 
                    key={item.label} 
                    onClick={() => {
                      setFilterLevel(isActive ? "all" : item.label);
                      setSelectedCell(null);
                    }} 
                    className={cn(
                      "flex items-center justify-between px-2 py-1 rounded-md cursor-pointer transition-all duration-200",
                      isActive ? "bg-[#F8F6F2] ring-1 ring-[#2A5141]" : "hover:bg-[#F8F6F2]"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-[11px] text-[#172030]/60 font-sans font-medium">{item.label}</span>
                    </div>
                    <span className="text-xs font-bold text-[#172030] font-sans">{item.value}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* COUVERTURE - CORRIGÉ POUR AFFICHER 0% CORRECTEMENT */}
        <Card className="border-0 shadow-sm bg-white rounded-xl col-span-12 md:col-span-6">
          <CardHeader className="p-4 pb-2 border-b border-[#F8F6F2]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-[#2A5141]/10 flex items-center justify-center">
                  <ShieldCheck className="h-3.5 w-3.5 text-[#2A5141]" />
                </div>
                <CardTitle className="font-serif text-[#172030] text-sm">
                  Couverture des plans d'action
                </CardTitle>
              </div>
              <Badge variant="outline" className="text-[9px] border-[#E5E2DD] text-[#172030]/40 font-sans rounded-full px-2.5 py-0.5">
                {couvertureMesures}% couvert
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 flex items-center justify-between">
            
            {/* GRAPHIQUE CIRCULAIRE CORRIGÉ */}
            <div className="relative h-28 w-28 shrink-0 group">
              <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90 transition-all duration-1000 group-hover:scale-105">
                {/* Le fond gris clair (seulement si on a au moins 1% de couverture pour éviter le bug "cercle invisible") */}
                {couvertureMesures > 0 && (
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#F8F6F2" strokeWidth="7" />
                )}
                
                {/* La barre de progression verte */}
                {couvertureMesures > 0 && (
                  <circle 
                    cx="50" cy="50" r="40" fill="none" stroke="#2A5141" strokeWidth="7" 
                    strokeLinecap="round" 
                    strokeDasharray={`${2 * Math.PI * 40}`} 
                    strokeDashoffset={`${2 * Math.PI * 40 * (1 - couvertureMesures / 100)}`} 
                    className="transition-all duration-1000 ease-out"
                  />
                )}
              </svg>
              
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={cn(
                  "text-xl font-bold font-sans transition-all duration-300 group-hover:scale-110",
                  couvertureMesures > 0 ? "text-[#172030]" : "text-[#172030]" // Reste noir même à 0%
                )}>
                  {couvertureMesures}%
                </span>
                <span className="text-[8px] text-[#172030]/40 font-sans">couvert</span>
              </div>
            </div>

            <div className="flex-1 flex flex-col gap-2 pl-4">
              <div className="flex items-center justify-between border-b border-[#F8F6F2] pb-1.5">
                <span className="text-xs text-[#172030]/60 font-sans flex items-center gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5 text-[#2A5141]" />
                  Avec mesures
                </span>
                <span className="text-sm font-bold text-[#2A5141] font-sans">{withMesures}</span>
              </div>
              <div className="flex items-center justify-between border-b border-[#F8F6F2] pb-1.5">
                <span className="text-xs text-[#172030]/60 font-sans flex items-center gap-1.5">
                  <AlertOctagon className="h-3.5 w-3.5 text-[#C62828]" />
                  Sans mesures
                </span>
                <span className="text-sm font-bold text-[#C62828] font-sans">{total - withMesures}</span>
              </div>
              <div className="flex items-center justify-between pt-0.5">
                <span className="text-xs font-medium text-[#172030]/80 font-sans">Total</span>
                <span className="text-sm font-bold text-[#172030] font-sans">{total}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* IMPACT */}
        <Card className="border-0 shadow-sm bg-white rounded-xl col-span-12 md:col-span-3">
          <CardHeader className="p-4 pb-2 border-b border-[#F8F6F2]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-[#2A5141]/10 flex items-center justify-center">
                  <Target className="h-3.5 w-3.5 text-[#2A5141]" />
                </div>
                <CardTitle className="font-serif text-[#172030] text-sm">
                  Impact
                </CardTitle>
              </div>
              <Badge variant="outline" className="text-[9px] border-[#E5E2DD] text-[#172030]/40 font-sans rounded-full px-2.5 py-0.5">
                {reduction}% réduction
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 flex flex-col justify-center gap-2">
            {topRisks.slice(0, 5).map((risk) => {
              const brut = risk.score_brut || 0;
              const residuel = risk.score_residuel || 0;
              const reductionVal = brut > 0 ? Math.round(((brut - residuel) / brut) * 100) : 0;
              const maxVal = Math.max(...topRisks.map(r => r.score_brut || 0), 1);
              const style = COLORS.risk[risk.niveauCalc as keyof typeof COLORS.risk] || COLORS.risk.Faible;

              return (
                <div key={risk.id} className="flex flex-col gap-0.5 group">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-[#172030] font-sans font-medium truncate max-w-[90px] group-hover:text-[#2A5141] transition-colors" title={risk.title}>
                      {risk.title}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[8px] text-[#172030]/30 line-through font-mono">{brut}</span>
                      <span className="text-[10px] font-bold font-mono transition-colors group-hover:scale-110" style={{ color: style.text }}>{residuel}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                     <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-[#F8F6F2] relative group-hover:h-2 transition-all">
                        <div className="absolute inset-y-0 left-0 bg-[#E5E2DD] rounded-full transition-all" style={{ width: `${(brut / maxVal) * 100}%` }} />
                        <div className="absolute inset-y-0 left-0 bg-[#2A5141] rounded-full transition-all group-hover:opacity-100" style={{ width: `${(residuel / maxVal) * 100}%`, opacity: 0.7 }} />
                     </div>
                     {reductionVal > 0 && (
                       <span className="text-[8px] font-medium text-[#2A5141]/80 font-sans w-8 text-right transition-all group-hover:font-bold">
                         -{reductionVal}%
                       </span>
                     )}
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
      <Card className="border-0 shadow-sm bg-white rounded-xl border-l-4 border-l-[#2A5141] overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#2A5141]/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <CardContent className="p-5 flex flex-col md:flex-row md:items-center gap-4 relative">
          <div className="h-10 w-10 rounded-xl bg-[#2A5141]/10 flex items-center justify-center shrink-0 transition-all group-hover:scale-105">
            <Sparkles className="h-5 w-5 text-[#2A5141]" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-medium text-[#172030]/50 uppercase tracking-wider font-sans flex items-center gap-2">
              <span>Synthèse IA</span>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#2A5141] animate-pulse" />
            </p>
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
          <Button variant="outline" className="shrink-0 border-[#2A5141] text-[#2A5141] hover:bg-[#2A5141] hover:text-white transition-colors rounded-full px-5 font-sans text-xs group">
            Voir le registre 
            <ChevronRight className="h-3 w-3 ml-1 transition-transform group-hover:translate-x-0.5" />
          </Button>
        </CardContent>
      </Card>

      {/* ==========================================================
          LIGNE 5 : Widget d'activité
          ========================================================== */}
      <Card className="border-[#E8E4DC] shadow-sm bg-white rounded-xl">
        <CardContent className="p-3 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <div className="absolute inset-0 h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping opacity-75" />
              </div>
              <span className="text-xs text-[#172030]/50 font-medium">Opérationnel</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#172030]/40">
              <Clock className="h-3.5 w-3.5" />
              {new Date().toLocaleTimeString('fr-FR')}
            </div>
            <div className="flex items-center gap-2 text-xs text-[#172030]/40">
              <Activity className="h-3.5 w-3.5" />
              <span className="font-medium text-[#172030]">{total}</span> actifs
            </div>
            <div className="flex items-center gap-2 text-xs text-[#172030]/40">
              <AlertTriangle className="h-3.5 w-3.5 text-[#C62828]" />
              <span className="font-medium text-[#C62828]">{critiques + eleves}</span> critiques/élevés
            </div>
            <div className="flex items-center gap-2 text-xs text-[#172030]/40">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              <span className="font-medium text-emerald-600">{couvertureMesures}%</span> couvert
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="text-[10px] text-[#2A5141] hover:text-[#1a3329] hover:bg-[#F8F6F2] h-7 px-3" onClick={resetFilters}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                Réinitialiser
              </Button>
            )}
            <Button variant="ghost" size="sm" className="text-[10px] text-[#172030]/40 hover:text-[#172030] h-7 px-3" onClick={() => window.location.reload()}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Actualiser
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};