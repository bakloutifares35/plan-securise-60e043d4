import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, ShieldAlert, ShieldCheck, Layers } from "lucide-react";
import { useRisk } from "@/contexts/RiskContext";
import { cellColor, rawScore, residualScore } from "@/data/risk";

export const RiskDashboard = () => {
  const { scenarios, appetite } = useRisk();

  const stats = useMemo(() => {
    const critical = scenarios.filter((s) => rawScore(s) >= 12).length;
    const withPlan = scenarios.filter((s) => s.measures.length > 0).length;
    const needPca = scenarios.filter((s) => residualScore(s) >= 12 && !s.associatedPca).length;
    const last = new Date(appetite.lastReview).getTime();
    const months = (Date.now() - last) / (1000 * 60 * 60 * 24 * 30);
    return { critical, withPlan, needPca, staleReview: months > 6 };
  }, [scenarios, appetite]);

  // Group scenarios by cell (probability, impact)
  const cells: Record<string, typeof scenarios> = {};
  for (const s of scenarios) {
    const k = `${s.probability}-${s.impact}`;
    (cells[k] = cells[k] || []).push(s);
  }

  const cards = [
    { label: "Scénarios totaux", value: scenarios.length, icon: Layers, cls: "bg-primary/10 text-primary" },
    { label: "Risques critiques (≥ 12)", value: stats.critical, icon: AlertTriangle, cls: "bg-destructive/10 text-destructive" },
    { label: "Avec plan de traitement", value: stats.withPlan, icon: ShieldCheck, cls: "bg-success/10 text-success" },
    { label: "Nécessitent un PCA", value: stats.needPca, icon: ShieldAlert, cls: "bg-warning/10 text-warning" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Tableau de bord des risques</h1>
        <p className="text-muted-foreground mt-1">Cartographie 5×5 et indicateurs clés.</p>
      </div>

      {stats.staleReview && (
        <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
          <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
          <div>
            <p className="font-medium text-foreground">Revue semestrielle requise.</p>
            <p className="text-muted-foreground">La cartographie des risques n'a pas été révisée depuis plus de 6 mois.</p>
          </div>
        </div>
      )}

      {stats.needPca > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <ShieldAlert className="h-5 w-5 text-destructive mt-0.5" />
          <div>
            <p className="font-medium text-foreground">{stats.needPca} scénario(s) à risque résiduel élevé sans PCA associé.</p>
            <p className="text-muted-foreground">Un plan de continuité doit être défini.</p>
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
          <CardTitle className="text-lg">Matrice des risques (Probabilité × Impact)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full">
              <div className="flex">
                <div className="w-20 shrink-0" />
                <div className="flex-1 grid grid-cols-5 gap-1 mb-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="text-center text-xs font-medium text-muted-foreground">Impact {i}</div>
                  ))}
                </div>
              </div>
              {[5, 4, 3, 2, 1].map((p) => (
                <div key={p} className="flex items-stretch mb-1">
                  <div className="w-20 shrink-0 flex items-center justify-end pr-2 text-xs font-medium text-muted-foreground">
                    Prob. {p}
                  </div>
                  <div className="flex-1 grid grid-cols-5 gap-1">
                    {[1, 2, 3, 4, 5].map((i) => {
                      const list = cells[`${p}-${i}`] || [];
                      return (
                        <div
                          key={i}
                          className={`min-h-[80px] rounded-md p-1.5 ${cellColor(p, i)} flex flex-wrap gap-1 content-start`}
                        >
                          <span className="text-[10px] font-bold opacity-90 w-full">{p * i}</span>
                          {list.map((s) => (
                            <span
                              key={s.id}
                              title={`${s.name} (${p}×${i}=${p * i})`}
                              className="h-2.5 w-2.5 rounded-full bg-foreground/80 ring-2 ring-background"
                            />
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-4 mt-4 text-xs">
            <span className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-success/70" /> Faible (1-3)</span>
            <span className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-accent/70" /> Modéré (4-8)</span>
            <span className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-warning/80" /> Élevé (9-14)</span>
            <span className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-destructive/85" /> Critique (15-25)</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
