import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertTriangle, ShieldCheck, Link2 } from "lucide-react";
import { useRisk } from "@/contexts/RiskContext";
import { CATEGORY_LABELS, categoryColor, rawScore, residualScore, scoreLevel, levelLabel, MeasureType } from "@/data/risk";

const MEASURE_COLORS: Record<MeasureType, string> = {
  Prévention: "bg-primary/15 text-primary",
  Réduction: "bg-accent/15 text-accent",
  Transfert: "bg-warning/15 text-warning",
  Acceptation: "bg-muted text-muted-foreground",
};

const STATUS_COLORS: Record<string, string> = {
  "À faire": "bg-muted text-muted-foreground",
  "En cours": "bg-primary/15 text-primary",
  "Terminé": "bg-success/15 text-success",
  "Accepté": "bg-warning/15 text-warning",
};

export const ScenarioDetail = ({ scenarioId, onBack }: { scenarioId: string; onBack: () => void }) => {
  const { scenarios } = useRisk();
  const s = scenarios.find((x) => x.id === scenarioId);
  if (!s) return <p className="text-sm text-muted-foreground">Scénario introuvable.</p>;

  const raw = rawScore(s);
  const res = residualScore(s);
  const lvlRaw = scoreLevel(raw);
  const lvlRes = scoreLevel(res);
  const noPca = res >= 12 && !s.associatedPca;
  const reduction = raw > 0 ? Math.round(((raw - res) / raw) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Retour
        </Button>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${categoryColor(s.category)}`}>
          {CATEGORY_LABELS[s.category]}
        </span>
      </div>

      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">{s.name}</h1>
        <p className="text-muted-foreground mt-1">{s.description}</p>
      </div>

      {noPca && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
          <p className="font-medium text-foreground">Risque résiduel élevé ({res}/25) sans PCA associé. Une réponse de continuité doit être définie.</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-base">Évaluation brute</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Probabilité</span><span className="font-semibold">{s.probability}/5</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Impact</span><span className="font-semibold">{s.impact}/5</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Vitesse propagation</span><span className="font-semibold">{s.propagationSpeed}</span></div>
            <div className="flex justify-between pt-2 border-t border-border"><span className="font-medium">Score</span><span className="font-bold text-lg">{raw}/25</span></div>
            <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded ${
              lvlRaw === "critical" ? "bg-destructive/15 text-destructive" :
              lvlRaw === "high" ? "bg-warning/15 text-warning" :
              lvlRaw === "medium" ? "bg-accent/15 text-accent" : "bg-success/15 text-success"
            }`}>{levelLabel(lvlRaw)}</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Risque résiduel</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Probabilité résiduelle</span><span className="font-semibold">{s.residualProbability}/5</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Impact résiduel</span><span className="font-semibold">{s.residualImpact}/5</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Réduction</span><span className="font-semibold text-success">-{reduction}%</span></div>
            <div className="flex justify-between pt-2 border-t border-border"><span className="font-medium">Score résiduel</span><span className="font-bold text-lg">{res}/25</span></div>
            <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded ${
              lvlRes === "critical" ? "bg-destructive/15 text-destructive" :
              lvlRes === "high" ? "bg-warning/15 text-warning" :
              lvlRes === "medium" ? "bg-accent/15 text-accent" : "bg-success/15 text-success"
            }`}>{levelLabel(lvlRes)}</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">PCA associé</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {s.associatedPca ? (
              <button className="w-full flex items-center gap-2 rounded-md border border-border bg-secondary/50 p-3 text-sm hover:bg-secondary transition-colors">
                <ShieldCheck className="h-5 w-5 text-success" />
                <div className="text-left flex-1">
                  <p className="font-medium text-foreground">{s.associatedPca}</p>
                  <p className="text-xs text-muted-foreground">Activable depuis le module Plan de continuité</p>
                </div>
                <Link2 className="h-4 w-4 text-muted-foreground" />
              </button>
            ) : (
              <p className="text-sm text-muted-foreground italic">Aucun PCA associé à ce scénario.</p>
            )}
            <div className="text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Processus critiques impactés</p>
              <ul className="list-disc list-inside space-y-0.5">
                {s.criticalProcesses.map((p) => <li key={p}>{p}</li>)}
              </ul>
            </div>
            <div className="text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Ressources associées</p>
              <ul className="list-disc list-inside space-y-0.5">
                {s.resources.map((r) => <li key={r}>{r}</li>)}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Mesures de traitement</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Description</th>
                  <th className="py-2 pr-3">Responsable</th>
                  <th className="py-2 pr-3">Échéance</th>
                  <th className="py-2 pr-3">Statut</th>
                  <th className="py-2 text-right">Coût</th>
                </tr>
              </thead>
              <tbody>
                {s.measures.map((m) => (
                  <tr key={m.id} className="border-b border-border last:border-0">
                    <td className="py-2 pr-3"><span className={`text-xs px-2 py-0.5 rounded ${MEASURE_COLORS[m.type]}`}>{m.type}</span></td>
                    <td className="py-2 pr-3 text-foreground">{m.description}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{m.responsible}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{new Date(m.deadline).toLocaleDateString("fr-FR")}</td>
                    <td className="py-2 pr-3"><span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[m.status]}`}>{m.status}</span></td>
                    <td className="py-2 text-right font-medium">{m.cost.toLocaleString("fr-FR")} €</td>
                  </tr>
                ))}
                {s.measures.length === 0 && (
                  <tr><td colSpan={6} className="py-6 text-center text-muted-foreground italic">Aucune mesure définie.</td></tr>
                )}
              </tbody>
              {s.measures.length > 0 && (
                <tfoot>
                  <tr className="font-semibold">
                    <td colSpan={5} className="py-2 text-right">Total :</td>
                    <td className="py-2 text-right">{s.measures.reduce((a, m) => a + m.cost, 0).toLocaleString("fr-FR")} €</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
