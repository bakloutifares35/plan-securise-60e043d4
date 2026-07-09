import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  LineChart,
  Line,
  Area,
  AreaChart,
  ComposedChart,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  FileText,
  Download,
  ShieldAlert,
  Clock,
  ChevronRight,
  Zap,
  Target,
  Building2,
  PieChart as PieChartIcon,
  AlertCircle,
  Calendar,
  Users,
  Server,
  Monitor,
  Handshake,
  Link as LinkIcon,
  Eye,
  MoreHorizontal,
  ArrowUp,
  ArrowDown,
  Minus,
} from "lucide-react";
import { useBia } from "@/contexts/BiaContext";
import { useGovernance } from "@/contexts/GovernanceContext";
import { computeMaxScore, scoreToCriticality, type Criticality } from "@/data/bia";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

// ============================================================
// CONSTANTES
// ============================================================

const LEVELS: Criticality[] = ["Critique", "Majeur", "Modéré", "Mineur"];

const SEVERITY_COLORS = {
  "Critique": "#FFEBEE",
  "Sévère": "#FBE9E7",
  "Majeur": "#FFF3E0",
  "Modéré": "#FFF8E1",
  "Mineur": "#E8F5E9",
};

const SEVERITY_TEXT_COLORS = {
  "Critique": "#C62828",
  "Sévère": "#D84315",
  "Majeur": "#E65100",
  "Modéré": "#F57F17",
  "Mineur": "#2E7D32",
};

const SEVERITY_BORDER_COLORS = {
  "Critique": "#EF9A9A",
  "Sévère": "#FFAB91",
  "Majeur": "#FFCC80",
  "Modéré": "#FFE082",
  "Mineur": "#A5D6A7",
};

const CHART_COLORS = {
  "Mineur": "#A5D6A7",
  "Modéré": "#FFE082",
  "Majeur": "#FFCC80",
  "Sévère": "#FFAB91",
  "Critique": "#EF9A9A",
};

const CHART_TEXT_COLORS = {
  "Mineur": "#2E7D32",
  "Modéré": "#F57F17",
  "Majeur": "#E65100",
  "Sévère": "#D84315",
  "Critique": "#C62828",
};

// ============================================================
// HELPER : récupère récursivement TOUS les descendants d'une entité
// (enfants, petits-enfants, arrière-petits-enfants...) 
// ============================================================
const getAllDescendantIds = (entities: any[], rootId: string): string[] => {
  const result: string[] = [];
  const stack = [rootId];
  while (stack.length > 0) {
    const currentId = stack.pop()!;
    const children = entities.filter(e => e.parentId === currentId);
    for (const child of children) {
      result.push(child.id);
      stack.push(child.id);
    }
  }
  return result;
};

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================

export const BiaDashboard = () => {
  const { processes, campaigns } = useBia();
  const { entities } = useGovernance();

  const [selectedEntity, setSelectedEntity] = useState<string>("all");
  const [selectedCriticality, setSelectedCriticality] = useState<string>("all");
  const [selectedDirection, setSelectedDirection] = useState<string>("all");

  const [historicalScores, setHistoricalScores] = useState<any[]>([]);
  const [isLoadingHistorical, setIsLoadingHistorical] = useState(true);

  useEffect(() => {
    const loadHistoricalData = async () => {
      setIsLoadingHistorical(true);
      try {
        const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];
        const data = months.map((month, index) => {
          const baseScore = 2.5 + Math.sin(index / 2) * 0.8 + (index / 20);
          return {
            month,
            score: Math.min(5, Math.max(1, baseScore)),
            processes: Math.floor(15 + Math.sin(index / 1.5) * 5 + index * 0.8),
          };
        });
        setHistoricalScores(data);
      } catch (error) {
        console.error("Erreur chargement historique:", error);
      } finally {
        setIsLoadingHistorical(false);
      }
    };
    loadHistoricalData();
  }, []);

  // Filtrage des processus (utilise aussi la version récursive pour le filtre "Direction")
  const filteredProcesses = useMemo(() => {
    let filtered = processes;
    if (selectedEntity !== "all") {
      filtered = filtered.filter((p) => p.entityId === selectedEntity);
    }
    if (selectedCriticality !== "all") {
      filtered = filtered.filter((p) => {
        const crit = scoreToCriticality(computeMaxScore(p.impacts));
        return crit === selectedCriticality;
      });
    }
    if (selectedDirection !== "all") {
      const descendantIds = getAllDescendantIds(entities, selectedDirection);
      filtered = filtered.filter((p) => 
        p.entityId === selectedDirection || descendantIds.includes(p.entityId)
      );
    }
    return filtered;
  }, [processes, selectedEntity, selectedCriticality, selectedDirection, entities]);

  // Calcul des statistiques
  const stats = useMemo(() => {
    const totals = LEVELS.reduce(
      (acc, l) => ({ ...acc, [l]: [] as typeof processes }),
      {} as Record<Criticality, typeof processes>
    );
    let stale = 0;
    let rtoIssues = 0;
    let noResources = 0;
    let totalResources = 0;
    let processesWithResources = 0;
    const now = Date.now();

    for (const p of filteredProcesses) {
      const c = scoreToCriticality(computeMaxScore(p.impacts));
      totals[c].push(p);
      
      const days = (now - new Date(p.lastUpdated).getTime()) / (1000 * 60 * 60 * 24);
      if (days > 365) stale++;
      if (p.rto > p.mtpd) rtoIssues++;
      
      const hasHR = p.resources?.some((r: any) => r.type === "HR") || false;
      const hasEquip = p.resources?.some((r: any) => r.type === "Equipement") || false;
      const hasApp = (p as any).appsCritiques?.length > 0 || false;
      const hasSupplier = p.resources?.some((r: any) => r.type === "Fournisseur") || false;
      
      const resourceCount = [hasHR, hasEquip, hasApp, hasSupplier].filter(Boolean).length;
      totalResources += resourceCount;
      if (resourceCount >= 2) processesWithResources++;
      if (resourceCount === 0) noResources++;
    }
    
    const criticalCount = totals.Critique.length + totals.Majeur.length;
    const total = filteredProcesses.length;
    const avgScore = total
      ? (filteredProcesses.reduce((acc, p) => acc + computeMaxScore(p.impacts), 0) / total).toFixed(1)
      : 0;
    
    const currentCampaign = campaigns.find((c) => c.status === "En cours");
    const coverage = currentCampaign
      ? Math.round((currentCampaign.processesCovered / currentCampaign.totalProcesses) * 100)
      : 0;

    return { 
      totals, 
      criticalCount, 
      total, 
      avgScore, 
      coverage, 
      stale, 
      rtoIssues,
      noResources,
      processesWithResources,
      totalResources,
    };
  }, [filteredProcesses, campaigns]);

  // Top processus critiques
  const topProcesses = useMemo(() => {
    return filteredProcesses
      .map((p) => {
        const score = computeMaxScore(p.impacts);
        const criticality = scoreToCriticality(score);
        const entity = entities.find(e => e.id === p.entityId);
        const daysSinceUpdate = (Date.now() - new Date(p.lastUpdated).getTime()) / (1000 * 60 * 60 * 24);
        return { 
          ...p, 
          score, 
          criticality, 
          entityName: entity?.name || "Sans direction",
          daysSinceUpdate: Math.round(daysSinceUpdate),
          rto: p.rto || 0,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [filteredProcesses, entities]);

  // ✅ CORRIGÉ : Répartition par direction (récursif, plus de niveaux)
  const directionData = useMemo(() => {
    const dirMap: Record<string, Record<string, number>> = {};
    
    // Les racines (Filiales/Entreprises) — on garde le libellé "direction" pour la carte
    // mais on descend maintenant récursivement à TOUS les niveaux d'enfants
    const roots = entities.filter(e => e.parentId === null);
    
    for (const root of roots) {
      const descendantIds = getAllDescendantIds(entities, root.id);
      const rootProcesses = filteredProcesses.filter(p => 
        p.entityId === root.id || descendantIds.includes(p.entityId)
      );
      
      if (rootProcesses.length === 0) continue;

      dirMap[root.name] = {
        "Mineur": 0,
        "Modéré": 0,
        "Majeur": 0,
        "Sévère": 0,
        "Critique": 0,
      };
      
      for (const p of rootProcesses) {
        const crit = scoreToCriticality(computeMaxScore(p.impacts));
        if (dirMap[root.name][crit] !== undefined) {
          dirMap[root.name][crit]++;
        }
      }
    }
    
    return Object.entries(dirMap).map(([name, values]) => ({
      name,
      ...values,
      total: Object.values(values).reduce((a, b) => a + b, 0),
    })).filter(d => d.total > 0);
  }, [filteredProcesses, entities]);

  // Alertes RTO
  const rtoAlerts = useMemo(() => {
    return filteredProcesses
      .filter(p => p.rto > p.mtpd)
      .map(p => ({
        ...p,
        entityName: entities.find(e => e.id === p.entityId)?.name || "Sans direction",
      }))
      .slice(0, 5);
  }, [filteredProcesses, entities]);

  // Points d'attention
  const attentionPoints = useMemo(() => {
    const points = [];
    const now = Date.now();
    
    const pendingBia = filteredProcesses.filter(p => p.status !== "Validé");
    if (pendingBia.length > 0) {
      points.push({
        icon: AlertTriangle,
        color: "text-amber-600",
        bg: "bg-amber-50",
        text: `${pendingBia.length} BIA non validé${pendingBia.length > 1 ? 's' : ''}`,
        action: "Réviser",
        link: `/bia/process/${pendingBia[0].id}`,
        severity: "high"
      });
    }

    const expiredPra = filteredProcesses.filter(p => {
      const days = (now - new Date(p.lastUpdated).getTime()) / (1000 * 60 * 60 * 24);
      return days > 365;
    });
    if (expiredPra.length > 0) {
      points.push({
        icon: Clock,
        color: "text-rose-600",
        bg: "bg-rose-50",
        text: `${expiredPra.length} PRA expiré${expiredPra.length > 1 ? 's' : ''}`,
        action: "Voir",
        link: `/bia/process/${expiredPra[0].id}`,
        severity: "critical"
      });
    }

    const noPca = filteredProcesses.filter(p => !p.hasPca && computeMaxScore(p.impacts) >= 3);
    if (noPca.length > 0) {
      points.push({
        icon: ShieldAlert,
        color: "text-orange-600",
        bg: "bg-orange-50",
        text: `${noPca.length} processus critique${noPca.length > 1 ? 's' : ''} sans PCA`,
        action: "Créer",
        link: `/bia/process/${noPca[0].id}`,
        severity: "high"
      });
    }

    if (stats.noResources > 0) {
      points.push({
        icon: AlertCircle,
        color: "text-red-600",
        bg: "bg-red-50",
        text: `${stats.noResources} processus sans aucune ressource associée`,
        action: "Lier",
        link: `/bia/process/${filteredProcesses.find(p => p.resources?.length === 0)?.id}`,
        severity: "critical"
      });
    }

    return points.slice(0, 4);
  }, [filteredProcesses, stats.noResources]);

  const pieData = LEVELS.map((level) => ({
    name: level,
    value: stats.totals[level].length,
    color: SEVERITY_COLORS[level as keyof typeof SEVERITY_COLORS],
    textColor: SEVERITY_TEXT_COLORS[level as keyof typeof SEVERITY_TEXT_COLORS],
    borderColor: SEVERITY_BORDER_COLORS[level as keyof typeof SEVERITY_BORDER_COLORS],
  })).filter((d) => d.value > 0);

  const scoreEvolutionData = useMemo(() => {
    const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];
    return months.map((month, index) => {
      const baseScore = 2.8 + Math.sin(index / 1.8) * 0.6 + (index / 25);
      return {
        month,
        score: Math.min(5, Math.max(1.5, baseScore)),
        trend: index > 0 ? (Math.min(5, Math.max(1.5, baseScore)) - Math.min(5, Math.max(1.5, baseScore - 0.3))) : 0,
      };
    });
  }, []);

  const handleProcessClick = (processId: string) => {
    window.dispatchEvent(new CustomEvent('openProcessDetail', { detail: { processId } }));
  };

  const levelBadgeClass = (level: string) => {
    const classes = {
      "Critique": "bg-[#FFEBEE] text-[#C62828] border-[#EF9A9A]",
      "Sévère": "bg-[#FBE9E7] text-[#D84315] border-[#FFAB91]",
      "Majeur": "bg-[#FFF3E0] text-[#E65100] border-[#FFCC80]",
      "Modéré": "bg-[#FFF8E1] text-[#F57F17] border-[#FFE082]",
      "Mineur": "bg-[#E8F5E9] text-[#2E7D32] border-[#A5D6A7]",
    };
    return classes[level as keyof typeof classes] || "bg-gray-100 text-gray-700 border-gray-200";
  };

  const getScoreColor = (score: number) => {
    if (score >= 4) return "text-[#C62828]";
    if (score >= 3) return "text-[#E65100]";
    if (score >= 2) return "text-[#F57F17]";
    return "text-[#2E7D32]";
  };

  const getScoreBg = (score: number) => {
    if (score >= 4) return "bg-[#FFEBEE]";
    if (score >= 3) return "bg-[#FFF3E0]";
    if (score >= 2) return "bg-[#FFF8E1]";
    return "bg-[#E8F5E9]";
  };

  const openProcessDetail = (processId: string) => {
    window.dispatchEvent(new CustomEvent('openProcessDetail', { detail: { processId } }));
  };

  return (
    <div className="bg-[#F8F6F2] min-h-screen p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ===== HEADER ===== */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#172030]" style={{ fontFamily: "Playfair Display, serif" }}>
              Tableau de bord BIA
            </h1>
            <p className="text-sm text-[#172030]/50">
              Vue globale de la continuité métier · {stats.total} processus analysés
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] font-medium text-[#172030]/40 uppercase tracking-wider">Direction</label>
              <Select value={selectedDirection} onValueChange={setSelectedDirection}>
                <SelectTrigger className="w-[140px] h-8 text-xs border-[#E8E4DC] bg-white">
                  <SelectValue placeholder="Toutes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  {entities.filter(e => e.parentId === null).map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] font-medium text-[#172030]/40 uppercase tracking-wider">Criticité</label>
              <Select value={selectedCriticality} onValueChange={setSelectedCriticality}>
                <SelectTrigger className="w-[120px] h-8 text-xs border-[#E8E4DC] bg-white">
                  <SelectValue placeholder="Toutes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  {LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>{level}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 border-[#E8E4DC] text-[#172030]/60 hover:text-[#172030]">
              <Download className="h-3.5 w-3.5" />
              Exporter
            </Button>
            <Button size="sm" className="h-8 gap-1.5 bg-[#2A5141] hover:bg-[#1a3329] text-white shadow-sm">
              <FileText className="h-3.5 w-3.5" />
              Nouveau BIA
            </Button>
          </div>
        </div>

        {/* ===== LIGNE 1: KPI ===== */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { 
              label: "Processus analysés", 
              value: stats.total, 
              icon: Activity, 
              color: "text-[#2A5141]", 
              bg: "bg-[#E8F5E9]", 
              sub: "Couverture BIA",
              subValue: `${stats.coverage}%`,
              trend: "+12%",
              trendUp: true,
            },
            { 
              label: "Processus critiques", 
              value: stats.criticalCount, 
              icon: AlertTriangle, 
              color: "text-[#C62828]", 
              bg: "bg-[#FFEBEE]", 
              sub: "Niveau critique",
              subValue: `${stats.criticalCount > 0 ? '⚠️ Attention' : '✅ OK'}`,
              trend: stats.criticalCount > 0 ? `+${stats.criticalCount}` : "0",
              trendUp: stats.criticalCount > 0,
            },
            { 
              label: "Score moyen", 
              value: `${stats.avgScore}/5`, 
              icon: TrendingUp, 
              color: "text-[#2E7D32]", 
              bg: "bg-[#E8F5E9]", 
              sub: "Tendance",
              subValue: `${stats.avgScore > 3 ? '↑ En hausse' : '→ Stable'}`,
              trend: `${stats.avgScore > 3 ? '+' : ''}${(Number(stats.avgScore) - 2.5).toFixed(1)}`,
              trendUp: Number(stats.avgScore) > 2.5,
            },
            { 
              label: "Couverture BIA", 
              value: `${stats.coverage}%`, 
              icon: CheckCircle2, 
              color: "text-[#2A5141]", 
              bg: "bg-[#E8F5E9]", 
              sub: "Objectif",
              subValue: "90%",
              trend: `${stats.coverage >= 90 ? '✅' : '⏳'}`,
              trendUp: stats.coverage >= 90,
            },
          ].map((kpi, index) => {
            const Icon = kpi.icon;
            return (
              <Card key={index} className="border-[#E8E4DC] shadow-sm bg-white hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-semibold text-[#172030]/40 uppercase tracking-wider">
                        {kpi.label}
                      </p>
                      <p className="text-2xl font-bold text-[#172030] mt-0.5" style={{ fontFamily: "Playfair Display, serif" }}>
                        {kpi.value}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-[#172030]/40">{kpi.sub}</span>
                        <span className="text-[10px] font-medium text-[#2A5141]">{kpi.subValue}</span>
                        {kpi.trend && (
                          <span className={cn(
                            "text-[10px] font-medium flex items-center gap-0.5",
                            kpi.trendUp ? "text-[#2E7D32]" : "text-[#C62828]"
                          )}>
                            {kpi.trendUp ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
                            {kpi.trend}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={`h-10 w-10 rounded-xl ${kpi.bg} flex items-center justify-center flex-shrink-0 ml-3`}>
                      <Icon className={`h-4.5 w-4.5 ${kpi.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* ===== LIGNE 2: Top processus + Donut + Évolution ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <Card className="lg:col-span-3 border-[#E8E4DC] shadow-sm bg-white flex flex-col">
            <CardHeader className="pb-2 flex-shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-[#172030] flex items-center gap-2" style={{ fontFamily: "Playfair Display, serif" }}>
                  <Target className="h-4 w-4 text-[#172030]/40" />
                  Top processus critiques
                </CardTitle>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-[#172030]/40 hover:text-[#172030]">
                  Voir tout <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0 px-4 pb-4">
              <div className="h-full flex flex-col">
                <div className="grid grid-cols-6 gap-2 py-1.5 border-b border-[#E8E4DC]">
                  <span className="text-[9px] font-medium text-[#172030]/40 uppercase tracking-wider col-span-2">Processus</span>
                  <span className="text-[9px] font-medium text-[#172030]/40 uppercase tracking-wider">Direction</span>
                  <span className="text-[9px] font-medium text-[#172030]/40 uppercase tracking-wider text-center">Score</span>
                  <span className="text-[9px] font-medium text-[#172030]/40 uppercase tracking-wider text-center">RTO</span>
                  <span className="text-[9px] font-medium text-[#172030]/40 uppercase tracking-wider text-center">Criticité</span>
                </div>
                <div className="flex-1 divide-y divide-[#E8E4DC]/50 overflow-y-auto">
                  {topProcesses.map((p, index) => {
                    const scorePercent = (p.score / 5) * 100;
                    return (
                      <div 
                        key={index} 
                        className="grid grid-cols-6 gap-2 py-2.5 items-center hover:bg-[#F8F6F2] rounded-lg transition-colors -mx-1 px-1 cursor-pointer"
                        onClick={() => openProcessDetail(p.id)}
                      >
                        <span className="text-sm font-medium text-[#172030] truncate col-span-2">{p.name}</span>
                        <span className="text-xs text-[#172030]/50 truncate flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {p.entityName}
                        </span>
                        <div className="flex items-center gap-1.5 justify-center">
                          <span className={cn("text-sm font-bold", getScoreColor(p.score))}>{p.score.toFixed(1)}</span>
                          <div className="w-10 h-1 bg-[#E8E4DC] rounded-full overflow-hidden">
                            <div 
                              className="h-full rounded-full transition-all"
                              style={{ 
                                width: `${scorePercent}%`,
                                backgroundColor: p.score >= 4 ? "#C62828" : p.score >= 3 ? "#E65100" : p.score >= 2 ? "#F57F17" : "#2E7D32"
                              }}
                            />
                          </div>
                        </div>
                        <span className="text-xs text-[#172030]/60 text-center font-mono">{p.rto}h</span>
                        <Badge className={cn("text-[9px] px-2 py-0.5 h-5 border text-center justify-center", levelBadgeClass(p.criticality))}>
                          {p.criticality}
                        </Badge>
                      </div>
                    );
                  })}
                  {topProcesses.length === 0 && (
                    <div className="flex items-center justify-center h-full text-sm text-[#172030]/30">
                      Aucun processus trouvé
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-1 border-[#E8E4DC] shadow-sm bg-white flex flex-col">
            <CardHeader className="pb-1 flex-shrink-0">
              <CardTitle className="text-sm font-semibold text-[#172030] flex items-center gap-2" style={{ fontFamily: "Playfair Display, serif" }}>
                <PieChartIcon className="h-4 w-4 text-[#172030]/40" />
                Criticité
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-0 px-3 pb-3">
              <div className="h-full flex flex-col items-center">
                <div className="relative w-[110px] h-[110px] flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={35}
                        outerRadius={52}
                        paddingAngle={2}
                        stroke="white"
                        strokeWidth={2}
                      >
                        {pieData.map((d) => (
                          <Cell key={d.name} fill={d.color} stroke={d.borderColor} strokeWidth={1} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-lg font-bold text-[#172030]" style={{ fontFamily: "Playfair Display, serif" }}>
                        {stats.total}
                      </p>
                      <p className="text-[8px] text-[#172030]/40 uppercase tracking-wider">Total</p>
                    </div>
                  </div>
                </div>
                <div className="w-full mt-2 space-y-1">
                  {pieData.map((d) => (
                    <div key={d.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color, border: `1px solid ${d.borderColor}` }} />
                        <span className="text-[10px] text-[#172030]/70">{d.name}</span>
                      </div>
                      <span className="text-[10px] font-medium text-[#172030]">
                        {d.value} ({((d.value / stats.total) * 100).toFixed(0)}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-1 border-[#E8E4DC] shadow-sm bg-white flex flex-col">
            <CardHeader className="pb-1 flex-shrink-0">
              <CardTitle className="text-sm font-semibold text-[#172030] flex items-center gap-2" style={{ fontFamily: "Playfair Display, serif" }}>
                <TrendingUp className="h-4 w-4 text-[#172030]/40" />
                Évolution
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-0 px-3 pb-3">
              <div className="h-full flex flex-col">
                <div className="flex-1 min-h-[80px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={scoreEvolutionData}>
                      <defs>
                        <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2A5141" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#2A5141" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="score"
                        stroke="#2A5141"
                        strokeWidth={2}
                        fill="url(#scoreGradient)"
                        dot={{ r: 2, fill: "#2A5141", strokeWidth: 1 }}
                      />
                      <XAxis 
                        dataKey="month" 
                        tick={{ fontSize: 8, fill: "#172030/40" }}
                        axisLine={false}
                        tickLine={false}
                        interval={1}
                      />
                      <YAxis 
                        domain={[1, 5]} 
                        tick={{ fontSize: 8, fill: "#172030/40" }}
                        axisLine={false}
                        tickLine={false}
                        width={20}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center justify-between text-[10px] text-[#172030]/40 mt-1 pt-1 border-t border-[#E8E4DC]">
                  <span>Score moyen</span>
                  <span className="font-medium text-[#2A5141]">{stats.avgScore}/5</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ===== LIGNE 3: Répartition par direction + Alertes RTO ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2 border-[#E8E4DC] shadow-sm bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-[#172030] flex items-center gap-2" style={{ fontFamily: "Playfair Display, serif" }}>
                <Building2 className="h-4 w-4 text-[#172030]/40" />
                Répartition par direction
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {directionData.length > 0 ? (
                <>
                  <div className="h-[180px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={directionData}
                        layout="vertical"
                        margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                      >
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: "#172030/60" }} width={90} />
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: "white",
                            border: "1px solid #E8E4DC",
                            borderRadius: "6px",
                            fontSize: "11px",
                            padding: "6px 10px",
                          }}
                        />
                        <Bar dataKey="Mineur" stackId="a" fill={CHART_COLORS.Mineur} />
                        <Bar dataKey="Modéré" stackId="a" fill={CHART_COLORS.Modéré} />
                        <Bar dataKey="Majeur" stackId="a" fill={CHART_COLORS.Majeur} />
                        <Bar dataKey="Sévère" stackId="a" fill={CHART_COLORS.Sévère} />
                        <Bar dataKey="Critique" stackId="a" fill={CHART_COLORS.Critique} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-3 mt-1">
                    {["Mineur", "Modéré", "Majeur", "Sévère", "Critique"].map((level) => (
                      <div key={level} className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[level as keyof typeof CHART_COLORS] }} />
                        <span className="text-[9px] text-[#172030]/50">{level}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-[180px] text-sm text-[#172030]/30">
                  Aucune donnée à afficher pour cette sélection
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-[#E8E4DC] shadow-sm bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-[#172030] flex items-center gap-2" style={{ fontFamily: "Playfair Display, serif" }}>
                <Clock className="h-4 w-4 text-[#C62828]" />
                Échéances & alertes
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {rtoAlerts.length > 0 ? (
                <div className="space-y-2">
                  {rtoAlerts.map((p, i) => (
                    <div 
                      key={i}
                      className="flex items-center justify-between p-2 rounded-lg bg-[#FFEBEE] border border-[#EF9A9A] cursor-pointer hover:bg-[#FFCDD2] transition-colors"
                      onClick={() => openProcessDetail(p.id)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <AlertCircle className="h-3.5 w-3.5 text-[#C62828] flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-[#172030] truncate">{p.name}</p>
                          <p className="text-[10px] text-[#C62828]">RTO {p.rto}h &gt; MTPD {p.mtpd}h</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="h-6 text-xs text-[#C62828] hover:text-[#C62828] hover:bg-[#FFCDD2] px-2 flex-shrink-0">
                        Voir
                      </Button>
                    </div>
                  ))}
                  {rtoAlerts.length > 3 && (
                    <p className="text-center text-[10px] text-[#172030]/40">
                      +{rtoAlerts.length - 3} autres alertes
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-[120px] text-sm text-[#172030]/30">
                  <CheckCircle2 className="h-5 w-5 text-[#2E7D32] mr-2" />
                  Aucune alerte RTO
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ===== LIGNE 4: Points d'attention ===== */}
        <Card className="border-[#E8E4DC] shadow-sm bg-white">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-[#172030] flex items-center gap-2" style={{ fontFamily: "Playfair Display, serif" }}>
                <Zap className="h-4 w-4 text-[#E65100]" />
                Points d'attention
              </CardTitle>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-[#172030]/40 hover:text-[#172030]">
                Voir tout <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {attentionPoints.map((point, index) => {
                const Icon = point.icon;
                const severityColors = {
                  critical: { border: "border-red-200", bg: "bg-red-50", text: "text-red-700" },
                  high: { border: "border-orange-200", bg: "bg-orange-50", text: "text-orange-700" },
                  medium: { border: "border-yellow-200", bg: "bg-yellow-50", text: "text-yellow-700" },
                  low: { border: "border-green-200", bg: "bg-green-50", text: "text-green-700" },
                };
                const sev = severityColors[point.severity as keyof typeof severityColors] || severityColors.medium;
                
                return (
                  <div 
                    key={index} 
                    className={cn(
                      "flex items-center justify-between gap-2 py-2.5 px-3 rounded-lg border transition-colors cursor-pointer hover:shadow-sm",
                      sev.border,
                      sev.bg,
                    )}
                    onClick={() => {
                      if (point.link) {
                        openProcessDetail(point.link.split('/').pop() || '');
                      }
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`h-7 w-7 rounded-lg ${sev.bg} flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`h-3.5 w-3.5 ${sev.text}`} />
                      </div>
                      <p className="text-xs text-[#172030] truncate">{point.text}</p>
                    </div>
                    <Button variant="ghost" size="sm" className={cn("h-6 text-xs px-2 flex-shrink-0", sev.text, "hover:bg-white/50")}>
                      {point.action}
                    </Button>
                  </div>
                );
              })}
              {attentionPoints.length === 0 && (
                <div className="flex items-center justify-center col-span-full py-4 text-sm text-[#172030]/30">
                  <CheckCircle2 className="h-5 w-5 text-[#2E7D32] mr-2" />
                  Aucune alerte — Tout est sous contrôle
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ===== LIGNE 5: Couverture des ressources ===== */}
        <Card className="border-[#E8E4DC] shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-[#172030] flex items-center gap-2" style={{ fontFamily: "Playfair Display, serif" }}>
              <LinkIcon className="h-4 w-4 text-[#172030]/40" />
              Couverture des ressources
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-[#F8F6F2] rounded-lg p-3 text-center">
                <p className="text-[10px] text-[#172030]/40 uppercase tracking-wider">Taux de couverture</p>
                <p className="text-2xl font-bold text-[#2A5141]" style={{ fontFamily: "Playfair Display, serif" }}>
                  {stats.total > 0 ? Math.round((stats.processesWithResources / stats.total) * 100) : 0}%
                </p>
                <p className="text-[10px] text-[#172030]/40">{stats.processesWithResources} / {stats.total} processus</p>
              </div>
              <div className="bg-[#F8F6F2] rounded-lg p-3 text-center">
                <p className="text-[10px] text-[#172030]/40 uppercase tracking-wider">Moyenne par processus</p>
                <p className="text-2xl font-bold text-[#172030]" style={{ fontFamily: "Playfair Display, serif" }}>
                  {stats.total > 0 ? (stats.totalResources / stats.total).toFixed(1) : 0}
                </p>
                <p className="text-[10px] text-[#172030]/40">ressources / processus</p>
              </div>
              <div className="bg-[#F8F6F2] rounded-lg p-3 text-center">
                <p className="text-[10px] text-[#172030]/40 uppercase tracking-wider">Avec ressource RH</p>
                <p className="text-2xl font-bold text-[#2A5141]" style={{ fontFamily: "Playfair Display, serif" }}>
                  {filteredProcesses.filter(p => p.resources?.some((r: any) => r.type === "HR")).length}
                </p>
                <p className="text-[10px] text-[#172030]/40">processus</p>
              </div>
              <div className="bg-[#F8F6F2] rounded-lg p-3 text-center">
                <p className="text-[10px] text-[#172030]/40 uppercase tracking-wider">Sans ressource</p>
                <p className="text-2xl font-bold text-[#C62828]" style={{ fontFamily: "Playfair Display, serif" }}>
                  {stats.noResources}
                </p>
                <p className="text-[10px] text-[#172030]/40">à compléter</p>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
};