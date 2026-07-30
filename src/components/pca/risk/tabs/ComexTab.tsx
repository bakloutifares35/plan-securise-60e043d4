import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Activity, ShieldCheck, TrendingUp } from "lucide-react";
import type { RiskData } from "../useRiskData";
import { NIVEAU_STYLE, NiveauRisque, scoreToNiveau } from "../riskModel";

const Bar = ({ label, value, total, color }: { label: string; value: number; total: number; color: string }) => (
  <div className="space-y-1">
    <div className="flex justify-between text-sm">
      <span className="text-[#172030]/80">{label}</span>
      <span className="text-[#172030]/60">{value}</span>
    </div>
    <div className="h-2 rounded-full bg-[#172030]/8 overflow-hidden">
      <div className="h-full rounded-full transition-all"
        style={{ width: `${total ? (value / total) * 100 : 0}%`, backgroundColor: color }} />
    </div>
  </div>
);

const PALETTE = ["#2A5141", "#3B4454", "#8a9a5b", "#c08a3e", "#7d5a50", "#4c6b8a", "#a4664e", "#5f7d6c", "#93724f"];

export const ComexTab = ({ data }: { data: RiskData }) => {
  const { risques, plans, menaces, actifs, params } = data;

  const enriched = useMemo(
    () => risques.map((r) => ({ ...r, niveauCalc: scoreToNiveau(r.score_residuel || 1, params) })),
    [risques, params]
  );

  const total = enriched.length;
  const critiques = enriched.filter((r) => r.niveauCalc === "Critique" || r.niveauCalc === "Élevé").length;
  const enTraitement = plans.filter((p) => p.statut === "En cours").length;
  const retards = plans.filter(
    (p) => p.echeance && p.statut !== "Terminé" && p.statut !== "Acceptée" && new Date(p.echeance) < new Date()
  ).length;
  const scoreMoyen = total
    ? (enriched.reduce((s, r) => s + (r.score_residuel || 0), 0) / total).toFixed(1)
    : "0";
  const reduction = (() => {
    const brut = enriched.reduce((s, r) => s + (r.score_brut || 0), 0);
    const res = enriched.reduce((s, r) => s + (r.score_residuel || 0), 0);
    return brut ? Math.round(((brut - res) / brut) * 100) : 0;
  })();

  const top10 = [...enriched].sort((a, b) => (b.score_residuel || 0) - (a.score_residuel || 0)).slice(0, 10);

  const countBy = (fn: (r: (typeof enriched)[number]) => string | null | undefined) => {
    const m = new Map<string, number>();
    enriched.forEach((r) => {
      const k = fn(r) || "Non renseigné";
      m.set(k, (m.get(k) ?? 0) + 1);
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };

  const menaceById = useMemo(() => Object.fromEntries(menaces.map((m) => [m.id, m])), [menaces]);
  const actifById = useMemo(() => Object.fromEntries(actifs.map((a) => [a.id, a])), [actifs]);

  const parDecision = countBy((r) => r.decision);
  const parCategorieMenace = countBy((r) => (r.menace_id ? menaceById[r.menace_id]?.categorie : r.category));
  const parTypeActif = countBy((r) => (r.actif_id ? actifById[r.actif_id]?.type : null));
  const parNiveau = (["Critique", "Élevé", "Modéré", "Faible"] as NiveauRisque[]).map((n) => ({
    n, c: enriched.filter((r) => r.niveauCalc === n).length,
  }));

  const Kpi = ({ label, value, sub, icon: Icon, tone }: {
    label: string; value: string; sub?: string; icon: typeof Activity; tone: string;
  }) => (
    <Card className="border-[#172030]/10">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <p className="text-xs uppercase tracking-wider text-[#172030]/50">{label}</p>
          <Icon className={`h-4 w-4 ${tone}`} />
        </div>
        <p className={`font-serif text-3xl mt-2 ${tone}`}>{value}</p>
        {sub && <p className="text-xs text-[#172030]/50 mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl text-[#172030]">Tableau de bord COMEX</h2>
        <p className="text-sm text-[#172030]/60">
          Vue de synthèse du portefeuille de risques, destinée au comité de direction.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Risques identifiés" value={String(total)} sub={`Score résiduel moyen : ${scoreMoyen}`} icon={Activity} tone="text-[#172030]" />
        <Kpi label="Risques critiques / élevés" value={String(critiques)} sub={total ? `${Math.round((critiques / total) * 100)} % du portefeuille` : undefined} icon={AlertTriangle} tone="text-rose-600" />
        <Kpi label="Mesures en cours" value={String(enTraitement)} sub={`${plans.length} mesures au total`} icon={ShieldCheck} tone="text-[#2A5141]" />
        <Kpi label="Réduction du risque" value={`${reduction} %`} sub="Écart brut → résiduel" icon={TrendingUp} tone="text-[#2A5141]" />
      </div>

      {retards > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">
            <span className="font-medium">{retards} mesure{retards > 1 ? "s" : ""} de traitement en retard</span> — échéance dépassée sans clôture.
          </p>
        </div>
      )}

      <Card className="border-[#172030]/10">
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-[#172030] text-base">Répartition par niveau de risque résiduel</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-4">
          {parNiveau.map(({ n, c }) => (
            <div key={n} className="rounded-lg border border-[#172030]/10 p-4">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${NIVEAU_STYLE[n].dot}`} />
                <span className="text-sm text-[#172030]/70">{n}</span>
              </div>
              <p className="font-serif text-2xl text-[#172030] mt-1">{c}</p>
              <Progress className="mt-2 h-1.5" value={total ? (c / total) * 100 : 0} indicatorClassName={NIVEAU_STYLE[n].dot} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-[#172030]/10">
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-[#172030] text-base">Top 10 des risques par score résiduel</CardTitle>
          <CardDescription>Les expositions les plus fortes après prise en compte des mesures en place.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {top10.map((r, i) => (
            <div key={r.id} className="flex items-center gap-3 rounded-lg border border-[#172030]/8 bg-[#F8F6F2]/60 px-3 py-2.5">
              <span className="font-serif text-lg text-[#172030]/35 w-6 text-right">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[#172030] truncate">{r.title}</p>
                <p className="text-xs text-[#172030]/50">
                  {r.reference ?? "—"} · {r.owner || "Sans pilote"} · P{r.probabilite} × I{r.impact_global}
                </p>
              </div>
              <Badge variant="outline" className={NIVEAU_STYLE[r.niveauCalc].badge}>{r.niveauCalc}</Badge>
              <span className="font-serif text-xl text-[#172030] w-8 text-right">{r.score_residuel}</span>
            </div>
          ))}
          {top10.length === 0 && <p className="text-sm text-[#172030]/50 py-6 text-center">Aucun risque enregistré.</p>}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {[
          { title: "Répartition par décision", rows: parDecision },
          { title: "Par catégorie de menace", rows: parCategorieMenace },
          { title: "Par type d'actif", rows: parTypeActif },
        ].map((block) => (
          <Card key={block.title} className="border-[#172030]/10">
            <CardHeader className="pb-3">
              <CardTitle className="font-serif text-[#172030] text-base">{block.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {block.rows.map(([label, value], i) => (
                <Bar key={label} label={label} value={value} total={total} color={PALETTE[i % PALETTE.length]} />
              ))}
              {block.rows.length === 0 && <p className="text-sm text-[#172030]/50">Aucune donnée.</p>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
