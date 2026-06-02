import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  TrendingUp,
  Building2,
  FileText,
  Download,
  ShieldAlert,
  Clock,
  Flag,
} from "lucide-react";
import { useBia } from "@/contexts/BiaContext";
import { useGovernance } from "@/contexts/GovernanceContext";
import { computeMaxScore, scoreToCriticality, criticalityColor, type Criticality } from "@/data/bia";

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
    const inProgress = campaigns.filter((c) => c.status === "En cours").length;
    return { totals, criticalCount, total, avgScore, coverage, inProgress, stale, rtoIssues };
  }, [filteredProcesses, campaigns]);

  // Données pour la liste des actions prioritaires
  const priorityActions = useMemo(() => {
    return filteredProcesses
      .map((p) => {
        const score = computeMaxScore(p.impacts);
        const criticality = scoreToCriticality(score);
        const daysSinceUpdate = (Date.now() - new Date(p.lastUpdated).getTime()) / (1000 * 60 * 60 * 24);
        const isStale = daysSinceUpdate > 365;
        const hasRtoIssue = p.rto > p.mtpd;
        const needsPca = score >= 3;
        let action = "";
        let urgency = "low";
        if (needsPca && (hasRtoIssue || isStale)) {
          action = "PCA urgent + révision BIA";
          urgency = "high";
        } else if (needsPca) {
          action = "Documenter PCA";
          urgency = "medium";
        } else if (hasRtoIssue) {
          action = "Revoir RTO/MTPD";
          urgency = "medium";
        } else if (isStale) {
          action = "Mettre à jour le BIA";
          urgency = "low";
        } else {
          action = "À surveiller";
          urgency = "none";
        }
        return { ...p, score, criticality, isStale, hasRtoIssue, needsPca, action, urgency };
      })
      .filter((p) => p.action !== "À surveiller")
      .sort((a, b) => {
        if (a.urgency === "high" && b.urgency !== "high") return -1;
        if (a.urgency !== "high" && b.urgency === "high") return 1;
        return b.score - a.score;
      })
      .slice(0, 6);
  }, [filteredProcesses]);

  const pieData = LEVELS.map((level) => ({
    name: level,
    value: stats.totals[level].length,
    color: COLORS[level],
  })).filter((d) => d.value > 0);

  // CORRECTION : Utiliser le nom de l'entité au lieu du champ department (qui a été supprimé)
  const directionData = useMemo(() => {
    const dirMap = new Map<string, number>();
    for (const p of filteredProcesses) {
      // Trouver l'entité correspondante
      const entity = entities.find(e => e.id === p.entityId);
      const dirName = entity?.name || "Sans direction";
      dirMap.set(dirName, (dirMap.get(dirName) || 0) + 1);
    }
    return Array.from(dirMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [filteredProcesses, entities]); // Ajouter 'entities' comme dépendance

  const cards = [
    { label: "Processus inventoriés", value: stats.total, icon: Activity, cls: "bg-primary/10 text-primary", trend: null },
    { label: "Processus critiques", value: stats.criticalCount, icon: AlertTriangle, cls: "bg-destructive/10 text-destructive", trend: "prioritaire" },
    { label: "Score moyen", value: `${stats.avgScore}/5`, icon: TrendingUp, cls: "bg-success/10 text-success", trend: stats.avgScore },
    { label: "Couverture BIA", value: `${stats.coverage}%`, icon: CheckCircle2, cls: "bg-accent/10 text-accent", trend: stats.coverage },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Tableau de bord BIA</h1>
          <p className="text-muted-foreground mt-1">Vue d'ensemble des analyses d'impact métier</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Exporter
          </Button>
          <Button size="sm" className="gap-2">
            <FileText className="h-4 w-4" />
            Nouveau BIA
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={selectedEntity} onValueChange={setSelectedEntity}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Toutes les entités" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les entités</SelectItem>
            {entities.map((e) => (
              <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedCriticality} onValueChange={setSelectedCriticality}>
          <SelectTrigger className="w-[160px]">
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
      </div>

      {stats.stale > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
          <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
          <div>
            <p className="font-medium text-foreground">{stats.stale} processus n'ont pas été mis à jour depuis plus de 12 mois.</p>
            <p className="text-muted-foreground">Une réévaluation BIA est recommandée.</p>
            <Button variant="link" size="sm" className="p-0 h-auto mt-1 text-warning">
              Voir les processus concernés
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label}>
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{c.value}</p>
                </div>
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${c.cls}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Répartition par criticité</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  label
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Processus par direction (top 5)</CardTitle>
          </CardHeader>
          <CardContent>
            {directionData.length === 0 ? (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                Aucune donnée
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart layout="vertical" data={directionData} margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={100} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Actions prioritaires */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Actions prioritaires</CardTitle>
            <p className="text-sm text-muted-foreground">Processus nécessitant une attention immédiate</p>
          </div>
          <Badge variant="outline" className="gap-1">
            <Flag className="h-3 w-3" /> {priorityActions.length} action(s)
          </Badge>
        </CardHeader>
        <CardContent>
          {priorityActions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-green-500" />
              <p>Aucune action urgente détectée</p>
              <p className="text-xs">Tous les processus sont à jour et conformes</p>
            </div>
          ) : (
            <div className="space-y-3">
              {priorityActions.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="min-w-[180px] flex-1">
                    <p className="font-medium text-sm">{p.name}</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      <Badge className={criticalityColor(p.criticality)}>{p.criticality}</Badge>
                      <Badge variant="outline" className="text-xs">
                        Score {p.score}/5
                      </Badge>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    {p.hasRtoIssue && (
                      <Badge variant="destructive" className="gap-1">
                        <Clock className="h-3 w-3" /> RTO &gt; MTPD
                      </Badge>
                    )}
                    {p.isStale && (
                      <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-700">
                        <Calendar className="h-3 w-3" /> BIA obsolète
                      </Badge>
                    )}
                    {p.needsPca && (
                      <Badge variant="default" className="gap-1 bg-red-100 text-red-700">
                        <ShieldAlert className="h-3 w-3" /> PCA requis
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">{p.action}</span>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">
                      Détail
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {stats.rtoIssues > 0 && (
            <div className="mt-4 text-xs text-muted-foreground border-t pt-3">
              ⚠️ {stats.rtoIssues} processus ont un RTO supérieur au MTPD
            </div>
          )}
        </CardContent>
      </Card>

      {stats.criticalCount > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-red-600 mt-0.5" />
            <div>
              <p className="font-semibold text-red-800">{stats.criticalCount} processus critique(s) nécessitent un PCA prioritaire</p>
              <p className="text-sm text-red-700 mt-1">Les processus critiques doivent être documentés dans un plan de continuité avant la prochaine revue.</p>
              <Button variant="outline" size="sm" className="mt-2 border-red-300 text-red-700">
                Voir les processus critiques
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};