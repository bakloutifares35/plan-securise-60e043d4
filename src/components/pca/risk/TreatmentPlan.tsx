import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LayoutGrid, List, Calendar, User, TrendingUp, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { useRisk } from "@/contexts/RiskContext";
import { MeasureStatus, MeasureType, CATEGORY_LABELS, RiskCategory } from "@/data/risk";
import { cn } from "@/lib/utils";

const COLUMNS: MeasureStatus[] = ["À faire", "En cours", "Terminé", "Accepté"];
const COL_STYLES: Record<MeasureStatus, string> = {
  "À faire": "border-t-slate-400",
  "En cours": "border-t-blue-500",
  "Terminé": "border-t-emerald-500",
  "Accepté": "border-t-amber-500",
};

const TYPE_COLORS: Record<MeasureType, string> = {
  Prévention: "bg-blue-100 text-blue-700",
  Réduction: "bg-purple-100 text-purple-700",
  Transfert: "bg-amber-100 text-amber-700",
  Acceptation: "bg-gray-100 text-gray-600",
};

const STATUS_ICON: Record<MeasureStatus, React.ReactNode> = {
  "À faire": <Clock className="h-3 w-3" />,
  "En cours": <TrendingUp className="h-3 w-3" />,
  "Terminé": <CheckCircle2 className="h-3 w-3" />,
  "Accepté": <CheckCircle2 className="h-3 w-3" />,
};

type FlatMeasure = {
  scenarioId: string;
  scenarioName: string;
  category: RiskCategory;
  id: string;
  type: MeasureType;
  description: string;
  responsible: string;
  deadline: string;
  status: MeasureStatus;
  cost: number;
};

export const TreatmentPlan = () => {
  const { scenarios, updateMeasureStatus } = useRisk();
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [filterCat, setFilterCat] = useState<"all" | RiskCategory>("all");
  const [filterType, setFilterType] = useState<"all" | MeasureType>("all");
  const [search, setSearch] = useState("");
  const [filterResponsible, setFilterResponsible] = useState("all");

  // Extraire la liste des responsables uniques
  const allMeasures = useMemo(() => {
    const list: FlatMeasure[] = [];
    for (const s of scenarios) {
      for (const m of s.measures) {
        list.push({ scenarioId: s.id, scenarioName: s.name, category: s.category, ...m });
      }
    }
    return list;
  }, [scenarios]);

  const responsibleList = useMemo(() => {
    const uniques = new Set(allMeasures.map(m => m.responsible).filter(Boolean));
    return Array.from(uniques);
  }, [allMeasures]);

  const filtered = useMemo(() => {
    let list = allMeasures;
    if (filterCat !== "all") list = list.filter(m => m.category === filterCat);
    if (filterType !== "all") list = list.filter(m => m.type === filterType);
    if (search) list = list.filter(m => m.description.toLowerCase().includes(search.toLowerCase()) || m.scenarioName.toLowerCase().includes(search.toLowerCase()));
    if (filterResponsible !== "all") list = list.filter(m => m.responsible === filterResponsible);
    return list;
  }, [allMeasures, filterCat, filterType, search, filterResponsible]);

  const byStatus = useMemo(() => {
    const g: Record<MeasureStatus, FlatMeasure[]> = { "À faire": [], "En cours": [], "Terminé": [], "Accepté": [] };
    for (const m of filtered) g[m.status].push(m);
    return g;
  }, [filtered]);

  // Statistiques globales
  const totalCost = filtered.reduce((acc, m) => acc + m.cost, 0);
  const completedCost = filtered.filter(m => m.status === "Terminé" || m.status === "Accepté").reduce((acc, m) => acc + m.cost, 0);
  const percentCompleted = totalCost > 0 ? Math.round((completedCost / totalCost) * 100) : 0;

  // Échéances proches (dans 30 jours)
  const today = new Date();
  const upcomingDeadlines = filtered.filter(m => {
    const deadline = new Date(m.deadline);
    const diffDays = (deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= 30 && m.status !== "Terminé" && m.status !== "Accepté";
  }).length;

  const getDeadlineClass = (deadline: string) => {
    const d = new Date(deadline);
    const diff = (d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    if (diff < 0) return "text-destructive bg-destructive/10";
    if (diff <= 7) return "text-orange-500 bg-orange-50";
    if (diff <= 30) return "text-yellow-600 bg-yellow-50";
    return "text-muted-foreground";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Plan de traitement</h1>
          <p className="text-muted-foreground mt-1">Suivi des mesures de réduction des risques</p>
        </div>
        <div className="flex gap-1 rounded-md border border-border p-0.5 bg-card">
          <Button size="sm" variant={view === "kanban" ? "default" : "ghost"} onClick={() => setView("kanban")}>
            <LayoutGrid className="h-4 w-4 mr-1" /> Kanban
          </Button>
          <Button size="sm" variant={view === "list" ? "default" : "ghost"} onClick={() => setView("list")}>
            <List className="h-4 w-4 mr-1" /> Liste
          </Button>
        </div>
      </div>

      {/* Indicateurs de progression */}
      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="p-3 flex justify-between items-center">
            <div><p className="text-xs text-muted-foreground">Total mesures</p><p className="text-xl font-bold">{filtered.length}</p></div>
            <div><p className="text-xs text-muted-foreground">Coût total</p><p className="text-sm font-semibold">{totalCost.toLocaleString("fr-FR")} €</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Avancement financier</p>
            <div className="flex items-center gap-2 mt-1"><Progress value={percentCompleted} className="h-2 flex-1" /><span className="text-sm font-bold">{percentCompleted}%</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex justify-between items-center">
            <div><p className="text-xs text-muted-foreground">Échéances proches (30j)</p><p className="text-xl font-bold">{upcomingDeadlines}</p></div>
            <div><p className="text-xs text-muted-foreground">Coût réalisé</p><p className="text-sm font-semibold text-success">{completedCost.toLocaleString("fr-FR")} €</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex justify-between items-center">
            <div><p className="text-xs text-muted-foreground">Par statut</p><div className="flex gap-1 mt-1">{COLUMNS.map(col => <Badge key={col} variant="outline" className="text-[10px]">{byStatus[col].length}</Badge>)}</div></div>
          </CardContent>
        </Card>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Input placeholder="Rechercher mesure ou scénario..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterCat} onValueChange={(v) => setFilterCat(v as any)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Catégorie" /></SelectTrigger>
          <SelectContent>{(Object.keys(CATEGORY_LABELS) as RiskCategory[]).map(c => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>{(["Prévention", "Réduction", "Transfert", "Acceptation"] as MeasureType[]).map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filterResponsible} onValueChange={setFilterResponsible}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Responsable" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Tous</SelectItem>{responsibleList.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {/* Vue Kanban */}
      {view === "kanban" ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {COLUMNS.map((col) => (
            <div key={col} className={cn("rounded-lg border border-border bg-card border-t-4", COL_STYLES[col])}>
              <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground flex items-center gap-1">{STATUS_ICON[col]} {col}</span>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{byStatus[col].length}</span>
              </div>
              <div className="p-2 space-y-2 max-h-[calc(100vh-350px)] overflow-y-auto">
                {byStatus[col].map((m) => {
                  const deadline = new Date(m.deadline);
                  const isOverdue = deadline < today && m.status !== "Terminé" && m.status !== "Accepté";
                  return (
                    <Card key={m.id} className={cn("shadow-sm transition-all hover:shadow-md", isOverdue && "border-destructive/50 bg-destructive/5")}>
                      <CardContent className="p-3 space-y-2">
                        <div className="flex justify-between items-start">
                          <p className="text-xs text-muted-foreground truncate">{m.scenarioName}</p>
                          <Badge className={`text-[10px] ${TYPE_COLORS[m.type]}`}>{m.type}</Badge>
                        </div>
                        <p className="text-sm font-medium text-foreground line-clamp-2">{m.description}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <User className="h-3 w-3" /> {m.responsible}
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded", getDeadlineClass(m.deadline))}>
                            <Calendar className="h-3 w-3" /> {deadline.toLocaleDateString("fr-FR")}
                          </span>
                          <span className="font-semibold">{m.cost.toLocaleString("fr-FR")} €</span>
                        </div>
                        <Select value={m.status} onValueChange={(v) => updateMeasureStatus(m.scenarioId, m.id, v as MeasureStatus)}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{COLUMNS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                      </CardContent>
                    </Card>
                  );
                })}
                {byStatus[col].length === 0 && <p className="text-xs text-muted-foreground italic text-center py-4">Aucune mesure</p>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Vue liste
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50">
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="px-3 py-2">Scénario</th><th>Type</th><th>Description</th><th>Responsable</th><th>Échéance</th><th>Statut</th><th className="text-right">Coût</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => {
                  const deadline = new Date(m.deadline);
                  const isOverdue = deadline < today && m.status !== "Terminé" && m.status !== "Accepté";
                  return (
                    <tr key={m.id} className={cn("border-b border-border last:border-0", isOverdue && "bg-destructive/5")}>
                      <td className="px-3 py-2 font-medium">{m.scenarioName}</td>
                      <td className="px-3 py-2"><Badge className={`text-[10px] ${TYPE_COLORS[m.type]}`}>{m.type}</Badge></td>
                      <td className="px-3 py-2 text-muted-foreground max-w-xs truncate">{m.description}</td>
                      <td className="px-3 py-2">{m.responsible}</td>
                      <td className="px-3 py-2"><span className={cn("px-1.5 py-0.5 rounded text-xs", getDeadlineClass(m.deadline))}>{deadline.toLocaleDateString("fr-FR")}</span></td>
                      <td className="px-3 py-2"><Select value={m.status} onValueChange={(v) => updateMeasureStatus(m.scenarioId, m.id, v as MeasureStatus)}><SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger><SelectContent>{COLUMNS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></td>
                      <td className="px-3 py-2 text-right font-semibold">{m.cost.toLocaleString("fr-FR")} €</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};