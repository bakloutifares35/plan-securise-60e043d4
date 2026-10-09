import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useBCMDashboard } from "@/components/pca/Dashboard";

const referenceGrid = [
  { key: "bia", label: "Couverture BIA", rationale: "Chaque processus attendu doit disposer d’une analyse complète selon les critères BIA partagés.", action: "Compléter les analyses d’impact attendues." },
  { key: "risques", label: "Couverture des risques", rationale: "Un risque couvert possède une mesure, un traitement ou une stratégie active documentée.", action: "Documenter un traitement ou une mesure pour chaque risque applicable." },
  { key: "strategies", label: "Couverture des stratégies", rationale: "Le périmètre comprend les processus classés Critique ou Sévère.", action: "Associer une stratégie à chaque processus critique." },
  { key: "plans", label: "Couverture des plans", rationale: "Un processus critique est couvert lorsqu’un plan lié est actif ou approuvé.", action: "Faire approuver un plan pour chaque processus critique." },
  { key: "ressources", label: "Couverture des ressources", rationale: "Les quatre familles de ressources attendues sont reliées aux processus critiques.", action: "Relier les ressources nécessaires aux processus critiques." },
] as const;

export const Benchmark = () => {
  const { loading, error, dashboard } = useBCMDashboard();
  if (loading) return <div className="rounded-xl border bg-card p-8 text-sm text-muted-foreground">Calcul des indicateurs de référence…</div>;
  if (error || !dashboard) return <div role="alert" className="rounded-xl border border-destructive/30 bg-card p-6 text-sm text-destructive">Les données nécessaires au benchmark ne sont pas disponibles. {error}</div>;
  const maturity = dashboard.maturite;
  const values: Record<string, number> = { bia: maturity.bia, risques: maturity.risques, strategies: maturity.strategies, plans: maturity.plans, ressources: maturity.ressources };
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Benchmark de maturité BCM</h1>
        <p className="text-muted-foreground mt-1">Comparaison avec une grille BCM de référence</p>
      </div>

      <Card><CardHeader><CardTitle>Votre maturité PCA</CardTitle><CardDescription>Le score et les domaines utilisent les mêmes calculs que le Tableau de bord.</CardDescription></CardHeader><CardContent>
        <p className="text-4xl font-semibold text-primary">{maturity.status !== "ready" ? "Données insuffisantes" : `${maturity.global} / 100`}</p>
        {maturity.warning && <p className="mt-2 text-sm text-muted-foreground">{maturity.warning}</p>}
        <p className="mt-2 text-xs text-muted-foreground">Grille : Référentiel interne Resillia · version 1.0 · mise à jour le 9 octobre 2026</p>
      </CardContent></Card>

      <Card>
        <CardHeader>
          <CardTitle>Domaines comparés et actions recommandées</CardTitle>
          <CardDescription>La cible correspond à une couverture complète des éléments applicables. Aucune donnée concurrentielle n’est utilisée.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {referenceGrid.map((domain) => {
            const score = values[domain.key];
            const delta = score - 100;
            const domainReady = maturity.statuses[domain.key as keyof typeof maturity.statuses] === "ready";
            return <div key={domain.key} className="grid gap-2 rounded-lg border p-4 md:grid-cols-[1fr_0.7fr_0.7fr_1.5fr_1.5fr] md:items-center">
              <p className="font-medium">{domain.label}</p>
              <p className="text-sm">Resillia : {domainReady ? `${score} %` : "Non calculable"}</p>
              <Badge variant="secondary">Cible 100 % · {domainReady ? `${delta} pts` : "écart N/A"}</Badge>
              <p className="text-xs text-muted-foreground">{domain.rationale}</p>
              <p className="text-sm text-muted-foreground">{domain.action}</p>
            </div>;
          })}
        </CardContent>
      </Card>
    </div>
  );
};
