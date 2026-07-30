import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RotateCcw, Save } from "lucide-react";
import type { RiskData } from "../useRiskData";
import {
  AXES_IMPACT, AxeImpact, DEFAULT_PARAMS, EchelonEchelle, NIVEAU_STYLE, ParametresRisques,
} from "../riskModel";

const EchelleEditor = ({
  title, description, rows, onChange,
}: {
  title: string; description: string; rows: EchelonEchelle[];
  onChange: (rows: EchelonEchelle[]) => void;
}) => (
  <Card className="border-[#172030]/10">
    <CardHeader className="pb-3">
      <CardTitle className="font-serif text-[#172030] text-base">{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
    <CardContent className="space-y-3">
      {rows.map((row, i) => (
        <div key={row.n} className="grid gap-2 sm:grid-cols-[auto_1fr_2fr] sm:items-center">
          <span className="h-8 w-8 rounded-md bg-[#2A5141] text-white grid place-items-center text-sm font-medium">
            {row.n}
          </span>
          <Input value={row.label} placeholder="Libellé"
            onChange={(e) => onChange(rows.map((r, j) => (j === i ? { ...r, label: e.target.value } : r)))} />
          <Input value={row.desc} placeholder="Description / critère"
            onChange={(e) => onChange(rows.map((r, j) => (j === i ? { ...r, desc: e.target.value } : r)))} />
        </div>
      ))}
    </CardContent>
  </Card>
);

export const ParametresTab = ({ data }: { data: RiskData }) => {
  const [draft, setDraft] = useState<ParametresRisques>(data.params);

  useEffect(() => { setDraft(data.params); }, [data.params]);

  const set = <K extends keyof ParametresRisques>(k: K, v: ParametresRisques[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const setPoids = (axe: AxeImpact, v: number) =>
    setDraft((d) => ({ ...d, ponderation_axes: { ...d.ponderation_axes, [axe]: v } }));

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-serif text-2xl text-[#172030]">Paramètres de l'analyse</h2>
          <p className="text-sm text-[#172030]/60">
            Échelles, pondérations et seuils utilisés pour tous les calculs du module.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setDraft({ ...DEFAULT_PARAMS, id: draft.id })}>
            <RotateCcw className="h-4 w-4 mr-1.5" /> Valeurs par défaut
          </Button>
          <Button className="bg-[#2A5141] hover:bg-[#2A5141]/90" onClick={() => data.saveParams(draft)}>
            <Save className="h-4 w-4 mr-1.5" /> Enregistrer
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <EchelleEditor
          title="Échelle de probabilité (1 → 5)"
          description="Fréquence estimée de survenance du risque."
          rows={draft.echelle_probabilite}
          onChange={(rows) => set("echelle_probabilite", rows)}
        />
        <EchelleEditor
          title="Échelle d'impact (1 → 5)"
          description="Gravité des conséquences sur chacun des axes."
          rows={draft.echelle_impact}
          onChange={(rows) => set("echelle_impact", rows)}
        />
      </div>

      <Card className="border-[#172030]/10">
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-[#172030] text-base">Pondération des axes d'impact</CardTitle>
          <CardDescription>
            L'impact global combine 60 % du pire axe et 40 % de la moyenne pondérée ci-dessous.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {AXES_IMPACT.map((a) => (
            <div key={a.id} className="rounded-lg border border-[#172030]/10 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#172030]">{a.icon} {a.label}</span>
                <Badge variant="outline" className="bg-[#2A5141]/10 text-[#2A5141] border-[#2A5141]/20">
                  ×{(draft.ponderation_axes?.[a.id] ?? 1).toFixed(1)}
                </Badge>
              </div>
              <input type="range" min={0} max={3} step={0.1} className="w-full accent-[#2A5141] mt-3"
                value={draft.ponderation_axes?.[a.id] ?? 1}
                onChange={(e) => setPoids(a.id, Number(e.target.value))} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-[#172030]/10">
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-[#172030] text-base">Seuils d'appétence au risque</CardTitle>
          <CardDescription>Bornes appliquées au score résiduel (1 à 25).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label>Seuil acceptable (≤)</Label>
              <Input type="number" min={1} max={25} value={draft.seuil_acceptable}
                onChange={(e) => set("seuil_acceptable", Number(e.target.value))} />
            </div>
            <div>
              <Label>Seuil tolérable (≤)</Label>
              <Input type="number" min={1} max={25} value={draft.seuil_tolerable}
                onChange={(e) => set("seuil_tolerable", Number(e.target.value))} />
            </div>
            <div>
              <Label>Périodicité de revue (mois)</Label>
              <Input type="number" min={1} max={60} value={draft.periodicite_revue_mois}
                onChange={(e) => set("periodicite_revue_mois", Number(e.target.value))} />
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-[#172030]/50 mb-2">Aperçu des niveaux</p>
            <div className="grid gap-2 sm:grid-cols-4">
              {[
                { n: "Faible" as const, r: `1 – ${draft.seuil_acceptable}` },
                { n: "Modéré" as const, r: `${draft.seuil_acceptable + 1} – ${draft.seuil_tolerable}` },
                { n: "Élevé" as const, r: `${draft.seuil_tolerable + 1} – 18` },
                { n: "Critique" as const, r: "19 – 25" },
              ].map((x) => (
                <div key={x.n} className={`rounded-lg border px-3 py-2 text-sm ${NIVEAU_STYLE[x.n].badge}`}>
                  <p className="font-medium">{x.n}</p>
                  <p className="text-xs opacity-80">Score {x.r}</p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
