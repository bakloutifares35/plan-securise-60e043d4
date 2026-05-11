import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { LayoutGrid, List, Calendar, User } from "lucide-react";
import { useRisk } from "@/contexts/RiskContext";
import { MeasureStatus, MeasureType, CATEGORY_LABELS, RiskCategory } from "@/data/risk";
import { cn } from "@/lib/utils";

const COLUMNS: MeasureStatus[] = ["À faire", "En cours", "Terminé", "Accepté"];
const COL_STYLES: Record<MeasureStatus, string> = {
  "À faire": "border-t-muted-foreground/50",
  "En cours": "border-t-primary",
  "Terminé": "border-t-success",
  "Accepté": "border-t-warning",
};

const TYPE_COLORS: Record<MeasureType, string> = {
  Prévention: "bg-primary/15 text-primary",
  Réduction: "bg-accent/15 text-accent",
  Transfert: "bg-warning/15 text-warning",
  Acceptation: "bg-muted text-muted-foreground",
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

  const all: FlatMeasure[] = useMemo(() => {
    const list: FlatMeasure[] = [];
    for (const s of scenarios) {
      for (const m of s.measures) {
        list.push({ scenarioId: s.id, scenarioName: s.name, category: s.category, ...m });
      }
    }
    return list.filter(
      (m) => (filterCat === "all" || m.category === filterCat) && (filterType === "all" || m.type === filterType)
    );
  }, [scenarios, filterCat, filterType]);

  const byStatus = useMemo(() => {
    const g: Record<MeasureStatus, FlatMeasure[]> = { "À faire": [], "En cours": [], "Terminé": [], "Accepté": [] };
    for (const m of all) g[m.status].push(m);
    return g;
  }, [all]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Plan de traitement</h1>
          <p className="text-muted-foreground mt-1">Suivi des mesures de réduction des risques.</p>
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

      <div className="flex flex-wrap gap-3">
        <Select value={filterCat} onValueChange={(v) => setFilterCat(v as any)}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Catégorie" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes catégories</SelectItem>
            {(Object.keys(CATEGORY_LABELS) as RiskCategory[]).map((c) => (
              <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous types</SelectItem>
            {(["Prévention", "Réduction", "Transfert", "Acceptation"] as MeasureType[]).map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {view === "kanban" ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {COLUMNS.map((col) => (
            <div key={col} className={cn("rounded-lg border border-border bg-card border-t-4", COL_STYLES[col])}>
              <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">{col}</span>
                <span className="text-xs text-muted-foreground">{byStatus[col].length}</span>
              </div>
              <div className="p-2 space-y-2 min-h-[200px]">
                {byStatus[col].map((m) => (
                  <Card key={m.id} className="shadow-sm">
                    <CardContent className="p-3 space-y-2">
                      <p className="text-xs text-muted-foreground truncate">{m.scenarioName}</p>
                      <p className="text-sm font-medium text-foreground line-clamp-2">{m.description}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${TYPE_COLORS[m.type]}`}>{m.type}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><User className="h-3 w-3" />{m.responsible}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1 text-muted-foreground"><Calendar className="h-3 w-3" />{new Date(m.deadline).toLocaleDateString("fr-FR")}</span>
                        <span className="font-semibold text-foreground">{m.cost.toLocaleString("fr-FR")} €</span>
                      </div>
                      <Select value={m.status} onValueChange={(v) => updateMeasureStatus(m.scenarioId, m.id, v as MeasureStatus)}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {COLUMNS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </CardContent>
                  </Card>
                ))}
                {byStatus[col].length === 0 && (
                  <p className="text-xs text-muted-foreground italic text-center py-4">Aucune mesure</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border bg-secondary/50">
                  <th className="px-3 py-2">Scénario</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2">Responsable</th>
                  <th className="px-3 py-2">Échéance</th>
                  <th className="px-3 py-2">Statut</th>
                  <th className="px-3 py-2 text-right">Coût</th>
                </tr>
              </thead>
              <tbody>
                {all.map((m) => (
                  <tr key={m.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 text-foreground">{m.scenarioName}</td>
                    <td className="px-3 py-2"><span className={`text-xs px-2 py-0.5 rounded ${TYPE_COLORS[m.type]}`}>{m.type}</span></td>
                    <td className="px-3 py-2 text-muted-foreground max-w-xs truncate">{m.description}</td>
                    <td className="px-3 py-2 text-muted-foreground">{m.responsible}</td>
                    <td className="px-3 py-2 text-muted-foreground">{new Date(m.deadline).toLocaleDateString("fr-FR")}</td>
                    <td className="px-3 py-2">
                      <Select value={m.status} onValueChange={(v) => updateMeasureStatus(m.scenarioId, m.id, v as MeasureStatus)}>
                        <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {COLUMNS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-2 text-right font-medium">{m.cost.toLocaleString("fr-FR")} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
