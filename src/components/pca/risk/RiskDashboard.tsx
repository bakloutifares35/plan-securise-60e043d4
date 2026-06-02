import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, ShieldAlert, ShieldCheck, Layers, Info, Sliders } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useRisk } from "@/contexts/RiskContext";
import { rawScore, residualScore } from "@/data/risk";

export const RiskDashboard = () => {
  const { scenarios, appetite } = useRisk();
  const [thresholds, setThresholds] = useState({ low: 3, moderate: 8, high: 14 });
  const [selectedCell, setSelectedCell] = useState<{ prob: number; impact: number } | null>(null);
  const [selectedScenarios, setSelectedScenarios] = useState<typeof scenarios>([]);

  const stats = useMemo(() => {
    const critical = scenarios.filter((s) => rawScore(s) >= thresholds.high).length;
    const withPlan = scenarios.filter((s) => s.measures && s.measures.length > 0).length;
    const needPca = scenarios.filter((s) => residualScore(s) >= thresholds.high && !s.associatedPca).length;
    const last = new Date(appetite.lastReview).getTime();
    const months = (Date.now() - last) / (1000 * 60 * 60 * 24 * 30);
    return { critical, withPlan, needPca, staleReview: months > 6 };
  }, [scenarios, appetite, thresholds]);

  const cells = useMemo(() => {
    const map: Record<string, typeof scenarios> = {};
    for (const s of scenarios) {
      const k = `${s.probability}-${s.impact}`;
      (map[k] = map[k] || []).push(s);
    }
    return map;
  }, [scenarios]);

  const topRisks = useMemo(() => {
    return [...scenarios].sort((a, b) => rawScore(b) - rawScore(a)).slice(0, 5);
  }, [scenarios]);

  const handleCellClick = (prob: number, impact: number) => {
    const list = cells[`${prob}-${impact}`] || [];
    setSelectedScenarios(list);
    setSelectedCell({ prob, impact });
  };

  const getCellColor = (score: number) => {
    if (score <= thresholds.low) return "bg-green-500/70 text-white";
    if (score <= thresholds.moderate) return "bg-yellow-500/70 text-white";
    if (score <= thresholds.high) return "bg-orange-500/80 text-white";
    return "bg-red-600/85 text-white";
  };

  const cards = [
    { label: "Scénarios totaux", value: scenarios.length, icon: Layers, cls: "bg-primary/10 text-primary" },
    { label: "Risques critiques", value: stats.critical, icon: AlertTriangle, cls: "bg-destructive/10 text-destructive", tooltip: `Seuil > ${thresholds.high}` },
    { label: "Avec plan de traitement", value: stats.withPlan, icon: ShieldCheck, cls: "bg-success/10 text-success" },
    { label: "Nécessitent un PCA", value: stats.needPca, icon: ShieldAlert, cls: "bg-warning/10 text-warning", tooltip: "Risque résiduel élevé sans PCA" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Tableau de bord des risques</h1>
          <p className="text-muted-foreground mt-1">Cartographie 5×5 et indicateurs clés</p>
        </div>
        <div className="flex items-center gap-2 bg-muted/30 p-2 rounded-lg">
          <Sliders className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium">Seuils paramétrables</span>
          <div className="w-32">
            <Slider
              value={[thresholds.low, thresholds.moderate, thresholds.high]}
              min={0}
              max={25}
              step={1}
              onValueChange={([low, moderate, high]) => setThresholds({ low, moderate, high })}
            />
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Faible ≤ {thresholds.low} | Modéré ≤ {thresholds.moderate} | Élevé ≤ {thresholds.high} | Critique &gt; {thresholds.high}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
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
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    {c.label}
                    {c.tooltip && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger><Info className="h-3 w-3" /></TooltipTrigger>
                          <TooltipContent>{c.tooltip}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </p>
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
          <p className="text-sm text-muted-foreground">Cliquez sur une case pour voir les scénarios associés</p>
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
                      const score = p * i;
                      const list = cells[`${p}-${i}`] || [];
                      const colorClass = getCellColor(score);
                      return (
                        <button
                          key={i}
                          onClick={() => handleCellClick(p, i)}
                          className={`min-h-[80px] rounded-md p-1.5 ${colorClass} hover:ring-2 hover:ring-primary hover:ring-offset-1 transition-all flex flex-col items-center justify-between`}
                        >
                          <span className="text-sm font-bold">{score}</span>
                          {list.length > 0 && (
                            <span className="text-[10px] font-medium bg-black/20 px-1 rounded-full">{list.length}</span>
                          )}
                          <div className="flex flex-wrap gap-0.5 justify-center mt-1">
                            {list.slice(0, 3).map((s) => (
                              <TooltipProvider key={s.id}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="h-2 w-2 rounded-full bg-foreground/80 ring-1 ring-background" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs max-w-xs">{s.name}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ))}
                            {list.length > 3 && <span className="text-[8px]">+{list.length - 3}</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-4 mt-4 text-xs">
            <span className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-green-500/70" /> Faible (≤{thresholds.low})</span>
            <span className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-yellow-500/70" /> Modéré ({thresholds.low + 1}-{thresholds.moderate})</span>
            <span className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-orange-500/80" /> Élevé ({thresholds.moderate + 1}-{thresholds.high})</span>
            <span className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-red-600/85" /> Critique (&gt;{thresholds.high})</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Top 5 risques bruts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {topRisks.map((risk) => {
            const score = rawScore(risk);
            const percent = (score / 25) * 100;
            const barColor = getCellColor(score);
            return (
              <div key={risk.id} className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg border hover:bg-muted/30">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{risk.name}</p>
                  <p className="text-xs text-muted-foreground">{risk.category || "Non catégorisé"}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-32">
                    <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${barColor}`} style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                  <Badge variant={score >= thresholds.high ? "destructive" : score >= thresholds.moderate ? "default" : "secondary"}>
                    {score}/25
                  </Badge>
                </div>
              </div>
            );
          })}
          {topRisks.length === 0 && <p className="text-muted-foreground italic">Aucun scénario défini.</p>}
        </CardContent>
      </Card>

      <Sheet open={!!selectedCell} onOpenChange={() => setSelectedCell(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Scénarios - Probabilité {selectedCell?.prob} × Impact {selectedCell?.impact}</SheetTitle>
            <SheetDescription>Score : {selectedCell && selectedCell.prob * selectedCell.impact}/25</SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            {selectedScenarios.length === 0 ? (
              <p className="text-muted-foreground text-sm">Aucun scénario dans cette case.</p>
            ) : (
              selectedScenarios.map((s) => (
                <div key={s.id} className="border rounded-lg p-3 space-y-1 hover:bg-muted/30">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{s.name}</span>
                    <Badge variant="outline">{s.category || "Général"}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{s.description}</p>
                  <div className="flex gap-2 text-xs">
                    <span>Brut: {rawScore(s)}/25</span>
                    <span>Résiduel: {residualScore(s)}/25</span>
                  </div>
                  {s.associatedPca && <Badge variant="secondary" className="text-[10px]">PCA: {s.associatedPca}</Badge>}
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};