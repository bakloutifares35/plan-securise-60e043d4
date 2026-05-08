import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, AlertTriangle, CheckCircle2, Calendar } from "lucide-react";
import { useBia } from "@/contexts/BiaContext";
import { computeMaxScore, scoreToCriticality, criticalityColor, type Criticality } from "@/data/bia";

const LEVELS: Criticality[] = ["Critique", "Majeur", "Modéré", "Mineur"];

export const BiaDashboard = () => {
  const { processes, campaigns } = useBia();

  const stats = useMemo(() => {
    const totals = LEVELS.reduce((acc, l) => ({ ...acc, [l]: [] as typeof processes }), {} as Record<Criticality, typeof processes>);
    let stale = 0;
    const now = Date.now();
    for (const p of processes) {
      const c = scoreToCriticality(computeMaxScore(p.impacts));
      totals[c].push(p);
      const days = (now - new Date(p.lastUpdated).getTime()) / (1000 * 60 * 60 * 24);
      if (days > 365) stale++;
    }
    const critical = totals["Critique"].length + totals["Majeur"].length;
    const inProgress = campaigns.filter((c) => c.status === "En cours").length;
    const current = campaigns.find((c) => c.status === "En cours");
    const coverage = current ? Math.round((current.processesCovered / current.totalProcesses) * 100) : 0;
    return { totals, critical, inProgress, coverage, stale };
  }, [processes, campaigns]);

  const cards = [
    { label: "Processus inventoriés", value: processes.length, icon: Activity, cls: "bg-primary/10 text-primary" },
    { label: "Processus critiques", value: stats.critical, icon: AlertTriangle, cls: "bg-destructive/10 text-destructive" },
    { label: "Couverture BIA", value: `${stats.coverage}%`, icon: CheckCircle2, cls: "bg-success/10 text-success" },
    { label: "Campagnes en cours", value: stats.inProgress, icon: Calendar, cls: "bg-accent/10 text-accent" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Tableau de bord BIA</h1>
        <p className="text-muted-foreground mt-1">Vue d'ensemble des analyses d'impact métier.</p>
      </div>

      {stats.stale > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
          <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
          <div>
            <p className="font-medium text-foreground">{stats.stale} processus n'ont pas été mis à jour depuis plus de 12 mois.</p>
            <p className="text-muted-foreground">Une réévaluation BIA est recommandée.</p>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Carte de chaleur des processus par criticité</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            {LEVELS.map((lvl) => (
              <div key={lvl} className="rounded-lg border border-border overflow-hidden">
                <div className={`px-3 py-2 text-sm font-semibold ${criticalityColor(lvl)}`}>
                  {lvl} <span className="opacity-80 font-normal">({stats.totals[lvl].length})</span>
                </div>
                <div className="p-3 space-y-2 min-h-[140px] bg-card">
                  {stats.totals[lvl].length === 0 && (
                    <p className="text-xs text-muted-foreground italic">Aucun processus</p>
                  )}
                  {stats.totals[lvl].map((p) => (
                    <div key={p.id} className="rounded-md bg-secondary px-2 py-1.5 text-xs">
                      <p className="font-medium text-foreground truncate">{p.name}</p>
                      <p className="text-muted-foreground truncate">{p.department}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
