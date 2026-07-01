import { useMemo, useState } from "react";
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
} from "lucide-react";
import { useBia } from "@/contexts/BiaContext";
import { useGovernance } from "@/contexts/GovernanceContext";
import { computeMaxScore, scoreToCriticality, type Criticality } from "@/data/bia";

const LEVELS: Criticality[] = ["Critique", "Majeur", "Modéré", "Mineur"];

const COLORS = {
  Critique: "#ef4444",
  Majeur: "#f97316",
  Modéré: "#eab308",
  Mineur: "#22c55e",
};

export const BiaDashboard = () => {
  const { processes, campaigns } = useBia();
  const { entities } = useGovernance();
  const [selectedEntity, setSelectedEntity] = useState<string>("all");
  const [selectedCriticality, setSelectedCriticality] = useState<string>("all");

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
    return filtered;
  }, [processes, selectedEntity, selectedCriticality]);

  const stats = useMemo(() => {
    const totals = LEVELS.reduce(
      (acc, l) => ({ ...acc, [l]: [] as typeof processes }),
      {} as Record<Criticality, typeof processes>
    );
    let stale = 0;
    let rtoIssues = 0;
    const now = Date.now();
    for (const p of filteredProcesses) {
      const c = scoreToCriticality(computeMaxScore(p.impacts));
      totals[c].push(p);
      const days = (now - new Date(p.lastUpdated).getTime()) / (1000 * 60 * 60 * 24);
      if (days > 365) stale++;
      if (p.rto > p.mtpd) rtoIssues++;
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
    return { totals, criticalCount, total, avgScore, coverage, stale, rtoIssues };
  }, [filteredProcesses, campaigns]);

  const topProcesses = useMemo(() => {
    return filteredProcesses
      .map((p) => {
        const score = computeMaxScore(p.impacts);
        const criticality = scoreToCriticality(score);
        const entity = entities.find(e => e.id === p.entityId);
        return { ...p, score, criticality, entityName: entity?.name || "Sans direction" };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [filteredProcesses, entities]);

  const attentionPoints = useMemo(() => {
    const points = [];
    const now = Date.now();
    
    const pendingBia = filteredProcesses.filter(p => p.status !== "Validé");
    if (pendingBia.length > 0) {
      points.push({
        icon: AlertTriangle,
        color: "text-amber-500",
        bg: "bg-amber-50",
        text: `BIA du processus ${pendingBia[0].name} non validé`,
        action: "Réviser"
      });
    }

    const expiredPra = filteredProcesses.filter(p => {
      const days = (now - new Date(p.lastUpdated).getTime()) / (1000 * 60 * 60 * 24);
      return days > 365;
    });
    if (expiredPra.length > 0) {
      points.push({
        icon: Clock,
        color: "text-rose-500",
        bg: "bg-rose-50",
        text: `PRA ${expiredPra[0].name} expiré`,
        action: "Voir"
      });
    }

    const successfulTests = filteredProcesses.filter(p => p.status === "Testé");
    if (successfulTests.length > 0) {
      points.push({
        icon: CheckCircle2,
        color: "text-emerald-500",
        bg: "bg-emerald-50",
        text: `Test PRA ${successfulTests[0].name} réussi`,
        action: "Consulter"
      });
    }

    const noPca = filteredProcesses.filter(p => !p.hasPca);
    if (noPca.length > 0) {
      points.push({
        icon: ShieldAlert,
        color: "text-orange-500",
        bg: "bg-orange-50",
        text: `${noPca.length} processus sans PCA`,
        action: "Créer"
      });
    }

    return points.slice(0, 4);
  }, [filteredProcesses]);

  const pieData = LEVELS.map((level) => ({
    name: level,
    value: stats.totals[level].length,
    color: COLORS[level],
  })).filter((d) => d.value > 0);

  const criticalCount = stats.criticalCount;

  const levelColors = {
    "Critique": "bg-rose-100 text-rose-700 border-rose-200",
    "Majeur": "bg-orange-100 text-orange-700 border-orange-200",
    "Modéré": "bg-amber-100 text-amber-700 border-amber-200",
    "Mineur": "bg-green-100 text-green-700 border-green-200",
  };

  return (
    <div className="h-screen bg-slate-50/50 p-6 overflow-hidden">
      <div className="h-full flex flex-col gap-4">

        {/* ===== HEADER ===== */}
        <div className="flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
              Tableau de bord BIA
            </h1>
            <p className="text-sm text-slate-500">
              Vue globale de la continuité métier
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedEntity} onValueChange={setSelectedEntity}>
              <SelectTrigger className="w-[150px] h-8 text-xs">
                <SelectValue placeholder="Entité" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                {entities.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedCriticality} onValueChange={setSelectedCriticality}>
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <SelectValue placeholder="Criticité" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                <SelectItem value="Critique">Critique</SelectItem>
                <SelectItem value="Majeur">Majeur</SelectItem>
                <SelectItem value="Modéré">Modéré</SelectItem>
                <SelectItem value="Mineur">Mineur</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-8 gap-1.5">
              <Download className="h-3.5 w-3.5" />
              Exporter
            </Button>
            <Button size="sm" className="h-8 gap-1.5 bg-slate-900 hover:bg-slate-800">
              <FileText className="h-3.5 w-3.5" />
              Nouveau BIA
            </Button>
          </div>
        </div>

        {/* ===== LIGNE 1: KPI ===== */}
        <div className="grid grid-cols-4 gap-4 flex-shrink-0">
          {[
            { label: "Processus analysés", value: stats.total, icon: Activity, color: "text-blue-600", bg: "bg-blue-50", sub: "+2 ce mois" },
            { label: "Processus critiques", value: stats.criticalCount, icon: AlertTriangle, color: "text-rose-600", bg: "bg-rose-50", sub: criticalCount > 0 ? "Attention" : "OK" },
            { label: "Score moyen", value: `${stats.avgScore}/5`, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50", sub: "↑ +0.4" },
            { label: "Couverture BIA", value: `${stats.coverage}%`, icon: CheckCircle2, color: "text-indigo-600", bg: "bg-indigo-50", sub: "Objectif 90%" },
          ].map((kpi, index) => {
            const Icon = kpi.icon;
            return (
              <Card key={index} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                        {kpi.label}
                      </p>
                      <p className="text-2xl font-bold text-slate-900 mt-1">
                        {kpi.value}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">{kpi.sub}</p>
                    </div>
                    <div className={`h-9 w-9 rounded-xl ${kpi.bg} flex items-center justify-center flex-shrink-0 ml-3`}>
                      <Icon className={`h-4 w-4 ${kpi.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* ===== LIGNE 2: Top processus + Répartition ===== */}
        <div className="grid grid-cols-5 gap-4 flex-1 min-h-0">
          {/* Top processus - 65% */}
          <Card className="col-span-3 border-0 shadow-sm flex flex-col">
            <CardHeader className="pb-2 flex-shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Target className="h-4 w-4 text-slate-400" />
                  Top processus critiques
                </CardTitle>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-500">
                  Voir tout <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0 px-4 pb-4">
              <div className="h-full flex flex-col">
                {/* Header */}
                <div className="grid grid-cols-5 gap-2 py-1.5 border-b border-slate-100">
                  <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider col-span-2">Processus</span>
                  <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Direction</span>
                  <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Criticité</span>
                  <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider text-right">Score</span>
                </div>
                {/* Rows */}
                <div className="flex-1 divide-y divide-slate-50">
                  {topProcesses.map((p, index) => (
                    <div key={index} className="grid grid-cols-5 gap-2 py-2 items-center hover:bg-slate-50/50 rounded-lg transition-colors -mx-1 px-1">
                      <span className="text-sm font-medium text-slate-900 truncate col-span-2">{p.name}</span>
                      <span className="text-sm text-slate-500 truncate flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {p.entityName}
                      </span>
                      <Badge className={`${levelColors[p.criticality as keyof typeof levelColors]} text-[10px] px-2 py-0 h-5 border`}>
                        {p.criticality}
                      </Badge>
                      <span className="text-sm font-semibold text-slate-900 text-right">{p.score.toFixed(1)}</span>
                    </div>
                  ))}
                  {topProcesses.length === 0 && (
                    <div className="flex items-center justify-center h-full text-sm text-slate-400">
                      Aucun processus trouvé
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Répartition par criticité - 35% (à la place des points d'attention) */}
          <Card className="col-span-2 border-0 shadow-sm flex flex-col">
            <CardHeader className="pb-2 flex-shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <PieChartIcon className="h-4 w-4 text-slate-400" />
                  Répartition par criticité
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0 px-4 pb-4">
              <div className="h-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={40}
                      outerRadius={65}
                      paddingAngle={3}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {pieData.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: "white",
                        border: "1px solid #f1f5f9",
                        borderRadius: "6px",
                        fontSize: "12px",
                        padding: "6px 12px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ===== LIGNE 3: Points d'attention seulement (à la place du donut) ===== */}
        <div className="grid grid-cols-5 gap-4 flex-shrink-0 h-[170px]">
          <Card className="col-span-5 border-0 shadow-sm flex flex-col">
            <CardHeader className="pb-1 flex-shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  Points d'attention
                </CardTitle>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-500">
                  Voir tout <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0 px-4 pb-3">
              <div className="h-full grid grid-cols-4 gap-3">
                {attentionPoints.map((point, index) => {
                  const Icon = point.icon;
                  return (
                    <div 
                      key={index} 
                      className="flex items-center justify-between gap-2 py-2 px-3 rounded-lg bg-white hover:bg-slate-50 transition-colors border border-slate-100/50"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`h-7 w-7 rounded-lg ${point.bg} flex items-center justify-center flex-shrink-0`}>
                          <Icon className={`h-3.5 w-3.5 ${point.color}`} />
                        </div>
                        <p className="text-xs text-slate-700 truncate">{point.text}</p>
                      </div>
                      <Button variant="ghost" size="sm" className="h-6 text-xs text-slate-400 hover:text-slate-600 px-2 flex-shrink-0">
                        {point.action}
                      </Button>
                    </div>
                  );
                })}
                {attentionPoints.length === 0 && (
                  <div className="flex items-center justify-center col-span-4 h-full text-sm text-slate-400">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 mr-2" />
                    Aucune alerte
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
};